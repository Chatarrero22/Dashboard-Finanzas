/**
 * El árbol de Manguito.
 *
 * Crece con la experiencia (XP) que vas juntando. La idea es que NO crezca solo
 * por usar la app: la mayor parte de la XP viene de gastar mejor — respetar el
 * presupuesto, cerrar el mes en verde, juntar para una meta, invertir.
 * Anotar gastos suma, pero poco y con tope diario, para que no se pueda inflar
 * cargando cualquier cosa.
 */
var db_module = require('./db.js');
var db = db_module.db;

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function mesDe(fecha) {
  return String(fecha).slice(0, 7);
}

/* ------------------------------------------------------------- las etapas */

/**
 * De semilla a mangal. Cada etapa tiene su emoji y su descripción, y el
 * frontend dibuja el árbol según "stage".
 */
var ETAPAS = [
  { stage: 0, desde: 0,    nombre: 'Semilla',      emoji: '🌰', dice: 'Recién plantada. Empezá a anotar y la vemos crecer.' },
  { stage: 1, desde: 120,  nombre: 'Brote',        emoji: '🌱', dice: 'Asomó. Vas tomando el ritmo.' },
  { stage: 2, desde: 350,  nombre: 'Plantín',      emoji: '🪴', dice: 'Ya tiene hojas. Se nota que estás atento a tus gastos.' },
  { stage: 3, desde: 800,  nombre: 'Arbolito',     emoji: '🌿', dice: 'Está agarrando altura.' },
  { stage: 4, desde: 1600, nombre: 'Árbol',        emoji: '🌳', dice: 'Firme. Tus finanzas tienen raíces.' },
  { stage: 5, desde: 3000, nombre: 'Árbol en flor', emoji: '🌸', dice: 'Floreció. Falta poco para los primeros mangos.' },
  { stage: 6, desde: 5000, nombre: 'Mango',        emoji: '🥭', dice: 'Dio frutos. Estás manejando bien la plata.' },
  { stage: 7, desde: 9000, nombre: 'Mangal',       emoji: '🌴', dice: 'Un mangal entero. Sos de otra categoría.' }
];

function etapaPara(xp) {
  var actual = ETAPAS[0];
  for (var i = 0; i < ETAPAS.length; i++) {
    if (xp >= ETAPAS[i].desde) actual = ETAPAS[i];
  }
  var siguiente = ETAPAS[actual.stage + 1] || null;
  return {
    stage: actual.stage,
    nombre: actual.nombre,
    emoji: actual.emoji,
    dice: actual.dice,
    desde: actual.desde,
    siguiente: siguiente ? { nombre: siguiente.nombre, desde: siguiente.desde } : null,
    // cuánto falta, en porcentaje, para la próxima etapa
    progreso: siguiente
      ? Math.min(((xp - actual.desde) / (siguiente.desde - actual.desde)) * 100, 100)
      : 100
  };
}

/* ------------------------------------------------------------- puntos (XP) */

var PUNTOS = {
  anotar_gasto: 4,          // con tope diario, ver TOPE_DIARIO_ANOTAR
  ticket_foto: 12,          // sacarle la foto al ticket cuesta más que escribir
  racha_dia: 8,             // por cada día seguido usando la app
  sumar_a_meta: 20,
  meta_cumplida: 250,
  presupuesto_respetado: 120, // por categoría, al cerrar el mes sin pasarse
  mes_en_verde: 200,        // gastaste menos de lo que entró
  primera_inversion: 60
};

var TOPE_DIARIO_ANOTAR = 20; // 5 gastos por día como máximo suman

function stats(userId) {
  var s = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  if (!s) {
    db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, 0, 0, 0, ?)')
      .run(userId, '');
    s = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  }
  return s;
}

/** Suma XP y devuelve si subió de etapa. */
function sumarXP(userId, cantidad, motivo) {
  var antes = stats(userId);
  var etapaAntes = etapaPara(antes.xp).stage;

  db.prepare('UPDATE user_stats SET xp = xp + ? WHERE user_id = ?').run(cantidad, userId);

  var despues = stats(userId);
  var etapaDespues = etapaPara(despues.xp).stage;

  return {
    xp: despues.xp,
    ganados: cantidad,
    motivo: motivo || '',
    subioDeEtapa: etapaDespues > etapaAntes,
    etapa: etapaPara(despues.xp)
  };
}

/** Cuánta XP sumó hoy por anotar gastos (para el tope diario). */
function xpDeHoyPorAnotar(userId) {
  var n = db.prepare(
    "SELECT COUNT(*) c FROM transactions WHERE user_id = ? AND date(created_at) = date('now','localtime')"
  ).get(userId).c;
  return n * PUNTOS.anotar_gasto;
}

/* ----------------------------------------------------------------- racha */

/**
 * Actualiza la racha de días seguidos. Devuelve cuántos días lleva y si hoy
 * es un día nuevo (para sumar los puntos una sola vez).
 */
function tocarRacha(userId) {
  var s = stats(userId);
  var h = hoy();
  if (s.last_active === h) return { streak: s.streak, diaNuevo: false };

  var ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var nueva = s.last_active === ayer ? s.streak + 1 : 1;
  var mejor = Math.max(nueva, s.best_streak || 0);

  db.prepare('UPDATE user_stats SET streak = ?, best_streak = ?, last_active = ? WHERE user_id = ?')
    .run(nueva, mejor, h, userId);

  return { streak: nueva, diaNuevo: true, seCorto: s.last_active !== ayer && s.streak > 1 };
}

/* --------------------------------------------------------------- logros */

var LOGROS = {
  primer_gasto:      { nombre: 'El primero',        emoji: '🌱', dice: 'Anotaste tu primer movimiento' },
  racha_7:           { nombre: 'Racha x7',          emoji: '🔥', dice: 'Una semana seguida sin fallar' },
  racha_30:          { nombre: 'Racha x30',         emoji: '💪', dice: 'Un mes entero anotando todo' },
  primera_meta:      { nombre: 'Primera meta',      emoji: '🎯', dice: 'Te pusiste un objetivo de ahorro' },
  meta_cumplida:     { nombre: 'Meta cumplida',     emoji: '🏆', dice: 'Llegaste a una meta completa' },
  mes_en_verde:      { nombre: 'Mes en verde',      emoji: '🟢', dice: 'Cerraste un mes gastando menos de lo que entró' },
  presupuesto_ok:    { nombre: 'Mano firme',        emoji: '🎛️', dice: 'Cerraste un mes sin pasarte de ningún presupuesto' },
  caza_hormigas:     { nombre: 'Caza-hormigas',     emoji: '🐜', dice: 'Anotaste 25 gastos chicos: ahí se va la plata' },
  fotografo:         { nombre: 'Fotógrafo',         emoji: '📸', dice: 'Cargaste 10 tickets con la cámara' },
  inversor:          { nombre: 'Inversor',          emoji: '📈', dice: 'Sumaste tu primera inversión' },
  ordenado:          { nombre: 'Ordenado',          emoji: '🗂️', dice: 'Pusiste presupuesto a 3 categorías' }
};

function tieneLogro(userId, code) {
  return Boolean(db.prepare('SELECT id FROM achievements WHERE user_id = ? AND code = ?').get(userId, code));
}

function darLogro(userId, code) {
  if (!LOGROS[code] || tieneLogro(userId, code)) return null;
  db.prepare('INSERT OR IGNORE INTO achievements (user_id, code) VALUES (?, ?)').run(userId, code);
  return Object.assign({ code: code }, LOGROS[code]);
}

/**
 * Revisa todos los logros que dependen de contar cosas.
 * Devuelve los que se desbloquearon en esta pasada.
 */
function revisarLogros(userId) {
  var nuevos = [];
  function dar(code) { var l = darLogro(userId, code); if (l) nuevos.push(l); }

  var s = stats(userId);
  var tx = db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get(userId).c;
  if (tx >= 1) dar('primer_gasto');

  if (s.streak >= 7 || s.best_streak >= 7) dar('racha_7');
  if (s.streak >= 30 || s.best_streak >= 30) dar('racha_30');

  var metas = db.prepare('SELECT COUNT(*) c FROM goals WHERE user_id = ?').get(userId).c;
  if (metas >= 1) dar('primera_meta');
  var cumplidas = db.prepare('SELECT COUNT(*) c FROM goals WHERE user_id = ? AND done = 1').get(userId).c;
  if (cumplidas >= 1) dar('meta_cumplida');

  // "gastos hormiga": los chicos, que de a uno no se notan
  var chicos = db.prepare(
    'SELECT COUNT(*) c FROM transactions WHERE user_id = ? AND amount < 0 AND ABS(amount) <= 5000'
  ).get(userId).c;
  if (chicos >= 25) dar('caza_hormigas');

  var fotos = db.prepare(
    "SELECT COUNT(*) c FROM transactions t WHERE t.user_id = ? AND t.platform = 'Telegram'" +
    ' AND EXISTS (SELECT 1 FROM transaction_items i WHERE i.transaction_id = t.id)'
  ).get(userId).c;
  if (fotos >= 10) dar('fotografo');

  var activos = db.prepare('SELECT COUNT(*) c FROM portfolio_assets WHERE user_id = ?').get(userId).c;
  if (activos >= 1) dar('inversor');

  var presus = db.prepare('SELECT COUNT(*) c FROM budgets WHERE user_id = ?').get(userId).c;
  if (presus >= 3) dar('ordenado');

  return nuevos;
}

/* ---------------------------------------------------- eventos de la app */

/**
 * Se llama cada vez que se anota un movimiento.
 * Devuelve lo que haya para contarle a la persona (XP, racha, logros).
 */
function alAnotarMovimiento(userId, opciones) {
  opciones = opciones || {};
  var novedades = { xp: 0, logros: [], subioDeEtapa: false, racha: null };

  var racha = tocarRacha(userId);
  if (racha.diaNuevo) {
    var r = sumarXP(userId, PUNTOS.racha_dia, 'racha');
    novedades.xp += PUNTOS.racha_dia;
    novedades.subioDeEtapa = novedades.subioDeEtapa || r.subioDeEtapa;
    novedades.racha = racha.streak;
  }

  // Anotar suma poco y con tope: la idea no es premiar el volumen.
  if (xpDeHoyPorAnotar(userId) <= TOPE_DIARIO_ANOTAR) {
    var puntos = opciones.conFoto ? PUNTOS.ticket_foto : PUNTOS.anotar_gasto;
    var g = sumarXP(userId, puntos, 'anotar');
    novedades.xp += puntos;
    novedades.subioDeEtapa = novedades.subioDeEtapa || g.subioDeEtapa;
  }

  novedades.logros = revisarLogros(userId);
  novedades.etapa = etapaPara(stats(userId).xp);
  return novedades;
}

function alSumarAMeta(userId, completada) {
  var puntos = completada ? PUNTOS.meta_cumplida : PUNTOS.sumar_a_meta;
  var r = sumarXP(userId, puntos, completada ? 'meta cumplida' : 'aporte a meta');
  return { xp: puntos, subioDeEtapa: r.subioDeEtapa, logros: revisarLogros(userId), etapa: r.etapa };
}

function alAgregarInversion(userId) {
  var yaTenia = db.prepare('SELECT COUNT(*) c FROM portfolio_assets WHERE user_id = ?').get(userId).c;
  if (yaTenia > 1) return { xp: 0, logros: revisarLogros(userId) };
  var r = sumarXP(userId, PUNTOS.primera_inversion, 'primera inversión');
  return { xp: PUNTOS.primera_inversion, subioDeEtapa: r.subioDeEtapa, logros: revisarLogros(userId) };
}

/**
 * Premio de fin de mes: se corre una vez al empezar el mes nuevo y evalúa
 * cómo cerró el anterior. Acá está la XP más grande, a propósito.
 */
function cerrarMes(userId, mes) {
  var premios = [];

  if (db.prepare("SELECT id FROM alerts_sent WHERE user_id=? AND kind='cierre' AND ref=?").get(userId, mes)) {
    return premios; // ya se evaluó este mes
  }

  var t = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) entro,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) salio,' +
    ' COUNT(*) n FROM transactions WHERE user_id = ? AND substr(date,1,7) = ?'
  ).get(userId, mes);

  if (t.n === 0) return premios;

  if (t.entro > 0 && t.entro > t.salio) {
    sumarXP(userId, PUNTOS.mes_en_verde, 'mes en verde');
    darLogro(userId, 'mes_en_verde');
    premios.push({ que: 'mes_en_verde', xp: PUNTOS.mes_en_verde });
  }

  var presupuestos = db.prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId);
  var respetados = 0;
  presupuestos.forEach(function (b) {
    var usado = db.prepare(
      'SELECT COALESCE(SUM(ABS(amount)),0) t FROM transactions' +
      ' WHERE user_id = ? AND amount < 0 AND category = ? AND substr(date,1,7) = ?'
    ).get(userId, b.category, mes).t;
    if (usado <= b.monthly_limit) {
      sumarXP(userId, PUNTOS.presupuesto_respetado, 'presupuesto respetado');
      premios.push({ que: 'presupuesto', categoria: b.category, xp: PUNTOS.presupuesto_respetado });
      respetados++;
    }
  });

  if (presupuestos.length > 0 && respetados === presupuestos.length) {
    darLogro(userId, 'presupuesto_ok');
  }

  db.prepare("INSERT OR IGNORE INTO alerts_sent (user_id, kind, ref, sent_on) VALUES (?, 'cierre', ?, ?)")
    .run(userId, mes, hoy());

  return premios;
}

/* ------------------------------------------------------------- resumen */

/** Todo el progreso de una persona, para mostrar en la app o el bot. */
function progreso(userId) {
  var s = stats(userId);
  var etapa = etapaPara(s.xp);

  var logros = db.prepare('SELECT code, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at').all(userId);
  var conseguidos = logros.map(function (l) {
    return Object.assign({ code: l.code, earned_at: l.earned_at }, LOGROS[l.code] || {});
  });

  var pendientes = Object.keys(LOGROS)
    .filter(function (c) { return !logros.some(function (l) { return l.code === c; }); })
    .map(function (c) { return Object.assign({ code: c }, LOGROS[c]); });

  // ¿La racha sigue viva? Si el último día activo no es hoy ni ayer, se cortó.
  var ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var rachaViva = s.last_active === hoy() || s.last_active === ayer;

  return {
    xp: s.xp,
    etapa: etapa,
    racha: rachaViva ? s.streak : 0,
    mejorRacha: s.best_streak,
    rachaHoy: s.last_active === hoy(),
    logros: conseguidos,
    pendientes: pendientes,
    total: Object.keys(LOGROS).length
  };
}

module.exports = {
  ETAPAS: ETAPAS,
  LOGROS: LOGROS,
  PUNTOS: PUNTOS,
  etapaPara: etapaPara,
  progreso: progreso,
  alAnotarMovimiento: alAnotarMovimiento,
  alSumarAMeta: alSumarAMeta,
  alAgregarInversion: alAgregarInversion,
  cerrarMes: cerrarMes,
  revisarLogros: revisarLogros,
  mesDe: mesDe
};
