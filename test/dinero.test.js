/**
 * LAS REGLAS DE LA PLATA.
 *
 * Cada prueba de acá está porque la regla se rompió en la vida real y Emanuel
 * vio un número que sabía que estaba mal. El comentario dice cuál: si mañana
 * una de estas falla, el número que se rompe es uno que él conoce de memoria.
 *
 * Se prueban los módulos directo, con una base de prueba aislada. Las reglas
 * que viven en las consultas del dashboard están en `dashboard.test.js`.
 */
var test = require('node:test');
var assert = require('node:assert');

// PRIMERO esto: abre la base de prueba antes de que nadie toque db.js.
var ayuda = require('./ayuda.js');

var cuentas = require('../server/cuentas.js');
var tarjetas = require('../server/tarjetas.js');
var salidas = require('../server/salidas.js');
var mercado = require('../server/mercado-arg.js');

/** Una fecha del mes de hoy, para lo que depende del reloj de verdad. */
function esteMes(dia) {
  var hoy = new Date();
  return hoy.getFullYear() + '-' +
    String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
    String(dia).padStart(2, '0');
}

test.beforeEach(function () {
  ayuda.limpiar();
});

/* ====================================================== cuentas y potes === */

/*
 * LA CUENTA PRINCIPAL SIEMPRE ES LIQUIDEZ, esté marcada como esté.
 *
 * La cuenta principal de Emanuel quedó marcada como «Ahorro», así que sin
 * esta regla su plata del día a día aparecía como apartada y Liquidez daba
 * cero.
 */
test('la cuenta principal es liquidez aunque esté marcada como ahorro', function () {
  var u = ayuda.usuario();
  var base = cuentas.principal(u.id);
  ayuda.db.prepare('UPDATE accounts SET tipo = ? WHERE id = ?').run('ahorro', base.id);

  ayuda.mov(u.id, { date: esteMes(3), amount: 500000, category: 'Sueldo' });

  var p = cuentas.potes(u.id);
  assert.strictEqual(p.liquidez, 500000, 'la principal tiene que contar como liquidez');
  assert.strictEqual(p.ahorro, 0, 'y no como plata apartada');
});

/*
 * UN TRASPASO SON DOS MOVIMIENTOS QUE SE ANULAN.
 *
 * Que sean dos y no uno es a propósito: así la suma de todos los movimientos
 * sigue dando tu plata total sin que ninguna consulta sepa que existen los
 * traspasos.
 */
test('mover plata entre cuentas no cambia cuánta plata tenés', function () {
  var u = ayuda.usuario();
  var base = cuentas.principal(u.id);
  var ahorro = ayuda.cuenta(u.id, 'Ahorro', 'ahorro');

  ayuda.mov(u.id, { date: esteMes(1), amount: 300000, category: 'Sueldo' });
  var antes = cuentas.potes(u.id).enCuentas;

  ayuda.mov(u.id, { date: esteMes(5), amount: -100000, category: 'Traspaso', account_id: base.id, transfer_group: 'g1' });
  ayuda.mov(u.id, { date: esteMes(5), amount: 100000, category: 'Traspaso', account_id: ahorro.id, transfer_group: 'g1' });

  var p = cuentas.potes(u.id);
  assert.strictEqual(p.enCuentas, antes, 'la plata total no se puede mover sola');
  assert.strictEqual(p.liquidez, 200000, 'de la principal salieron 100.000');
  assert.strictEqual(p.ahorro, 100000, 'y entraron al ahorro');
});

/*
 * «PONER EL SALDO REAL» ES DE A UNA CUENTA.
 *
 * Nadie puede verificar un total; lo que una persona mira es el saldo de UNA
 * cuenta. Antes se comparaba contra toda la plata junta: Emanuel vio $50.000
 * en el banco, lo escribió, y la app le descontó a la principal todo lo que
 * tenía en las otras cuentas. Lo dejó en -$9.045.
 */
test('el saldo de una cuenta no mira las otras cuentas', function () {
  var u = ayuda.usuario();
  var base = cuentas.principal(u.id);
  var otra = ayuda.cuenta(u.id, 'Plazo fijo', 'ahorro');

  ayuda.mov(u.id, { date: esteMes(1), amount: 50000, category: 'Sueldo', account_id: base.id });
  ayuda.mov(u.id, { date: esteMes(1), amount: 900000, category: 'Saldo inicial', account_id: otra.id });

  assert.strictEqual(cuentas.saldoDe(u.id, base.id), 50000);
  assert.strictEqual(cuentas.saldoDe(u.id, otra.id), 900000);
});

/* ======================================================= tarjetas ========= */

/*
 * LO QUE PAGÁS CON TARJETA TODAVÍA ESTÁ EN TU CUENTA.
 *
 * El gasto se anota el día de la compra —correcto para el mes, las categorías
 * y los presupuestos— pero la plata se va cuando pagás el resumen.
 *
 * Sin esto el saldo del banco bajaba apenas comprabas: Emanuel vio -$17.019
 * con $50.000 en el banco. «Lo que pago con tarjeta me está descontando mi
 * liquidez y no tiene que ser así.»
 */
test('comprar con tarjeta no baja el saldo del banco', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 28, due_day: 10, es_default: true });

  ayuda.mov(u.id, { date: esteMes(1), amount: 50000, category: 'Sueldo' });
  ayuda.mov(u.id, { date: esteMes(2), amount: -67019, category: 'Super', card_id: t.id });

  var lista = cuentas.listar(u.id);
  var base = lista.find(function (c) { return c.es_default; });

  assert.strictEqual(base.saldo, 50000, 'en el banco siguen los $50.000');
  assert.strictEqual(base.saldoContable, -17019, 'el contable sí lo resta: la plata ya tiene dueño');
  assert.strictEqual(cuentas.potes(u.id).liquidez, 50000);
});

/*
 * LAS TRES PARTES DE LA DEUDA SUMAN EL TOTAL, SIEMPRE.
 *
 * Emanuel pagó su resumen, lo marcó, y siguió viendo $633.279 de deuda
 * mientras Tarjetas decía $293.619: la diferencia eran $339.660 de cuotas
 * futuras, que `deuda()` contaba y la pantalla no mostraba. Sin el desglose,
 * el único cierre posible era «el pago no me descontó».
 */
test('la deuda de tarjeta se desglosa en tres partes que suman el total', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 28, due_day: 10, es_default: true });

  ayuda.mov(u.id, { date: esteMes(2), amount: -100000, category: 'Super', card_id: t.id });

  // Una cuota del año que viene: real, la debés, pero no hay nada que hacer hoy.
  var proximo = new Date();
  proximo.setMonth(proximo.getMonth() + 2);
  ayuda.mov(u.id, {
    date: proximo.toISOString().slice(0, 10),
    amount: -50000, category: 'Hogar', card_id: t.id,
    installment_num: 2, installment_total: 6
  });

  var d = tarjetas.deuda(u.id);
  assert.strictEqual(
    d.abierto + d.cerradoSinPagar + d.cuotasFuturas,
    d.total,
    'las tres partes tienen que sumar el total'
  );
  assert.strictEqual(d.total, 150000);
  assert.strictEqual(d.cuotasFuturas, 50000);
});

/*
 * MARCAR EL RESUMEN COMO PAGADO BAJA LA DEUDA.
 *
 * Cuando la deuda se calculaba en dos lados, pagar bajaba uno y no el otro:
 * Emanuel vio «Tarjeta sin pagar $59.367» mientras Tarjetas decía «$773.033»
 * y preguntó, con razón, cuál de los dos era.
 */
test('pagar un resumen baja la deuda, y el saldo del banco también', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 5, due_day: 15, es_default: true });

  ayuda.mov(u.id, { date: esteMes(1), amount: 500000, category: 'Sueldo' });

  // Un gasto del mes pasado, que ya cerró.
  var pasado = new Date();
  pasado.setMonth(pasado.getMonth() - 1);
  var mesPasado = pasado.getFullYear() + '-' + String(pasado.getMonth() + 1).padStart(2, '0');
  ayuda.mov(u.id, { date: mesPasado + '-02', amount: -120000, category: 'Super', card_id: t.id });

  var pendientes = tarjetas.resumenesPendientes(u.id, t);
  assert.ok(pendientes.length >= 1, 'tiene que haber un resumen cerrado sin pagar');

  var antes = tarjetas.deuda(u.id).total;
  tarjetas.pagarResumen(u.id, t.id, pendientes[0].cierre, pendientes[0].monto);
  var despues = tarjetas.deuda(u.id).total;

  assert.strictEqual(antes - despues, pendientes[0].monto, 'la deuda baja exactamente lo pagado');
  assert.strictEqual(tarjetas.resumenesPendientes(u.id, t).length, pendientes.length - 1);
});

/*
 * CAMBIAR EL DÍA DE CIERRE NO RESUCITA PAGOS.
 *
 * `card_payments.period_close` guarda la fecha de cierre calculada con el día
 * VIEJO. Si cambia, esas fechas dejan de coincidir con ningún cierre y los
 * resúmenes ya pagados reaparecen como impagos. Emanuel cambió el cierre y le
 * apareció «VENCIÓ Y NO LO PAGASTE $1.099.060» de dos resúmenes que sí había
 * pagado.
 */
test('cambiar el día de cierre no hace reaparecer un resumen pagado', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 5, due_day: 15, es_default: true });

  var pasado = new Date();
  pasado.setMonth(pasado.getMonth() - 1);
  var mesPasado = pasado.getFullYear() + '-' + String(pasado.getMonth() + 1).padStart(2, '0');
  ayuda.mov(u.id, { date: mesPasado + '-02', amount: -200000, category: 'Super', card_id: t.id });

  var pendientes = tarjetas.resumenesPendientes(u.id, t);
  tarjetas.pagarResumen(u.id, t.id, pendientes[0].cierre, pendientes[0].monto);
  assert.strictEqual(tarjetas.resumenesPendientes(u.id, t).length, pendientes.length - 1);

  // Ahora cierra el 20, como cuando Emanuel lo corrigió.
  tarjetas.reanclarPagos(u.id, t.id, 5, 20);
  ayuda.db.prepare('UPDATE cards SET close_day = 20 WHERE id = ?').run(t.id);
  var nueva = ayuda.db.prepare('SELECT * FROM cards WHERE id = ?').get(t.id);

  var vivos = tarjetas.resumenesPendientes(u.id, nueva).filter(function (r) {
    return r.monto >= 200000;
  });
  assert.strictEqual(vivos.length, 0, 'el resumen pagado no puede volver como impago');
});

/* ================================================ sale de tu cuenta ====== */

/*
 * SALE DE TU CUENTA ESTE MES ES DISTINTO DE LO QUE GASTASTE.
 *
 * Un gasto con tarjeta de este mes NO sale este mes: cae en el resumen que
 * vence el mes que viene. Esa es toda la razón de ser de esta pantalla.
 */
test('un gasto con tarjeta de este mes no sale este mes', function () {
  var u = ayuda.usuario();
  // Cierra el 28 y vence el 10 del mes siguiente.
  var t = ayuda.tarjeta(u.id, { close_day: 28, due_day: 10, es_default: true });

  ayuda.mov(u.id, { date: '2026-10-05', amount: -300000, category: 'Super', card_id: t.id });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.ok(s, 'en el mes en curso tiene que haber datos');
  assert.strictEqual(s.total, 0, 'ese gasto se paga en noviembre, no sale en octubre');
  assert.strictEqual(s.masAdelante.length, 1, 'y hay que decir que existe');
  assert.strictEqual(s.masAdelante[0].monto, 300000);
});

/*
 * LO QUE NO ES TARJETA SALE EL DÍA DE LA COMPRA.
 * Débito y efectivo se van en el momento.
 */
test('lo que pagás con débito o efectivo ya salió', function () {
  var u = ayuda.usuario();
  ayuda.mov(u.id, { date: '2026-10-03', amount: -40000, category: 'Super' });
  ayuda.mov(u.id, { date: '2026-10-20', amount: -10000, category: 'Servicios' });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.yaSalio, 40000, 'lo del día 3 ya salió');
  assert.strictEqual(s.faltaSalir, 10000, 'lo del día 20 todavía no');
  assert.strictEqual(s.total, 50000);
});

/*
 * MOVER PLATA NO ES PLATA QUE SE TE VA.
 *
 * Un `Traspaso` cambia la plata de lugar y comprar un título la cambia de
 * forma: en los dos casos la seguís teniendo. Y el `Saldo inicial` es plata
 * que ya era tuya y la app no sabía.
 */
test('los traspasos y los saldos iniciales no salen de tu cuenta', function () {
  var u = ayuda.usuario();
  ayuda.mov(u.id, { date: '2026-10-02', amount: -200000, category: 'Traspaso' });
  ayuda.mov(u.id, { date: '2026-10-02', amount: -500000, category: 'Traspaso', asset_id: 7 });
  ayuda.mov(u.id, { date: '2026-10-02', amount: -300000, category: 'Saldo inicial' });
  ayuda.mov(u.id, { date: '2026-10-02', amount: -1000, category: 'Super' });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.total, 1000, 'solo el gasto de verdad sale de la cuenta');
});

/*
 * UN AJUSTE NEGATIVO SÍ SALE: es plata que se fue y nunca se cargó.
 */
test('un ajuste negativo cuenta como plata que salió', function () {
  var u = ayuda.usuario();
  ayuda.mov(u.id, { date: '2026-10-04', amount: -59345, category: 'Ajuste' });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.yaSalio, 59345);
});

/*
 * TODO SE ANCLA AL VENCIMIENTO, NO A `paid_on`.
 *
 * «Pagué todos» marca resúmenes viejos con la fecha de HOY. Si mirásemos
 * `paid_on`, un año de resúmenes que se pagaron en la vida real aparecería
 * como un millón saliendo este mes. El vencimiento es un hecho del resumen;
 * `paid_on` es cuándo alguien apretó el botón.
 */
test('marcar hoy un resumen viejo no lo hace salir este mes', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 5, due_day: 15, es_default: true });

  // Una compra de hace cuatro meses: su resumen venció hace mucho.
  ayuda.mov(u.id, { date: '2026-06-02', amount: -800000, category: 'Super', card_id: t.id });

  var pendientes = tarjetas.resumenesPendientes(u.id, t, '2026-10-14');
  assert.ok(pendientes.length >= 1);

  // Lo marca hoy, que es lo que hace el botón «Pagué todos».
  tarjetas.pagarResumen(u.id, t.id, pendientes[0].cierre, pendientes[0].monto, '2026-10-14');

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.yaSalio, 0, 'esa plata salió en junio, no ahora');
  assert.strictEqual(s.total, 0);
});

/*
 * UN RESUMEN QUE VENCIÓ Y SIGUE SIN MARCAR TIENE QUE APARECER.
 * Esa plata tiene que salir igual, y si no se cuenta acá no se cuenta en
 * ningún lado.
 */
test('un resumen vencido sin marcar aparece como atrasado', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 5, due_day: 15, es_default: true });
  ayuda.mov(u.id, { date: '2026-08-02', amount: -250000, category: 'Super', card_id: t.id });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.atrasado, 250000);
  assert.strictEqual(s.faltaSalir, 250000);
  assert.ok(s.resumenes.some(function (r) { return r.atrasado; }));
});

/*
 * EN UN MES CERRADO NO HAY NADA QUE MOSTRAR.
 * La raya entre «ya salió» y «falta salir» es hoy; en agosto no significa
 * nada. Devuelve null para que la pantalla no tenga que acordarse de
 * esconderlo.
 */
test('en un mes pasado no hay salidas que avisar', function () {
  var u = ayuda.usuario();
  ayuda.mov(u.id, { date: '2026-09-02', amount: -1000, category: 'Super' });
  assert.strictEqual(salidas.delMes(u.id, '2026-09', '2026-10-14'), null);
});

/*
 * LAS PARTES TIENEN QUE SUMAR EL TOTAL, igual que en la deuda. Un número que
 * no cierra con su desglose deja a la persona adivinando.
 */
test('ya salió más falta salir es el total', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 5, due_day: 15, es_default: true });
  ayuda.mov(u.id, { date: '2026-10-03', amount: -40000, category: 'Super' });
  ayuda.mov(u.id, { date: '2026-10-20', amount: -10000, category: 'Servicios' });
  ayuda.mov(u.id, { date: '2026-09-20', amount: -70000, category: 'Super', card_id: t.id });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.yaSalio + s.faltaSalir, s.total);
});

/* ================================================= valuación de títulos == */

/*
 * LOS BONOS COTIZAN CADA 100 NOMINALES, no por unidad.
 *
 * Si tenés 100.000 nominales de AL30 a 84.350 no tenés 8.435 millones. Sin
 * esa división el patrimonio se va 100 veces para arriba.
 */
test('un bono se valúa cada 100 nominales', function () {
  assert.strictEqual(mercado.valuar(100000, 84.35, 100), 84350);
  // Las acciones y los CEDEARs sí van por unidad.
  assert.strictEqual(mercado.valuar(10, 7589.41, 1), 75894.1);
});

/*
 * «ATRASADO» ES POR LA FECHA, NO POR EL MES.
 *
 * Un resumen que venció el 10 y hoy es 14 está atrasado, aunque venza este
 * mismo mes. Es lo único accionable de toda la tarjeta, así que tiene que
 * decirse así y no como «falta».
 */
test('un resumen que venció hace cuatro días ya está atrasado', function () {
  var u = ayuda.usuario();
  var t = ayuda.tarjeta(u.id, { close_day: 28, due_day: 10, es_default: true });
  // Cae en el resumen que cerró el 28 de septiembre y venció el 10 de octubre.
  ayuda.mov(u.id, { date: '2026-09-20', amount: -66000, category: 'Super', card_id: t.id });

  var s = salidas.delMes(u.id, '2026-10', '2026-10-14');
  assert.strictEqual(s.faltaSalir, 66000);
  assert.strictEqual(s.atrasado, 66000, 'venció el 10, hoy es 14');
  assert.ok(s.resumenes[0].atrasado);

  // Y el mismo resumen, mirado antes de que venza, no está atrasado.
  var antes = salidas.delMes(u.id, '2026-10', '2026-10-05');
  assert.strictEqual(antes.atrasado, 0, 'el 5 todavía no vencía');
  assert.strictEqual(antes.faltaSalir, 66000, 'pero igual tiene que salir');
});
