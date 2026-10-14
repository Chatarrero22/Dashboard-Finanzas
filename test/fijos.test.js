/**
 * LOS GASTOS FIJOS Y CON QUÉ SE PAGAN.
 *
 * Antes todos se cargaban como débito: Netflix pagado con la Visa bajaba el
 * Disponible el día del cobro, en vez de entrar en el resumen y salir cuando
 * lo pagás. Es la regla de «lo que pagás con tarjeta todavía está en tu
 * cuenta», que los fijos se salteaban.
 */
var test = require('node:test');
var assert = require('node:assert');
var http = require('node:http');

// PRIMERO esto: abre la base de prueba antes de que nadie toque db.js.
var ayuda = require('./ayuda.js');

var express = require('express');
var api = require('../server/api.js');
var fijos = require('../server/fijos.js');
var cuentas = require('../server/cuentas.js');
var tarjetas = require('../server/tarjetas.js');

var usuario = null;
var servidor = null;
var base = '';

test.before(async function () {
  var app = express();
  app.use(express.json());
  app.use('/api', function (req, res, next) { req.user = usuario; next(); });
  app.use('/api', api.router);
  servidor = http.createServer(app);
  await new Promise(function (listo) { servidor.listen(0, '127.0.0.1', listo); });
  base = 'http://127.0.0.1:' + servidor.address().port + '/api';
});

test.after(function () { if (servidor) servidor.close(); });

test.beforeEach(function () {
  ayuda.limpiar();
  usuario = ayuda.usuario();
});

function pedir(metodo, ruta, cuerpo) {
  return fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  }).then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); });
}

function mesDeHoy() {
  return new Date().toISOString().slice(0, 7);
}

/*
 * UN FIJO CON TARJETA ENTRA EN LA DEUDA DE LA TARJETA Y NO BAJA EL
 * DISPONIBLE. Es toda la razón de ser del cambio.
 */
test('un fijo pagado con tarjeta no baja el Disponible el día del cobro', async function () {
  var t = ayuda.tarjeta(usuario.id, { close_day: 28, due_day: 10, es_default: true });
  ayuda.mov(usuario.id, { date: mesDeHoy() + '-01', amount: 100000, category: 'Sueldo' });

  await pedir('POST', '/subscriptions', { name: 'Netflix', amount: 9000, billing_day: 1, card_id: t.id });
  await fijos.cargarVencidas(usuario.id);

  var mov = ayuda.db.prepare("SELECT * FROM transactions WHERE description = 'Netflix'").get();
  assert.strictEqual(mov.card_id, t.id, 'se cargó con la tarjeta');
  assert.strictEqual(cuentas.potes(usuario.id).liquidez, 100000, 'el Disponible no se movió');
  assert.strictEqual(tarjetas.deuda(usuario.id).total, 9000, 'y le debés 9.000 a la tarjeta');
});

test('un fijo con débito sale en el momento, como siempre', async function () {
  ayuda.mov(usuario.id, { date: mesDeHoy() + '-01', amount: 100000, category: 'Sueldo' });
  await pedir('POST', '/subscriptions', { name: 'Gimnasio', amount: 20000, billing_day: 1, card_id: null });
  await fijos.cargarVencidas(usuario.id);
  assert.strictEqual(cuentas.potes(usuario.id).liquidez, 80000);
});

/*
 * PASAR DE TARJETA A DÉBITO TIENE QUE FUNCIONAR. `null` es un valor de
 * verdad, y con un `!= null` no se podía volver: la casilla que solo prende
 * y nunca apaga.
 */
test('se puede pasar un fijo de tarjeta a débito', async function () {
  var t = ayuda.tarjeta(usuario.id, { close_day: 28, due_day: 10 });
  var creado = await pedir('POST', '/subscriptions', { name: 'Spotify', amount: 3000, billing_day: 1, card_id: t.id });
  assert.strictEqual(creado.json.card_id, t.id);

  var cambiado = await pedir('PATCH', '/subscriptions/' + creado.json.id, { card_id: null });
  assert.strictEqual(cambiado.json.card_id, null);
});

/*
 * «Netflix se paga con la Visa» vale para este mes también: si ya se cargó,
 * se pasa. Los meses anteriores no, porque esos resúmenes ya cerraron.
 */
test('cambiar la tarjeta mueve lo de este mes, no lo de antes', async function () {
  var t = ayuda.tarjeta(usuario.id, { close_day: 28, due_day: 10 });
  var creado = await pedir('POST', '/subscriptions', { name: 'Netflix', amount: 9000, billing_day: 1, card_id: null });
  ayuda.mov(usuario.id, { date: mesDeHoy() + '-01', amount: -9000, description: 'Netflix', platform: 'Fijo' });
  ayuda.mov(usuario.id, { date: '2020-01-01', amount: -9000, description: 'Netflix', platform: 'Fijo' });

  var r = await pedir('PATCH', '/subscriptions/' + creado.json.id, { card_id: t.id });
  assert.strictEqual(r.json.movidoEsteMes, 1);

  var viejo = ayuda.db.prepare("SELECT card_id FROM transactions WHERE date = '2020-01-01'").get();
  assert.strictEqual(viejo.card_id, null, 'el de hace años queda como estaba');
});

/* Nunca se guarda una tarjeta ajena por un id que mandó la pantalla. */
test('no se puede poner la tarjeta de otra persona', async function () {
  var otra = ayuda.usuario('otra');
  var ajena = ayuda.tarjeta(otra.id, { close_day: 28, due_day: 10 });
  var r = await pedir('POST', '/subscriptions', { name: 'Netflix', amount: 9000, billing_day: 1, card_id: ajena.id });
  assert.strictEqual(r.json.card_id, null);
});

test('si se borra la tarjeta, sus fijos pasan a débito', async function () {
  var t = ayuda.tarjeta(usuario.id, { close_day: 28, due_day: 10 });
  var creado = await pedir('POST', '/subscriptions', { name: 'Netflix', amount: 9000, billing_day: 1, card_id: t.id });
  await pedir('DELETE', '/cards/' + t.id);
  var lista = await pedir('GET', '/subscriptions');
  assert.strictEqual(lista.json.find(function (s) { return s.id === creado.json.id; }).card_id, null);
});

test('la lista dice con qué tarjeta se paga cada uno', async function () {
  var t = ayuda.tarjeta(usuario.id, { name: 'Visa Santander', close_day: 28, due_day: 10 });
  await pedir('POST', '/subscriptions', { name: 'Netflix', amount: 9000, billing_day: 1, card_id: t.id });
  var lista = await pedir('GET', '/subscriptions');
  assert.strictEqual(lista.json[0].card_name, 'Visa Santander');
});
