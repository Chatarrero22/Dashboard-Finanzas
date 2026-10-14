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
var granjaMod = require('./granja.js');

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

/* ------------------------------------------------------------- la granja */

/** Los nombres que la persona les puso a sus animales: { id: 'Nombre' }. */
function nombresDe(userId) {
  var out = {};
  db.prepare('SELECT animal_id, nombre FROM animal_names WHERE user_id = ?').all(userId)
    .forEach(function (r) { out[r.animal_id] = r.nombre; });
  return out;
}

/** Cuánto cuidó a cada animal y cuándo: { id: { cuidado, comio, ... } }. */
function cuidadosDe(userId) {
  var out = {};
  db.prepare('SELECT * FROM granja_cuidados WHERE user_id = ?').all(userId)
    .forEach(function (r) { out[r.animal_id] = r; });
  return out;
}

/**
 * La canasta: cuánto alimento, jabón y premios tiene. No se guarda, se suma
 * —como el saldo de una cuenta—, así no hay dos números que se contradigan.
 */
function canastaDe(userId) {
  var out = { alimento: 0, jabon: 0, premio: 0 };
  db.prepare('SELECT item, COALESCE(SUM(cantidad),0) n FROM granja_items WHERE user_id = ? GROUP BY item')
    .all(userId).forEach(function (r) { out[r.item] = r.n; });
  return out;
}

/** Anota lo que ganó. Devuelve { item: cantidad } con lo que se dio. */
function darItems(userId, motivo, cosas) {
  var dar = cosas || granjaMod.itemsPor(motivo);
  if (!dar) return {};
  var ins = db.prepare('INSERT INTO granja_items (user_id, item, cantidad, motivo) VALUES (?, ?, ?, ?)');
  Object.keys(dar).forEach(function (item) { ins.run(userId, item, dar[item], motivo); });
  return dar;
}

/*
 * EL PASO DE «CRECEN SOLOS» A «CRECEN SI LOS CUIDÁS».
 *
 * Antes la etapa salía de los puntos. Al cambiar, quien ya tenía una gallina
 * grande no puede encontrarse con un pollito: sería castigarlo por un cambio
 * que no hizo él. Así que la primera vez se anotan los cuidados que
 * corresponden a la etapa que cada animal ya tenía, y se le da una canasta
 * de bienvenida para que pueda probar enseguida.
 *
 * La marca de que ya pasó es la fila de «bienvenida»: se hace una sola vez
 * por persona. Se corre para todos al arrancar el servidor (así nadie queda
 * migrado tarde, con animales que llegaron después y se ganarían la etapa
 * gratis) y además acá, por si alguien entra antes.
 */
var BIENVENIDA = { alimento: 6, jabon: 2, premio: 1 };

function prepararGranja(userId) {
  var ya = db.prepare("SELECT 1 FROM granja_items WHERE user_id = ? AND motivo = 'bienvenida' LIMIT 1").get(userId);
  if (ya) return false;

  var xp = stats(userId).xp;
  var g = granjaMod.granja(xp);
  var poner = db.prepare(
    'INSERT OR IGNORE INTO granja_cuidados (user_id, animal_id, cuidado) VALUES (?, ?, ?)'
  );
  db.transaction(function () {
    g.animales.forEach(function (a) {
      var etapa = granjaMod.etapaPorPuntos(a.id, xp);
      poner.run(userId, a.id, granjaMod.CRECE_CUIDADOS[etapa]);
    });
    darItems(userId, 'bienvenida', BIENVENIDA);
  })();
  return true;
}

function prepararTodas() {
  db.prepare('SELECT id FROM users').all().forEach(function (u) { prepararGranja(u.id); });
}

/** La granja de una persona, con sus nombres, sus cuidados y su canasta. */
function granjaDe(userId) {
  prepararGranja(userId);
  var g = granjaMod.granja(stats(userId).xp, nombresDe(userId), cuidadosDe(userId));
  g.canasta = canastaDe(userId);
  g.items = granjaMod.ITEMS;
  return g;
}

/** Qué llegó entre dos puntajes, con los nombres y cuidados de la persona. */
function novedadesGranja(userId, antes, despues) {
  return granjaMod.novedades(antes, despues, nombresDe(userId), cuidadosDe(userId));
}

/**
 * Cambiarle el nombre a un animal. Vacío vuelve al que le había tocado.
 * Solo a los que ya llegaron: el que viene todavía no es de nadie.
 */
function renombrar(userId, animalId, nombre) {
  var id = Number(animalId);
  var g = granjaDe(userId);
  if (!Number.isInteger(id) || id < 0 || id >= g.total) return null;

  var limpio = granjaMod.limpiarNombre(nombre);
  if (!limpio) {
    db.prepare('DELETE FROM animal_names WHERE user_id = ? AND animal_id = ?').run(userId, id);
  } else {
    db.prepare(
      'INSERT INTO animal_names (user_id, animal_id, nombre) VALUES (?, ?, ?)' +
      ' ON CONFLICT(user_id, animal_id) DO UPDATE SET nombre = excluded.nombre'
    ).run(userId, id, limpio);
  }
  return granjaDe(userId).animales[id];
}

function enHoras(ms) {
  var h = Math.ceil(ms / (60 * 60 * 1000));
  return h <= 1 ? 'en un rato' : 'en ' + h + ' horas';
}

/**
 * Cuidar a un animal: darle de comer, bañarlo, darle un premio o mimarlo.
 *
 * Gasta lo que corresponde de la canasta, le suma cuidados y anota cuándo.
 * Si con eso pasa de etapa, lo dice: es el momento que se festeja.
 *
 * Si no se puede, dice POR QUÉ y qué hacer, no solo «no»: «Pocha ya comió,
 * vuelve a tener hambre en 5 horas» o «No tenés jabón: se gana respetando
 * un presupuesto o sumando a una meta». Es lo que conecta la granja con la
 * plata.
 */
function cuidar(userId, animalId, accion) {
  var a = granjaMod.ACCIONES[accion];
  if (!a) return { error: 'No sé hacer eso', codigo: 400 };

  var g = granjaDe(userId);
  var id = Number(animalId);
  var animal = Number.isInteger(id) ? g.animales[id] : null;
  if (!animal) return { error: 'Ese animal todavía no llegó a tu granja', codigo: 404 };

  if (!animal.puede[accion]) {
    var cuando = enHoras(animal.vuelve[accion]);
    var porque = accion === 'comer'
      ? animal.nombre + ' ya comió. Vuelve a tener hambre ' + cuando + '.'
      : accion === 'banar'
        ? animal.nombre + ' ya se bañó. Se puede bañar de nuevo ' + cuando + '.'
        : animal.nombre + ' ya recibió su premio hoy. Puede recibir otro ' + cuando + '.';
    return { error: porque, codigo: 409 };
  }

  if (a.item && g.canasta[a.item] < 1) {
    var it = granjaMod.ITEMS[a.item];
    return {
      error: 'No tenés ' + it.uno + '. Se gana ' + it.seGana + '.',
      codigo: 409,
      falta: a.item
    };
  }

  var ahora = new Date().toISOString();
  db.transaction(function () {
    if (a.item) {
      db.prepare(
        'INSERT INTO granja_items (user_id, item, cantidad, motivo, animal_id) VALUES (?, ?, -1, ?, ?)'
      ).run(userId, a.item, accion, id);
    }
    db.prepare('INSERT OR IGNORE INTO granja_cuidados (user_id, animal_id, cuidado) VALUES (?, ?, 0)').run(userId, id);
    if (a.suma) {
      db.prepare('UPDATE granja_cuidados SET cuidado = cuidado + ? WHERE user_id = ? AND animal_id = ?')
        .run(a.suma, userId, id);
    }
    if (a.campo) {
      // El nombre de la columna sale de ACCIONES, nunca de lo que manda la
      // pantalla: `accion` ya se validó contra esa lista arriba.
      db.prepare('UPDATE granja_cuidados SET ' + a.campo + ' = ? WHERE user_id = ? AND animal_id = ?')
        .run(ahora, userId, id);
    }
  })();

  var despues = granjaDe(userId).animales[id];
  return {
    accion: accion,
    animal: despues,
    suma: a.suma,
    crecio: despues.etapa > animal.etapa
  };
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
    etapa: etapaPara(despues.xp),
    // La granja sale de los mismos puntos: si cruzaste un umbral, llegó un
    // animal. Y cada logro da además cosas para cuidarlos.
    granja: Object.assign(novedadesGranja(userId, antes.xp, despues.xp), {
      ganados: darItems(userId, motivo)
    })
  };
}

/** Junta lo que pasó en la granja en varias sumas seguidas. */
function juntarGranja(a, b) {
  if (!a) return b || { llegaron: [], crecieron: [], ganados: {} };
  if (!b) return a;
  var ganados = Object.assign({}, a.ganados || {});
  Object.keys(b.ganados || {}).forEach(function (k) { ganados[k] = (ganados[k] || 0) + b.ganados[k]; });
  return {
    llegaron: a.llegaron.concat(b.llegaron),
    // Si en una suma creció y en la siguiente creció otra vez, vale la última.
    crecieron: a.crecieron
      .filter(function (x) { return !b.crecieron.some(function (y) { return y.id === x.id; }); })
      .concat(b.crecieron),
    ganados: ganados
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
  var novedades = { xp: 0, logros: [], subioDeEtapa: false, racha: null, granja: null };

  var racha = tocarRacha(userId);
  if (racha.diaNuevo) {
    var r = sumarXP(userId, PUNTOS.racha_dia, 'racha');
    novedades.xp += PUNTOS.racha_dia;
    novedades.subioDeEtapa = novedades.subioDeEtapa || r.subioDeEtapa;
    novedades.granja = juntarGranja(novedades.granja, r.granja);
    novedades.racha = racha.streak;
  }

  // Anotar suma poco y con tope: la idea no es premiar el volumen.
  if (xpDeHoyPorAnotar(userId) <= TOPE_DIARIO_ANOTAR) {
    var puntos = opciones.conFoto ? PUNTOS.ticket_foto : PUNTOS.anotar_gasto;
    var g = sumarXP(userId, puntos, 'anotar');
    novedades.xp += puntos;
    novedades.subioDeEtapa = novedades.subioDeEtapa || g.subioDeEtapa;
    novedades.granja = juntarGranja(novedades.granja, g.granja);
  }

  novedades.logros = revisarLogros(userId);
  novedades.etapa = etapaPara(stats(userId).xp);
  novedades.granja = juntarGranja(novedades.granja, null);
  return novedades;
}

function alSumarAMeta(userId, completada) {
  var puntos = completada ? PUNTOS.meta_cumplida : PUNTOS.sumar_a_meta;
  var r = sumarXP(userId, puntos, completada ? 'meta cumplida' : 'aporte a meta');
  return { xp: puntos, subioDeEtapa: r.subioDeEtapa, logros: revisarLogros(userId), etapa: r.etapa, granja: r.granja };
}

function alAgregarInversion(userId) {
  var yaTenia = db.prepare('SELECT COUNT(*) c FROM portfolio_assets WHERE user_id = ?').get(userId).c;
  if (yaTenia > 1) {
    // Invertir de nuevo no da puntos, pero sí un premio para la granja: uno
    // por día, para que cargar y borrar un activo no sea una canilla.
    var hoyYa = db.prepare(
      "SELECT 1 FROM granja_items WHERE user_id = ? AND motivo = 'invertir' AND date(creado) = date('now') LIMIT 1"
    ).get(userId);
    var ganados = hoyYa ? {} : darItems(userId, 'invertir');
    return { xp: 0, logros: revisarLogros(userId), granja: { llegaron: [], crecieron: [], ganados: ganados } };
  }
  var r = sumarXP(userId, PUNTOS.primera_inversion, 'primera inversión');
  return { xp: PUNTOS.primera_inversion, subioDeEtapa: r.subioDeEtapa, logros: revisarLogros(userId), granja: r.granja };
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
    total: Object.keys(LOGROS).length,
    // Sin tope: lo que el árbol ya no puede mostrar, lo muestra la granja.
    granja: granjaDe(userId)
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
  granjaDe: granjaDe,
  cuidar: cuidar,
  canastaDe: canastaDe,
  prepararGranja: prepararGranja,
  prepararTodas: prepararTodas,
  novedadesGranja: novedadesGranja,
  renombrar: renombrar,
  mesDe: mesDe
};
