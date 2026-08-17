/**
 * Gastos fijos: las suscripciones activas se cargan solas como movimiento
 * cuando llega su dia de cobro. Se corre al arrancar y una vez por dia.
 *
 * Nunca duplica: antes de cargar, mira si ya existe ese gasto en ese mes.
 */
var db_module = require('./db.js');
var db = db_module.db;

function hoy() {
  return new Date();
}

function ym(fecha) {
  return fecha.toISOString().slice(0, 7);
}

/**
 * Carga las suscripciones vencidas del mes en curso.
 * Devuelve la lista de las que efectivamente cargo.
 */
function cargarVencidas(userId, fecha) {
  var ahora = fecha || hoy();
  var mes = ym(ahora);
  var diaHoy = ahora.getDate();

  var activas = userId
    ? db.prepare('SELECT * FROM subscriptions WHERE active = 1 AND user_id = ?').all(userId)
    : db.prepare('SELECT * FROM subscriptions WHERE active = 1').all();

  // Ojo: NO filtrar por platform = 'Fijo'. Si el gasto ya está cargado a mano,
  // por Telegram o traído de una migración, igual cuenta como cargado. Filtrar
  // por platform duplicaba las suscripciones todos los meses.
  var yaCargada = db.prepare(
    'SELECT id FROM transactions WHERE user_id = ? AND description = ? AND substr(date,1,7) = ? AND amount < 0'
  );
  var insertar = db.prepare(
    "INSERT INTO transactions (user_id, date, description, amount, category, platform, ai_categorized)" +
    " VALUES (?, ?, ?, ?, ?, 'Fijo', 0)"
  );

  var cargadas = [];

  var run = db.transaction(function () {
    activas.forEach(function (s) {
      if (s.billing_day > diaHoy) return;                    // todavia no le toca este mes
      if (yaCargada.get(s.user_id, s.name, mes)) return;     // ya se cargo

      // Si la promo vencio, se cobra el precio normal.
      var monto = s.amount;
      if (s.promo_end && s.normal_price) {
        var finPromo = new Date(s.promo_end);
        if (!isNaN(finPromo) && finPromo < ahora) monto = s.normal_price;
      }

      var dia = String(Math.min(s.billing_day, 28)).padStart(2, '0');
      insertar.run(s.user_id, mes + '-' + dia, s.name, -Math.abs(monto), s.category || 'Servicios');
      cargadas.push({ name: s.name, amount: monto, user_id: s.user_id });
    });
  });

  run();
  return cargadas;
}

/** Suscripciones que se cobran en los proximos N dias. */
function proximas(userId, dias) {
  var ahora = hoy();
  var diaHoy = ahora.getDate();
  var limite = diaHoy + (dias || 5);

  return db.prepare('SELECT * FROM subscriptions WHERE active = 1 AND user_id = ?').all(userId).filter(function (s) {
    return s.billing_day >= diaHoy && s.billing_day <= limite;
  }).sort(function (a, b) { return a.billing_day - b.billing_day; });
}

/** Arranca el chequeo diario. */
function iniciar() {
  var cargadas = cargarVencidas();   // sin userId = todos
  if (cargadas.length) {
    console.log('  Gastos fijos cargados: ' + cargadas.map(function (c) { return c.name; }).join(', '));
  }
  // Una vez por dia alcanza.
  var timer = setInterval(function () { cargarVencidas(); }, 24 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
  return cargadas;
}

module.exports = { iniciar: iniciar, cargarVencidas: cargarVencidas, proximas: proximas };
