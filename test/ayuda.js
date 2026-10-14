/**
 * Base de prueba, aislada de la de verdad.
 *
 * Esto se requiere PRIMERO en cada archivo de test, antes que cualquier cosa
 * que toque `db.js`: `db.js` abre el archivo en el momento en que se lo
 * requiere, leyendo DATA_DIR y DB_FILE del entorno. Si se pide después, ya es
 * tarde y los tests escribirían en la base real.
 *
 * `node --test` corre cada archivo en su propio proceso, así que cada uno
 * tiene su base y no se pisan entre ellos.
 *
 * El bot va con token vacío a propósito: Telegram admite UN solo lector por
 * token, y un bot de test le robaría los mensajes al de producción. Un gasto
 * podría terminar en la base equivocada. Ya pasó.
 */
var fs = require('fs');
var os = require('os');
var path = require('path');

var DIR = path.join(os.tmpdir(), 'manguito-test-' + process.pid);
if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

process.env.DATA_DIR = DIR;
process.env.DB_FILE = 'test.db';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.CMC_API_KEY = '';

var db_module = require('../server/db.js');
var db = db_module.db;
db_module.initDB();

var auth = require('../server/auth.js');
var cuentas = require('../server/cuentas.js');

/** Deja la base como recién nacida, menos el esquema. */
function limpiar() {
  [
    'transactions', 'transaction_items', 'card_payments', 'cards', 'accounts',
    'portfolio_assets', 'budgets', 'goals', 'subscriptions', 'sessions',
    'learned_categories', 'alerts_sent', 'achievements', 'user_stats', 'animal_names', 'users'
  ].forEach(function (t) {
    try { db.prepare('DELETE FROM ' + t).run(); } catch (err) { /* puede no existir */ }
  });
}

/** Un usuario con su cuenta principal, que es como arranca cualquiera. */
function usuario(nombre) {
  var u = auth.crearUsuario({
    username: nombre || 'test',
    password: 'prueba1234',
    displayName: 'Test',
    isAdmin: true
  });
  cuentas.asegurarPrincipal(u.id);
  return u;
}

/**
 * Un movimiento. Positivo entra, negativo sale.
 * Por defecto cae en la cuenta principal, como en la app.
 */
function mov(userId, datos) {
  var cuenta = datos.account_id === null
    ? null
    : (datos.account_id || (cuentas.principal(userId) || {}).id);

  var info = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    ' account_id, card_id, asset_id, transfer_group, installment_num, installment_total)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    userId,
    datos.date,
    datos.description || 'test',
    datos.amount,
    datos.category || 'Otros',
    datos.platform || 'test',
    cuenta,
    datos.card_id || null,
    datos.asset_id || null,
    datos.transfer_group || null,
    datos.installment_num || null,
    datos.installment_total || null
  );
  return info.lastInsertRowid;
}

/** Una tarjeta con su día de cierre y de vencimiento. */
function tarjeta(userId, datos) {
  var info = db.prepare(
    'INSERT INTO cards (user_id, name, last4, color, limit_amount, close_day, due_day, es_default)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    userId,
    datos.name || 'Visa',
    datos.last4 || '1234',
    '#EE8A17',
    datos.limit_amount || 0,
    datos.close_day,
    datos.due_day,
    datos.es_default ? 1 : 0
  );
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(info.lastInsertRowid);
}

/** Una cuenta aparte de la principal. */
function cuenta(userId, nombre, tipo) {
  var info = db.prepare(
    'INSERT INTO accounts (user_id, name, tipo, es_default) VALUES (?, ?, ?, 0)'
  ).run(userId, nombre, tipo);
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = {
  db: db,
  DIR: DIR,
  limpiar: limpiar,
  usuario: usuario,
  mov: mov,
  tarjeta: tarjeta,
  cuenta: cuenta
};
