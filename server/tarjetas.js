/**
 * Tarjetas de crédito.
 *
 * Lo único que se guarda es la tarjeta: nombre, últimos cuatro números, límite
 * y qué día cierra y vence. El consumo NO se guarda, se calcula sumando los
 * movimientos que tienen esa card_id. Así nunca queda desincronizado.
 *
 * Ojo con el período: el resumen de una tarjeta no va del 1 al 31, va de un
 * cierre al siguiente. Si cierra el 28 y hoy es 5 de septiembre, lo que estás
 * gastando entra en el resumen que cierra el 28 de septiembre, y lo del 20 de
 * agosto ya cerró.
 */
var db_module = require('./db.js');
var db = db_module.db;

var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function aISO(d) {
  return d.toISOString().slice(0, 10);
}

/** El día `dia` de ese mes, sin pasarse si el mes es más corto (31 en febrero). */
function diaDelMes(anio, mes, dia) {
  var ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(dia, ultimo));
}

/**
 * El período de resumen que está abierto hoy: desde el cierre anterior
 * (sin incluirlo) hasta el próximo cierre.
 */
function periodoActual(closeDay, hoy) {
  var ahora = hoy ? new Date(hoy) : new Date();
  var y = ahora.getFullYear();
  var m = ahora.getMonth();

  var cierreEste = diaDelMes(y, m, closeDay);
  var proximoCierre, cierreAnterior;

  if (ahora <= cierreEste) {
    proximoCierre = cierreEste;
    cierreAnterior = diaDelMes(y, m - 1, closeDay);
  } else {
    proximoCierre = diaDelMes(y, m + 1, closeDay);
    cierreAnterior = cierreEste;
  }

  // El día siguiente al cierre anterior es el primero del período nuevo.
  var desde = new Date(cierreAnterior);
  desde.setDate(desde.getDate() + 1);

  return { desde: aISO(desde), hasta: aISO(proximoCierre), cierre: proximoCierre };
}

/** El vencimiento que corresponde a ese cierre. */
function vencimientoDe(cierre, dueDay) {
  // Si vence un día anterior al del cierre, es del mes siguiente.
  var mismoMes = diaDelMes(cierre.getFullYear(), cierre.getMonth(), dueDay);
  if (mismoMes >= cierre) return mismoMes;
  return diaDelMes(cierre.getFullYear(), cierre.getMonth() + 1, dueDay);
}

function enPalabras(fecha) {
  return fecha.getDate() + ' de ' + MESES[fecha.getMonth()];
}

/**
 * Los resúmenes que ya cerraron y todavía no marcaste como pagados.
 *
 * Miramos 12 meses para atrás: más que eso, si quedó sin pagar, no es un
 * olvido de la app. Devuelve el más viejo primero.
 */
function resumenesPendientes(userId, tarjeta, hoy) {
  var ahora = hoy ? new Date(hoy) : new Date();
  var abierto = periodoActual(tarjeta.close_day, hoy);
  var pendientes = [];

  var buscarGasto = db.prepare(
    'SELECT COALESCE(SUM(ABS(amount)),0) total, COUNT(*) n FROM transactions' +
    ' WHERE user_id = ? AND card_id = ? AND amount < 0 AND date >= ? AND date <= ?'
  );
  var buscarPago = db.prepare(
    'SELECT * FROM card_payments WHERE card_id = ? AND period_close = ?'
  );

  // Arrancamos en el cierre anterior al período abierto y vamos hacia atrás.
  var cierre = new Date(abierto.cierre);
  cierre = diaDelMes(cierre.getFullYear(), cierre.getMonth() - 1, tarjeta.close_day);

  for (var i = 0; i < 12; i++) {
    var anterior = diaDelMes(cierre.getFullYear(), cierre.getMonth() - 1, tarjeta.close_day);
    var desde = new Date(anterior);
    desde.setDate(desde.getDate() + 1);

    var gasto = buscarGasto.get(userId, tarjeta.id, aISO(desde), aISO(cierre));

    if (gasto.total > 0 && !buscarPago.get(tarjeta.id, aISO(cierre))) {
      var vence = vencimientoDe(cierre, tarjeta.due_day);
      pendientes.push({
        cierre: aISO(cierre),
        cierreTexto: enPalabras(cierre),
        desde: aISO(desde),
        monto: gasto.total,
        movimientos: gasto.n,
        vence: aISO(vence),
        venceTexto: enPalabras(vence),
        vencido: vence < ahora
      });
    }

    cierre = anterior;
  }

  return pendientes.reverse();
}

/**
 * Lo que ya gastaste con tarjeta y TODAVIA NO SALIO de tu cuenta.
 *
 * El gasto se anota el dia de la compra —que es lo correcto para categorias,
 * presupuestos y P&L— pero la plata no se va ese dia: se va cuando pagas el
 * resumen. Sin esta cuenta, el saldo del banco baja apenas comprás y muestra
 * menos de lo que tenés.
 *
 * Emanuel: «lo que pago con tarjeta me esta descontando mi liquidez y no
 * tiene que ser asi». Tenia razon: decia que tenia -$17.019 con $50.000 en el
 * banco.
 *
 * Cuenta como pendiente TODO lo que no este en un resumen ya pagado: el
 * periodo abierto, los resumenes que cerraron y no marcaste, y las cuotas con
 * fecha futura. Se calcula como el total gastado con esa tarjeta menos lo que
 * cae dentro de los resumenes pagados, asi no depende de cuantos meses para
 * atras miremos.
 *
 * Devuelve el total y el desglose por cuenta: la plata vuelve a la cuenta a
 * la que se le habia descontado, no a cualquiera.
 */
function deudaPendiente(userId, rayaForzada) {
  var tarjetas = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(userId);
  var base = db.prepare('SELECT id FROM accounts WHERE user_id = ? AND es_default = 1').get(userId)
    || db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1').get(userId);
  var baseId = base ? base.id : null;

  /*
   * LA RAYA: desde cuando contamos.
   *
   * «Poner el saldo real» es la persona diciendo "esto es lo que tengo HOY".
   * Todo lo de antes ya esta saldado por definicion, lo hayas marcado o no:
   * si pagaste seis resumenes y nunca los marcaste en la app, tu saldo real
   * ya los tiene descontados.
   *
   * Sin esta raya la app sumaba UN AÑO de resumenes ya pagados: a Emanuel le
   * mostro $815.381 de disponible cuando tenia $50.000 en el banco. El
   * mecanismo estaba bien, lo que faltaba era desde donde empezar a contar.
   */
  var raya = rayaForzada || db.prepare(
    "SELECT MAX(date) d FROM transactions WHERE user_id = ? AND category = 'Ajuste'"
  ).get(userId).d || '0000-01-01';

  var gastosDe = db.prepare(
    'SELECT COALESCE(account_id, ?) cuenta, COALESCE(SUM(ABS(amount)),0) total' +
    ' FROM transactions WHERE user_id = ? AND card_id = ? AND amount < 0' +
    ' AND date > ? GROUP BY cuenta'
  );
  var gastosEnRango = db.prepare(
    'SELECT COALESCE(account_id, ?) cuenta, COALESCE(SUM(ABS(amount)),0) total' +
    ' FROM transactions WHERE user_id = ? AND card_id = ? AND amount < 0' +
    ' AND date >= ? AND date <= ? GROUP BY cuenta'
  );
  var pagosDe = db.prepare('SELECT period_close FROM card_payments WHERE user_id = ? AND card_id = ?');

  var porCuenta = {};
  var total = 0;

  function sumar(cuenta, monto) {
    var k = String(cuenta);
    porCuenta[k] = (porCuenta[k] || 0) + monto;
    total += monto;
  }

  tarjetas.forEach(function (t) {
    gastosDe.all(baseId, userId, t.id, raya).forEach(function (r) { sumar(r.cuenta, r.total); });

    // Y le restamos lo que ya pagaste: cada resumen cubre desde el dia
    // siguiente al cierre anterior hasta su propio cierre.
    pagosDe.all(userId, t.id).forEach(function (pago) {
      var cierre = new Date(pago.period_close);
      var anterior = diaDelMes(cierre.getFullYear(), cierre.getMonth() - 1, t.close_day);
      var desde = new Date(anterior);
      desde.setDate(desde.getDate() + 1);

      // Nunca antes de la raya: lo de antes ya no lo estabamos contando.
      var desdeISO = aISO(desde) > raya ? aISO(desde) : raya;
      if (desdeISO >= aISO(cierre)) return;

      gastosEnRango.all(baseId, userId, t.id, desdeISO, aISO(cierre))
        .forEach(function (r) { sumar(r.cuenta, -r.total); });
    });
  });

  return { total: total, porCuenta: porCuenta, desde: raya };
}

/** Las tarjetas con lo que va gastado en el período abierto. */
function listar(userId, hoy) {
  var filas = db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY id').all(userId);

  return filas.map(function (t) {
    var p = periodoActual(t.close_day, hoy);
    var vence = vencimientoDe(p.cierre, t.due_day);
    var pendientes = resumenesPendientes(userId, t, hoy);

    var consumo = db.prepare(
      'SELECT COALESCE(SUM(ABS(amount)),0) total, COUNT(*) n FROM transactions' +
      ' WHERE user_id = ? AND card_id = ? AND amount < 0 AND date >= ? AND date <= ?'
    ).get(userId, t.id, p.desde, p.hasta);

    var faltan = Math.ceil((p.cierre - new Date(aISO(new Date(hoy || Date.now())))) / 86400000);

    return {
      id: t.id,
      name: t.name,
      last4: t.last4 || '',
      color: t.color || '#EE8A17',
      limit_amount: t.limit_amount || 0,
      close_day: t.close_day,
      due_day: t.due_day,
      es_default: Boolean(t.es_default),
      consumo: consumo.total,
      movimientos: consumo.n,
      // Sin límite cargado no hay porcentaje: mostrar 0% sería mentir.
      pct: t.limit_amount > 0 ? (consumo.total / t.limit_amount) * 100 : null,
      desde: p.desde,
      cierra: aISO(p.cierre),
      cierraTexto: enPalabras(p.cierre),
      diasParaCerrar: Math.max(faltan, 0),
      vence: aISO(vence),
      venceTexto: enPalabras(vence),

      // Lo que ya cerró y todavía no pagaste. Esta es la plata que de verdad
      // te va a salir de la cuenta, y que el gasto por fecha de compra no
      // muestra en ningún lado.
      pendientes: pendientes,
      deuda: pendientes.reduce(function (a, r) { return a + r.monto; }, 0),
      aPagar: pendientes.length ? pendientes[pendientes.length - 1] : null,
      vencido: pendientes.some(function (r) { return r.vencido; })
    };
  });
}

/**
 * Marca como pagado un resumen. Ojo: NO crea un movimiento.
 * Las compras de ese resumen ya están cargadas una por una; si además
 * anotáramos el pago, el gasto contaría dos veces.
 */
function pagarResumen(userId, cardId, periodClose, monto, cuando) {
  db.prepare(
    'INSERT INTO card_payments (user_id, card_id, period_close, amount, paid_on)' +
    ' VALUES (?, ?, ?, ?, ?)' +
    ' ON CONFLICT(card_id, period_close) DO UPDATE SET amount = excluded.amount, paid_on = excluded.paid_on'
  ).run(userId, cardId, periodClose, monto, cuando || aISO(new Date()));
}

/** Lo que se viene: cuotas de meses futuros, agrupadas por mes. */
function cuotasQueSeVienen(userId, meses) {
  var cuantos = meses || 12;
  var hoy = aISO(new Date());

  var filas = db.prepare(
    'SELECT date, description, amount, installment_num, installment_total, card_id' +
    ' FROM transactions WHERE user_id = ? AND amount < 0' +
    ' AND installment_total IS NOT NULL AND date > ?' +
    ' ORDER BY date'
  ).all(userId, hoy);

  var porMes = {};
  filas.forEach(function (f) {
    var mes = f.date.slice(0, 7);
    if (!porMes[mes]) porMes[mes] = { mes: mes, total: 0, cuotas: [] };
    porMes[mes].total += Math.abs(f.amount);
    porMes[mes].cuotas.push({
      date: f.date,
      description: f.description,
      monto: Math.abs(f.amount),
      num: f.installment_num,
      de: f.installment_total,
      card_id: f.card_id
    });
  });

  return Object.keys(porMes).sort().slice(0, cuantos).map(function (k) { return porMes[k]; });
}

/** La tarjeta con la que pagas casi todo, o null. */
function porDefecto(userId) {
  return db.prepare('SELECT * FROM cards WHERE user_id = ? AND es_default = 1').get(userId) || null;
}

/** Solo puede haber una predeterminada por persona. */
function marcarPorDefecto(userId, cardId) {
  db.prepare('UPDATE cards SET es_default = 0 WHERE user_id = ?').run(userId);
  if (cardId) db.prepare('UPDATE cards SET es_default = 1 WHERE id = ? AND user_id = ?').run(cardId, userId);
}

function todas(userId) {
  return db.prepare('SELECT id, name FROM cards WHERE user_id = ?').all(userId);
}

module.exports = {
  deudaPendiente: deudaPendiente,
  listar: listar,
  porDefecto: porDefecto,
  marcarPorDefecto: marcarPorDefecto,
  todas: todas,
  periodoActual: periodoActual,
  vencimientoDe: vencimientoDe,
  resumenesPendientes: resumenesPendientes,
  pagarResumen: pagarResumen,
  cuotasQueSeVienen: cuotasQueSeVienen
};
