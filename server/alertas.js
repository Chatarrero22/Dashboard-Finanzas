/**
 * Avisos que salen solos.
 *
 * Una vez por día Manguito revisa, para cada persona vinculada a Telegram:
 *   - gastos fijos que se cobran en los próximos días
 *   - presupuestos que están por reventar o ya reventados
 *   - metas que van quedando lejos
 *   - la racha, si está por cortarse
 *
 * Regla de oro: NO molestar. Un solo mensaje por día como máximo, y nunca
 * repetir el mismo aviso (la tabla alerts_sent lleva la cuenta).
 */
var db_module = require('./db.js');
var db = db_module.db;
var arbol = require('./arbol.js');

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return '$' + Math.abs(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

/** ¿Ya le mandé este aviso? Si no, lo marca como enviado. */
function esNuevo(userId, kind, ref) {
  var existe = db.prepare(
    'SELECT id FROM alerts_sent WHERE user_id = ? AND kind = ? AND ref = ?'
  ).get(userId, kind, ref);
  if (existe) return false;
  db.prepare('INSERT OR IGNORE INTO alerts_sent (user_id, kind, ref, sent_on) VALUES (?, ?, ?, ?)')
    .run(userId, kind, ref, hoy());
  return true;
}

/* ------------------------------------------------------- los avisos */

/** Gastos fijos que se cobran en los próximos 3 días. */
function gastosQueSeVienen(userId) {
  var ahora = new Date();
  var dia = ahora.getDate();
  var mes = hoy().slice(0, 7);

  var proximos = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND active = 1').all(userId)
    .filter(function (s) { return s.billing_day >= dia && s.billing_day <= dia + 3; });

  if (proximos.length === 0) return null;
  // uno por suscripción y por mes: no repetimos
  var nuevos = proximos.filter(function (s) { return esNuevo(userId, 'fijo', s.name + '|' + mes); });
  if (nuevos.length === 0) return null;

  var total = nuevos.reduce(function (a, s) { return a + s.amount; }, 0);
  var lineas = nuevos.map(function (s) {
    var cuando = s.billing_day === dia ? 'hoy' : s.billing_day === dia + 1 ? 'mañana' : 'el ' + s.billing_day;
    return '   • ' + s.name + ' · ' + money(s.amount) + ' (' + cuando + ')';
  });

  return '📅 Se te viene:\n' + lineas.join('\n') +
    (nuevos.length > 1 ? '\n\nEn total ' + money(total) + '.' : '');
}

/** Presupuestos en amarillo o rojo. */
function presupuestosApretados(userId) {
  var mes = hoy().slice(0, 7);
  var presupuestos = db.prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId);
  if (presupuestos.length === 0) return null;

  var diasQueQuedan = diasHastaFinDeMes();
  var avisos = [];

  presupuestos.forEach(function (b) {
    var usado = db.prepare(
      'SELECT COALESCE(SUM(ABS(amount)),0) t FROM transactions' +
      ' WHERE user_id = ? AND amount < 0 AND category = ? AND substr(date,1,7) = ?'
    ).get(userId, b.category, mes).t;

    var pct = b.monthly_limit ? (usado / b.monthly_limit) * 100 : 0;
    // Avisamos una vez al cruzar el 80 y otra al pasarse. Nada más.
    var nivel = pct >= 100 ? 'pasado' : pct >= 80 ? 'cerca' : null;
    if (!nivel) return;
    if (!esNuevo(userId, 'presupuesto', b.category + '|' + mes + '|' + nivel)) return;

    if (nivel === 'pasado') {
      avisos.push('🔴 Te pasaste del presupuesto de ' + b.category + ' por ' +
        money(usado - b.monthly_limit) + '.');
    } else {
      avisos.push('🟡 Vas ' + Math.round(pct) + '% de ' + b.category + ' y quedan ' +
        diasQueQuedan + ' días. Te restan ' + money(b.monthly_limit - usado) + '.');
    }
  });

  return avisos.length ? avisos.join('\n') : null;
}

/** Sugerencia para llegar a una meta. */
function empujonDeMeta(userId) {
  var metas = db.prepare('SELECT * FROM goals WHERE user_id = ? AND done = 0 ORDER BY id DESC').all(userId);
  if (metas.length === 0) return null;

  var mes = hoy().slice(0, 7);
  var m = metas[0];
  if (!esNuevo(userId, 'meta', m.id + '|' + mes)) return null;

  var falta = Math.max(m.target - m.saved, 0);
  if (falta <= 0) return null;

  var porMes = Math.ceil(falta / 6 / 1000) * 1000;
  var pct = m.target ? Math.round((m.saved / m.target) * 100) : 0;

  return '🎯 «' + m.name + '»: vas ' + pct + '% (' + money(m.saved) + ' de ' + money(m.target) + ').\n' +
    'Guardando ' + money(porMes) + ' por mes la tenés en medio año.';
}

/** Si la racha está por cortarse. */
function rachaEnRiesgo(userId) {
  var s = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  if (!s || s.streak < 3) return null;

  var ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Si la última actividad fue ayer, hoy todavía no anotó nada
  if (s.last_active !== ayer) return null;
  if (!esNuevo(userId, 'racha', hoy())) return null;

  return '🔥 Llevás ' + s.streak + ' días seguidos. Anotá algo hoy para no cortar la racha.';
}

function diasHastaFinDeMes() {
  var d = new Date();
  var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(ultimo - d.getDate(), 0);
}

/* ------------------------------------------------------------ el envío */

/**
 * Arma el mensaje del día para una persona. Devuelve null si no hay nada
 * que valga la pena contar.
 */
function mensajeDelDia(userId) {
  var partes = [
    gastosQueSeVienen(userId),
    presupuestosApretados(userId),
    empujonDeMeta(userId),
    rachaEnRiesgo(userId)
  ].filter(Boolean);

  if (partes.length === 0) return null;
  return '🥭 Buen día\n\n' + partes.join('\n\n');
}

/**
 * Revisa a todos y manda lo que corresponda.
 * Recibe la función que envía (para poder probarlo sin Telegram).
 */
function revisarYAvisar(enviar) {
  var usuarios = db.prepare(
    'SELECT id, display_name, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL'
  ).all();

  var enviados = 0;

  usuarios.forEach(function (u) {
    try {
      // Antes de avisar, cerramos el mes anterior si quedó pendiente
      // (ahí se reparte la experiencia grande del árbol).
      var mesPasado = new Date();
      mesPasado.setDate(0);
      arbol.cerrarMes(u.id, mesPasado.toISOString().slice(0, 7));

      var texto = mensajeDelDia(u.id);
      if (!texto) return;
      enviar(u.telegram_chat_id, texto);
      enviados++;
    } catch (err) {
      console.error('  Aviso para ' + u.display_name + ' fallo: ' + err.message);
    }
  });

  return enviados;
}

/**
 * Arranca el ciclo diario. Revisa cada hora y solo actúa en la franja
 * elegida (por defecto, a las 10 de la mañana).
 */
function iniciar(enviar, horaDelAviso) {
  var hora = horaDelAviso == null ? 10 : horaDelAviso;
  var ultimoDiaAvisado = '';

  function tic() {
    var ahora = new Date();
    if (ahora.getHours() !== hora) return;
    if (ultimoDiaAvisado === hoy()) return;
    ultimoDiaAvisado = hoy();
    var n = revisarYAvisar(enviar);
    if (n) console.log('  Avisos enviados: ' + n);
  }

  var timer = setInterval(tic, 15 * 60 * 1000); // cada 15 minutos
  if (timer.unref) timer.unref();
  tic();
  return timer;
}

module.exports = {
  iniciar: iniciar,
  revisarYAvisar: revisarYAvisar,
  mensajeDelDia: mensajeDelDia,
  gastosQueSeVienen: gastosQueSeVienen,
  presupuestosApretados: presupuestosApretados,
  empujonDeMeta: empujonDeMeta
};
