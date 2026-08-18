/**
 * Los mismos avisos que manda el bot, pero para mostrarlos en pantalla.
 *
 * ¿Por qué un archivo aparte y no reusar alertas.js? Porque aquellas funciones
 * llaman a esNuevo(), que ADEMÁS de consultar marca el aviso como enviado en
 * alerts_sent. Si la pantalla las usara, abrir "Alertas" apagaría los avisos
 * de Telegram de ese día. Acá se calcula igual pero sin escribir nada.
 *
 * Devuelve objetos {id, ico, tono, titulo, txt} como los espera el diseño.
 */
var db_module = require('./db.js');
var db = db_module.db;

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return '$' + Math.abs(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function diasHastaFinDeMes() {
  var d = new Date();
  var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(ultimo - d.getDate(), 0);
}

/** Gastos fijos que se cobran en los próximos 5 días. */
function fijosQueSeVienen(userId) {
  var dia = new Date().getDate();
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND active = 1')
    .all(userId)
    .filter(function (s) { return s.billing_day >= dia && s.billing_day <= dia + 5; })
    .sort(function (a, b) { return a.billing_day - b.billing_day; })
    .map(function (s) {
      var cuando = s.billing_day === dia ? 'hoy'
        : s.billing_day === dia + 1 ? 'mañana'
        : 'el ' + s.billing_day;
      return {
        id: 'fijo-' + s.id,
        ico: '⟲',
        tono: 'acento',
        titulo: s.name + ' se cobra ' + cuando,
        txt: 'Son ' + money(s.amount) + '. Ya lo tengo contado en los gastos fijos del mes.'
      };
    });
}

/** Presupuestos en amarillo (80%) o rojo (pasado). */
function presupuestosApretados(userId) {
  var mes = hoy().slice(0, 7);
  var quedan = diasHastaFinDeMes();

  return db.prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId)
    .map(function (b) {
      var usado = db.prepare(
        'SELECT COALESCE(SUM(ABS(amount)),0) t FROM transactions' +
        ' WHERE user_id = ? AND amount < 0 AND category = ? AND substr(date,1,7) = ?'
      ).get(userId, b.category, mes).t;

      var pct = b.monthly_limit ? (usado / b.monthly_limit) * 100 : 0;
      if (pct < 80) return null;

      if (pct >= 100) {
        return {
          id: 'presu-' + b.id,
          ico: '◑',
          tono: 'malo',
          titulo: b.category + ' se pasó del tope',
          txt: 'Presupuesto ' + money(b.monthly_limit) + ' · gastado ' + money(usado) +
            ' (' + Math.round(pct) + '%).'
        };
      }
      return {
        id: 'presu-' + b.id,
        ico: '◑',
        tono: 'ojo',
        titulo: 'Vas ' + Math.round(pct) + '% de ' + b.category,
        txt: 'Te quedan ' + money(b.monthly_limit - usado) + ' para ' + quedan + ' días.'
      };
    })
    .filter(Boolean);
}

/** La meta más cercana y cuánto habría que poner por mes. */
function empujonDeMeta(userId) {
  var m = db.prepare('SELECT * FROM goals WHERE user_id = ? AND done = 0 ORDER BY id DESC')
    .get(userId);
  if (!m) return [];

  var falta = Math.max(m.target - m.saved, 0);
  if (falta <= 0) return [];

  var porMes = Math.ceil(falta / 6 / 1000) * 1000;
  var pct = m.target ? Math.round((m.saved / m.target) * 100) : 0;

  return [{
    id: 'meta-' + m.id,
    ico: '◎',
    tono: 'acento',
    titulo: '«' + m.name + '»: vas ' + pct + '%',
    txt: 'Llevás ' + money(m.saved) + ' de ' + money(m.target) + '. Guardando ' +
      money(porMes) + ' por mes la tenés en medio año.'
  }];
}

/** Si la racha está por cortarse hoy. */
function rachaEnRiesgo(userId) {
  var s = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  if (!s || s.streak < 3) return [];

  var ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (s.last_active !== ayer) return [];

  return [{
    id: 'racha',
    ico: '◈',
    tono: 'ojo',
    titulo: 'Llevás ' + s.streak + ' días seguidos',
    txt: 'Anotá algo hoy para no cortar la racha.'
  }];
}

/** Si este mes sale más de lo que entra. */
function mesEnRojo(userId) {
  var mes = hoy().slice(0, 7);
  var t = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) entra,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) sale' +
    ' FROM transactions WHERE user_id = ? AND substr(date,1,7) = ?'
  ).get(userId, mes);

  if (t.sale <= t.entra) return [];

  // Sin ingresos anotados el porcentaje no significa nada: lo decimos distinto.
  var txt = t.entra === 0
    ? 'Este mes no hay ingresos anotados y ya salieron ' + money(t.sale) + '.'
    : 'Entraron ' + money(t.entra) + ' y salieron ' + money(t.sale) +
      '. Vas ' + money(t.sale - t.entra) + ' en rojo.';

  return [{ id: 'rojo-' + mes, ico: '◊', tono: 'malo', titulo: 'Gastás más de lo que entra', txt: txt }];
}

/** Todo junto, lo más urgente primero. */
function paraPantalla(userId) {
  var orden = { malo: 0, ojo: 1, acento: 2 };
  return []
    .concat(mesEnRojo(userId))
    .concat(presupuestosApretados(userId))
    .concat(fijosQueSeVienen(userId))
    .concat(rachaEnRiesgo(userId))
    .concat(empujonDeMeta(userId))
    .sort(function (a, b) { return orden[a.tono] - orden[b.tono]; });
}

module.exports = { paraPantalla: paraPantalla };
