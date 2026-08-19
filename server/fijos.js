/**
 * Gastos fijos: las suscripciones activas se cargan solas como movimiento
 * cuando llega su dia de cobro. Se corre al arrancar y una vez por dia.
 *
 * Nunca duplica: antes de cargar, mira si ya existe ese gasto en ese mes.
 */
var db_module = require('./db.js');
var db = db_module.db;
var prices = require('./prices.js');
var dolares = require('./dolares.js');

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
async function cargarVencidas(userId, fecha, cotizacionForzada) {
  var ahora = fecha || hoy();
  var mes = ym(ahora);
  var diaHoy = ahora.getDate();

  // La cotización se pide UNA vez para todas: si hay cinco suscripciones en
  // dólares, no tiene sentido preguntar cinco veces.
  var cotizacion = cotizacionForzada || 0;
  if (!cotizacion) {
    var hayEnDolares = (userId
      ? db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE active = 1 AND moneda = 'usd' AND user_id = ?").get(userId)
      : db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE active = 1 AND moneda = 'usd'").get()).c;
    if (hayEnDolares) {
      try {
        var d = await prices.getDolar();
        cotizacion = (d.bolsa && d.bolsa.venta) || (d.blue && d.blue.venta) || 0;
      } catch (err) {
        cotizacion = 0;
      }
    }
  }

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
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    " ai_categorized, amount_usd, usd_rate) VALUES (?, ?, ?, ?, ?, 'Fijo', 0, ?, ?)"
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

      // Si la suscripción es en dólares, se pasa a pesos al cambio de HOY.
      // Por eso el importe se guarda en dólares y no en pesos: cada mes te
      // sale distinto y el gasto fijo tiene que decir lo que pagás ahora.
      var enPesos = Math.abs(monto);
      var usd = null;
      var cambio = null;
      if (s.moneda === 'usd') {
        if (!cotizacion) return;  // sin cotización no inventamos: se carga mañana
        usd = Math.abs(monto);
        cambio = cotizacion;
        enPesos = Math.round(usd * cambio);
      }

      var dia = String(Math.min(s.billing_day, 28)).padStart(2, '0');
      insertar.run(
        s.user_id, mes + '-' + dia, s.name, -enPesos, s.category || 'Servicios',
        usd === null ? null : -usd, cambio
      );
      cargadas.push({ name: s.name, amount: enPesos, usd: usd, user_id: s.user_id });
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

/**
 * Arranca el chequeo diario.
 * Es asincrono porque las suscripciones en dolares necesitan la cotizacion.
 */
function iniciar() {
  function correr() {
    return cargarVencidas()   // sin userId = todos
      .then(function (cargadas) {
        if (cargadas.length) {
          console.log('  Gastos fijos cargados: ' + cargadas.map(function (c) { return c.name; }).join(', '));
        }
        return cargadas;
      })
      .catch(function (err) {
        console.error('  Los gastos fijos no se pudieron cargar: ' + err.message);
        return [];
      });
  }

  var promesa = correr();
  // Una vez por dia alcanza.
  var timer = setInterval(correr, 24 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
  return promesa;
}

module.exports = { iniciar: iniciar, cargarVencidas: cargarVencidas, proximas: proximas };
