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

/** Las tarjetas con lo que va gastado en el período abierto. */
function listar(userId, hoy) {
  var filas = db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY id').all(userId);

  return filas.map(function (t) {
    var p = periodoActual(t.close_day, hoy);
    var vence = vencimientoDe(p.cierre, t.due_day);

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
      consumo: consumo.total,
      movimientos: consumo.n,
      // Sin límite cargado no hay porcentaje: mostrar 0% sería mentir.
      pct: t.limit_amount > 0 ? (consumo.total / t.limit_amount) * 100 : null,
      desde: p.desde,
      cierra: aISO(p.cierre),
      cierraTexto: enPalabras(p.cierre),
      diasParaCerrar: Math.max(faltan, 0),
      vence: aISO(vence),
      venceTexto: enPalabras(vence)
    };
  });
}

module.exports = {
  listar: listar,
  periodoActual: periodoActual,
  vencimientoDe: vencimientoDe
};
