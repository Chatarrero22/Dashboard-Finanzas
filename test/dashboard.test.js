/**
 * LAS REGLAS QUE VIVEN EN LAS CONSULTAS DEL DASHBOARD.
 *
 * La asimetría del `Ajuste` no está en ningún módulo: está en la constante
 * `SIN_CORRECCIONES` de `api.js`, adentro del endpoint. Así que para probarla
 * hay que pedirle el dashboard a la app de verdad.
 *
 * Se levanta express en memoria con el router real. La sesión se inyecta con
 * un middleware antes del router: `auth.requerido` hace
 * `req.user = req.user || ...`, así que si ya viene puesto no mira la cookie.
 * Lo que se prueba acá son las reglas de la plata, no el login.
 */
var test = require('node:test');
var assert = require('node:assert');
var http = require('node:http');

// PRIMERO esto: abre la base de prueba antes de que nadie toque db.js.
var ayuda = require('./ayuda.js');

var express = require('express');
var api = require('../server/api.js');
var cuentas = require('../server/cuentas.js');

var usuario = null;
var servidor = null;
var base = '';

test.before(async function () {
  var app = express();
  app.use(express.json());
  app.use('/api', function (req, res, next) {
    req.user = usuario;
    next();
  });
  app.use('/api', api.router);

  servidor = http.createServer(app);
  await new Promise(function (listo) { servidor.listen(0, '127.0.0.1', listo); });
  base = 'http://127.0.0.1:' + servidor.address().port + '/api';
});

test.after(function () {
  if (servidor) servidor.close();
});

test.beforeEach(function () {
  ayuda.limpiar();
  usuario = ayuda.usuario();
  usuario.isAdmin = true;
});

function dashboard(mes) {
  return fetch(base + '/dashboard' + (mes ? '?month=' + mes : '')).then(function (r) {
    assert.strictEqual(r.status, 200, 'el dashboard tiene que responder 200');
    return r.json();
  });
}

/** El mes de hoy, que es el único en el que el dashboard habla de tu plata. */
function mesDeHoy() {
  return new Date().toISOString().slice(0, 7);
}

function diaDeEsteMes(dia) {
  return mesDeHoy() + '-' + String(dia).padStart(2, '0');
}

/* ============================================= la asimetría del Ajuste === */

/*
 * UN AJUSTE NEGATIVO CUENTA COMO GASTO.
 *
 * La app decía que tenías MÁS de lo que tenés, o sea que hubo plata que se
 * fue y nunca se cargó (pagaste el resumen de un mes que no anotaste). Es un
 * gasto de verdad aunque no sepamos en qué.
 *
 * Saqué el Ajuste de los totales razonando «una corrección no es un gasto» y
 * el ahorro del mes de Emanuel saltó de $109.367 a $1.059.436: plata que él
 * sabía que no tenía.
 */
test('un Ajuste negativo cuenta como gasto del mes', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: 1000000, category: 'Sueldo' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(5), amount: -950069, category: 'Ajuste' });

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.expense, 950069, 'el ajuste negativo es plata que se fue');
  assert.strictEqual(d.balance, 49931);
});

/*
 * UN AJUSTE POSITIVO NO ES UN INGRESO.
 *
 * La app decía que tenías MENOS. Eso no es plata que ganaste: es plata que ya
 * era tuya y la app no sabía.
 *
 * Cuando dejé que contara, arreglar el saldo de una cuenta le sumó a Emanuel
 * $59.345 de ingresos que nunca cobró.
 */
test('un Ajuste positivo no cuenta como ingreso', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: 500000, category: 'Sueldo' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(5), amount: 59345, category: 'Ajuste' });

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.income, 500000, 'los $59.345 no los cobró nadie');
});

/*
 * LA ASIMETRÍA NO ES UN CAPRICHO: es cómo falla la memoria de la gente. El
 * sueldo se anota siempre, los gastos se olvidan. Si la app cree que tenés de
 * más, falta un gasto; si cree que tenés de menos, es plata que ya estaba.
 *
 * Los dos lados me mordieron, uno por vez, así que van juntos en una prueba.
 */
test('los dos signos del Ajuste a la vez', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: 100000, category: 'Sueldo' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(2), amount: -30000, category: 'Ajuste' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(3), amount: 70000, category: 'Ajuste' });

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.income, 100000);
  assert.strictEqual(d.expense, 30000);
});

/*
 * TRASPASO Y SALDO INICIAL NO SON GASTOS NI INGRESOS.
 *
 * Si no, mover plata al ahorro aparece como un gasto y el mes queda
 * arruinado. Emanuel: «me sale que tengo 109667, no puede ser tan difícil».
 */
test('mover plata al ahorro no es un gasto del mes', async function () {
  var principal = cuentas.principal(usuario.id);
  var ahorro = ayuda.cuenta(usuario.id, 'Ahorro', 'ahorro');

  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: 300000, category: 'Sueldo' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(5), amount: -200000, category: 'Traspaso', account_id: principal.id, transfer_group: 'g' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(5), amount: 200000, category: 'Traspaso', account_id: ahorro.id, transfer_group: 'g' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(6), amount: 1000000, category: 'Saldo inicial', account_id: ahorro.id });

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.expense, 0, 'apartar plata no es gastarla');
  assert.strictEqual(d.income, 300000, 'ni decir cuánto tenías es cobrarlo');
});

/*
 * LOS TRES QUEDAN AFUERA DE LA TORTA, del ranking y del gasto por día: no son
 * un gasto EN algo, no tienen dónde ir.
 */
test('las correcciones no aparecen en la torta ni en el ranking', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(2), amount: -50000, category: 'Super' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(3), amount: -900000, category: 'Ajuste' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(4), amount: -800000, category: 'Traspaso' });
  ayuda.mov(usuario.id, { date: diaDeEsteMes(5), amount: -700000, category: 'Saldo inicial' });

  var d = await dashboard(mesDeHoy());
  var nombres = d.byCategory.map(function (c) { return c.category; });

  assert.deepStrictEqual(nombres, ['Super']);
  assert.ok(!d.topExpenses.some(function (g) { return g.total > 50000; }));
  assert.ok(!d.gastosDelMes.some(function (g) { return g.category === 'Ajuste'; }));

  var porDia = d.byDay.reduce(function (a, x) { return a + x.total; }, 0);
  assert.strictEqual(porDia, 50000, 'el gasto por día solo cuenta gastos de verdad');
});

/* ================================================= la tendencia ========== */

/*
 * LA TENDENCIA SON LOS 6 MESES QUE TERMINAN EN EL QUE ESTÁS MIRANDO.
 *
 * Antes era «los últimos 6 que existan» y las cuotas se los comían: una
 * compra en 6 cuotas deja movimientos hasta el año que viene, así que los
 * seis más nuevos pasaban a ser octubre y cinco meses de FUTURO. Emanuel vio
 * «oct, nov, dic, ene, feb, mar» con cinco barras casi vacías.
 */
test('la tendencia no muestra meses del futuro', async function () {
  var hoy = mesDeHoy();
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: -10000, category: 'Super' });

  // Seis cuotas que llegan hasta medio año adelante.
  for (var i = 1; i <= 6; i++) {
    var f = new Date();
    f.setMonth(f.getMonth() + i);
    ayuda.mov(usuario.id, {
      date: f.toISOString().slice(0, 10),
      amount: -20000, category: 'Hogar',
      installment_num: i, installment_total: 6
    });
  }

  var d = await dashboard(hoy);
  var futuros = d.byMonth.filter(function (m) { return m.month > hoy; });
  assert.strictEqual(futuros.length, 0, 'ninguna barra puede ser de un mes que no pasó');
  assert.ok(d.byMonth.length >= 1);
});

/* ============================================ contra el mes pasado ======= */

/*
 * COMPARAR EL MES ENTERO CONTRA UN MES ENTERO ES INJUSTO hasta fin de mes: el
 * 5 de octubre siempre vas a gastar «menos que en septiembre». Por eso la
 * comparación es contra los MISMOS días del mes pasado.
 */
test('la comparación es contra los mismos días del mes pasado', async function () {
  var pasado = new Date();
  pasado.setMonth(pasado.getMonth() - 1);
  var mesPasado = pasado.getFullYear() + '-' + String(pasado.getMonth() + 1).padStart(2, '0');

  // Hoy, día 1: gastó 10.000.
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: -10000, category: 'Super' });
  // El mes pasado: 4.000 el día 1 y 900.000 el 28.
  ayuda.mov(usuario.id, { date: mesPasado + '-01', amount: -4000, category: 'Super' });
  ayuda.mov(usuario.id, { date: mesPasado + '-28', amount: -900000, category: 'Super' });

  var d = await dashboard(mesDeHoy());
  assert.ok(d.comparacion, 'tiene que venir la comparación');
  assert.strictEqual(d.comparacion.month, mesPasado);
  assert.strictEqual(d.comparacion.expense, 904000, 'el mes pasado completo');

  var hoyDia = new Date().getDate();
  if (hoyDia < 28) {
    assert.strictEqual(d.comparacion.expenseParcial, 4000,
      'hasta el mismo día del mes pasado son 4.000');
    assert.strictEqual(d.comparacion.delta, 6000, 'vas gastando 6.000 más');
  }
});

/*
 * Y CADA CATEGORÍA DICE CUÁNTO SUBIÓ. Una barra más alta no te hace cambiar
 * nada; «Comida +$40.000» sí.
 */
test('cada categoría trae lo del mes pasado y la diferencia', async function () {
  var pasado = new Date();
  pasado.setMonth(pasado.getMonth() - 1);
  var mesPasado = pasado.getFullYear() + '-' + String(pasado.getMonth() + 1).padStart(2, '0');

  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: -50000, category: 'Super' });
  ayuda.mov(usuario.id, { date: mesPasado + '-01', amount: -10000, category: 'Super' });

  var d = await dashboard(mesDeHoy());
  var sup = d.byCategory.find(function (c) { return c.category === 'Super'; });
  assert.strictEqual(sup.anterior, 10000);
  assert.strictEqual(sup.delta, 40000);
  assert.strictEqual(d.comparacion.subioMas.category, 'Super');
});

/* ========================================= sale de tu cuenta este mes ==== */

test('el dashboard del mes de hoy trae las salidas, y uno pasado no', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: -40000, category: 'Super' });

  var hoy = await dashboard(mesDeHoy());
  assert.ok(hoy.saleEsteMes, 'en el mes en curso tiene que venir');
  assert.strictEqual(hoy.saleEsteMes.total, 40000);

  var pasado = new Date();
  pasado.setMonth(pasado.getMonth() - 1);
  var mesPasado = pasado.getFullYear() + '-' + String(pasado.getMonth() + 1).padStart(2, '0');

  var viejo = await dashboard(mesPasado);
  assert.strictEqual(viejo.saleEsteMes, null, 'en un mes cerrado no significa nada');
});

/* ================================================ topes y metas =========== */

/*
 * LOS PRESUPUESTOS YA VENÍAN EN EL DASHBOARD y la pantalla los tiraba a la
 * basura: el servidor los calculaba en cada carga y nadie los leía.
 */
test('los topes vienen con lo gastado y el porcentaje', async function () {
  ayuda.db.prepare('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)')
    .run(usuario.id, 'Super', 100000);
  ayuda.mov(usuario.id, { date: diaDeEsteMes(2), amount: -90000, category: 'Super' });

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.budgets.length, 1);
  assert.strictEqual(d.budgets[0].spent, 90000);
  assert.strictEqual(d.budgets[0].remaining, 10000);
  assert.strictEqual(d.budgets[0].status, 'cerca', 'al 90% hay que avisar');
});

test('las metas vienen con su porcentaje', async function () {
  ayuda.db.prepare('INSERT INTO goals (user_id, name, target, saved) VALUES (?, ?, ?, ?)')
    .run(usuario.id, 'Viaje', 1000000, 250000);

  var d = await dashboard(mesDeHoy());
  assert.strictEqual(d.goals.length, 1);
  assert.strictEqual(d.goals[0].pct, 25);
});

/* ============================================== el titular del Resumen ==== */

/*
 * ARRIBA DE TODO VA LA PLATA QUE TENÉS, que es el número que se puede
 * verificar mirando el banco. Emanuel preguntó CUATRO VECES por qué el número
 * grande no coincidía con su plata: era un flujo.
 */
test('los potes salen de un solo lado y son plata, no flujo', async function () {
  ayuda.mov(usuario.id, { date: diaDeEsteMes(1), amount: 453799, category: 'Sueldo' });

  var d = await dashboard(mesDeHoy());
  assert.ok(d.potes, 'el titular necesita los potes');
  assert.strictEqual(d.potes.liquidez, 453799);
  assert.strictEqual(d.potes.liquidez, cuentas.potes(usuario.id).liquidez,
    'la pantalla y el módulo tienen que decir lo mismo');
});

/* ============================================ el nombre de un animal ===== */

/*
 * Cambiar el nombre desde la pantalla. Devuelve el progreso entero, así la
 * granja se redibuja con una sola llamada; y un animal que todavía no llegó
 * no se puede nombrar.
 */
test('se le cambia el nombre a un animal, y al que no llegó no', async function () {
  ayuda.db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, ?, 0, 0, ?)')
    .run(usuario.id, 250, '');

  var ok = await fetch(base + '/granja/0', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Turuleca' }),
  });
  assert.strictEqual(ok.status, 200);
  var progreso = await ok.json();
  assert.strictEqual(progreso.granja.animales[0].nombre, 'Turuleca');

  var no = await fetch(base + '/granja/5', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Nadie' }),
  });
  assert.strictEqual(no.status, 404);
});
