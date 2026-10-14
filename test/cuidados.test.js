/**
 * CUIDAR A LOS ANIMALES.
 *
 * Los puntos traen animales; crecen si los cuidás. Lo que hacés con tu plata
 * te da alimento, jabón y premios, y con eso los cuidás. Estas pruebas cuidan
 * que esa cadena —plata → cosas → cuidados → crecer— no se corte, y que
 * nadie pierda lo que ya tenía cuando la granja cambió de reglas.
 */
var test = require('node:test');
var assert = require('node:assert');

// PRIMERO esto: abre la base de prueba antes de que nadie toque db.js.
var ayuda = require('./ayuda.js');

var granja = require('../server/granja.js');
var arbol = require('../server/arbol.js');

test.beforeEach(function () {
  ayuda.limpiar();
  ayuda.db.prepare('DELETE FROM granja_items').run();
  ayuda.db.prepare('DELETE FROM granja_cuidados').run();
});

/** Un usuario con esos puntos y la canasta vacía (sin la bienvenida). */
function conPuntos(xp, sinBienvenida) {
  var u = ayuda.usuario();
  ayuda.db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, ?, 0, 0, ?)')
    .run(u.id, xp, '');
  if (sinBienvenida) {
    arbol.prepararGranja(u.id);
    ayuda.db.prepare("DELETE FROM granja_items WHERE user_id = ? AND motivo = 'bienvenida'").run(u.id);
    // Que no la vuelva a dar: la marca es la fila de bienvenida.
    ayuda.db.prepare("INSERT INTO granja_items (user_id, item, cantidad, motivo) VALUES (?, 'alimento', 0, 'bienvenida')").run(u.id);
  }
  return u;
}

/** Dar cosas a mano, como si las hubiera ganado. */
function darle(u, item, n) {
  ayuda.db.prepare("INSERT INTO granja_items (user_id, item, cantidad, motivo) VALUES (?, ?, ?, 'prueba')")
    .run(u.id, item, n);
}

/* =============================================== de dónde salen las cosas */

/*
 * Cada logro con la plata da su cosa: anotar da alimento, respetar un
 * presupuesto da jabón, cerrar el mes en verde da premios.
 */
test('anotar un gasto da alimento', function () {
  var u = conPuntos(300, true);
  var antes = arbol.canastaDe(u.id).alimento;
  arbol.alAnotarMovimiento(u.id, {});
  // Racha del día + el gasto anotado.
  assert.strictEqual(arbol.canastaDe(u.id).alimento, antes + 2);
});

test('cerrar el mes en verde da premios, y respetar un presupuesto da jabón', function () {
  var u = conPuntos(300, true);
  ayuda.mov(u.id, { date: '2026-09-01', amount: 500000, category: 'Sueldo' });
  ayuda.mov(u.id, { date: '2026-09-05', amount: -30000, category: 'Super' });
  ayuda.db.prepare('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)').run(u.id, 'Super', 100000);

  arbol.cerrarMes(u.id, '2026-09');
  var c = arbol.canastaDe(u.id);
  assert.strictEqual(c.premio, 3, 'mes en verde');
  assert.strictEqual(c.jabon, 2, 'un presupuesto respetado');
});

/*
 * Invertir de nuevo no da puntos, pero sí un premio. Uno por día: si no,
 * cargar y borrar un activo sería una canilla de premios.
 */
test('invertir da un premio, uno por día', function () {
  var u = conPuntos(300, true);
  ayuda.db.prepare("INSERT INTO portfolio_assets (user_id, symbol, asset_type, quantity) VALUES (?, 'AL30', 'bono', 1)").run(u.id);
  ayuda.db.prepare("INSERT INTO portfolio_assets (user_id, symbol, asset_type, quantity) VALUES (?, 'GGAL', 'accion', 1)").run(u.id);

  arbol.alAgregarInversion(u.id);
  arbol.alAgregarInversion(u.id);
  arbol.alAgregarInversion(u.id);
  assert.strictEqual(arbol.canastaDe(u.id).premio, 1);
});

/* La canasta es la suma de lo ganado menos lo usado, como un saldo. */
test('la canasta es lo ganado menos lo usado', function () {
  var u = conPuntos(300, true);
  darle(u, 'alimento', 3);
  arbol.cuidar(u.id, 0, 'comer');
  assert.strictEqual(arbol.canastaDe(u.id).alimento, 2);
});

/* ========================================================== cuidar ======= */

test('darle de comer suma un cuidado y gasta un alimento', function () {
  var u = conPuntos(300, true);
  darle(u, 'alimento', 1);
  var r = arbol.cuidar(u.id, 0, 'comer');
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.animal.cuidado, 1);
  assert.strictEqual(r.animal.hambre, false, 'ya no tiene hambre');
});

/*
 * SI NO SE PUEDE, SE DICE POR QUÉ Y QUÉ HACER. «No tenés jabón: se gana
 * respetando un presupuesto». Es lo que conecta la granja con la plata.
 */
test('sin jabón no se baña, y se dice cómo se consigue', function () {
  var u = conPuntos(300, true);
  var r = arbol.cuidar(u.id, 0, 'banar');
  assert.strictEqual(r.codigo, 409);
  assert.match(r.error, /No tenés jabón/);
  assert.match(r.error, /presupuesto/);
});

/*
 * Un animal que acaba de comer está lleno. Es lo que hace que haya motivo
 * para volver, y lo que impide engordarlo en un minuto con toda la canasta.
 */
test('un animal que acaba de comer está lleno', function () {
  var u = conPuntos(300, true);
  darle(u, 'alimento', 5);
  assert.ok(!arbol.cuidar(u.id, 0, 'comer').error);
  var otra = arbol.cuidar(u.id, 0, 'comer');
  assert.strictEqual(otra.codigo, 409);
  assert.match(otra.error, /ya comió/);
  assert.strictEqual(arbol.canastaDe(u.id).alimento, 4, 'y no le cobra el que no comió');
});

test('con los cuidados suficientes crece, y se avisa', function () {
  var u = conPuntos(300, true);
  // Le faltan 2 para ser joven: un baño.
  ayuda.db.prepare('UPDATE granja_cuidados SET cuidado = ? WHERE user_id = ? AND animal_id = 0')
    .run(granja.CRECE_CUIDADOS[1] - 2, u.id);
  darle(u, 'jabon', 1);
  var r = arbol.cuidar(u.id, 0, 'banar');
  assert.strictEqual(r.crecio, true);
  assert.strictEqual(r.animal.etapaNombre, 'pollita');
});

test('mimar es gratis y no hace crecer', function () {
  var u = conPuntos(300, true);
  var r = arbol.cuidar(u.id, 0, 'mimar');
  assert.ok(!r.error);
  assert.strictEqual(r.animal.cuidado, 0);
});

test('no se cuida a un animal que no llegó, ni con una acción inventada', function () {
  var u = conPuntos(300, true);
  assert.strictEqual(arbol.cuidar(u.id, 5, 'mimar').codigo, 404);
  assert.strictEqual(arbol.cuidar(u.id, 0, 'volar').codigo, 400);
  assert.strictEqual(arbol.cuidar(u.id, 0, 'cuidado = 999; --').codigo, 400, 'la acción no puede llegar al SQL');
});

/* ================================================= el descuido no castiga */

/*
 * Nunca se achican ni se mueren. Que no lo cuides no lo hace volver para
 * atrás: solo deja de avanzar.
 */
test('un animal descuidado tiene hambre y está sucio, pero no se achica', function () {
  var hace5dias = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  var g = granja.granja(300, {}, { 0: { cuidado: 20, comio: hace5dias, banio: hace5dias } });
  var a = g.animales[0];
  assert.strictEqual(a.hambre, true);
  assert.strictEqual(a.sucio, true);
  assert.strictEqual(a.etapa, 2, 'sigue siendo grande');
});

/* ======================================== el cambio de reglas, sin perder */

/*
 * Antes crecían solos con los puntos. Quien ya tenía una gallina grande no
 * puede encontrarse con un pollito: sería castigarlo por un cambio que no
 * hizo él.
 */
test('los que ya habían crecido con los puntos siguen grandes', function () {
  var llega = granja.llegadaDe(0);
  var u = conPuntos(llega + 1000); // con la regla vieja, la gallina era grande
  var g = arbol.granjaDe(u.id);
  assert.strictEqual(g.animales[0].etapa, 2);
});

test('la canasta de bienvenida se da una sola vez', function () {
  var u = conPuntos(300);
  arbol.granjaDe(u.id);
  arbol.granjaDe(u.id);
  arbol.prepararTodas();
  var c = arbol.canastaDe(u.id);
  assert.strictEqual(c.alimento, 6);
  assert.strictEqual(c.jabon, 2);
  assert.strictEqual(c.premio, 1);
});

/*
 * Un animal que llega DESPUÉS del cambio nace cría y hay que cuidarlo, por
 * más puntos que se junten: si no, el cambio no habría cambiado nada.
 */
test('un animal que llega después del cambio nace cría', function () {
  var u = conPuntos(300);
  arbol.granjaDe(u.id); // pasa a las reglas nuevas con 300 puntos: solo la gallina
  ayuda.db.prepare('UPDATE user_stats SET xp = ? WHERE user_id = ?').run(9999, u.id);
  var g = arbol.granjaDe(u.id);
  assert.ok(g.total > 1);
  assert.strictEqual(g.animales[1].etapa, 0, 'el conejo llegó después: es cría');
});

/* ======================================================= el aviso ======== */

test('ganar jabón o premios se avisa; el alimento no, porque es de todos los días', function () {
  var f = granja.frases({ llegaron: [], crecieron: [], ganados: { alimento: 1, jabon: 2 } });
  assert.strictEqual(f.length, 1);
  assert.match(f[0], /2 jabones/);
});
