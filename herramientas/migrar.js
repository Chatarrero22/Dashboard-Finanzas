/**
 * Trae los datos de la app vieja (C:\Users\Usuario\emanuel-finance\finance.db)
 * a la base nueva del perfil que se le indique.
 *
 *   node migrar.js                 -> migra al perfil emanuel
 *   node migrar.js --dry           -> solo muestra que haria, no escribe
 *
 * Es idempotente: si un movimiento ya fue migrado (misma fecha, descripcion y
 * monto) no lo duplica, asi que se puede correr mas de una vez sin miedo.
 */
var path = require('path');
var fs = require('fs');
var Database = require('better-sqlite3');

var ORIGEN = process.env.ORIGEN || 'C:\\Users\\Usuario\\emanuel-finance\\finance.db';
var DRY = process.argv.indexOf('--dry') !== -1;

if (!fs.existsSync(ORIGEN)) {
  console.error('No encontre la base vieja en:', ORIGEN);
  process.exit(1);
}

var destino = require('./server/db.js');
destino.initDB();
var dst = destino.db;
var src = new Database(ORIGEN, { readonly: true });

function tablasDe(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(function (r) { return r.name; });
}
function columnasDe(db, tabla) {
  return db.prepare('PRAGMA table_info("' + tabla + '")').all().map(function (c) { return c.name; });
}

var tablasOrigen = tablasDe(src);
var resumen = [];

/* ------------------------------------------------------------ movimientos */

var yaExiste = dst.prepare('SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ?');
var insertTx = dst.prepare(
  'INSERT INTO transactions (date, description, amount, category, platform, ai_categorized, created_at)' +
  ' VALUES (?, ?, ?, ?, ?, ?, ?)'
);
var insertItem = dst.prepare(
  'INSERT INTO transaction_items (transaction_id, description, amount, quantity) VALUES (?, ?, ?, ?)'
);

var txOrigen = src.prepare('SELECT * FROM transactions ORDER BY id ASC').all();
var itemsOrigen = tablasOrigen.indexOf('transaction_items') !== -1
  ? src.prepare('SELECT * FROM transaction_items').all()
  : [];

var itemsPorTx = {};
itemsOrigen.forEach(function (i) {
  if (!itemsPorTx[i.transaction_id]) itemsPorTx[i.transaction_id] = [];
  itemsPorTx[i.transaction_id].push(i);
});

var nuevos = 0;
var repetidos = 0;
var itemsMigrados = 0;

var migrarTx = dst.transaction(function () {
  txOrigen.forEach(function (t) {
    if (yaExiste.get(t.date, t.description, t.amount)) { repetidos++; return; }
    var info = insertTx.run(
      t.date,
      t.description,
      t.amount,
      t.category || 'Otros',
      t.platform || 'Migrado',
      t.ai_categorized ? 1 : 0,
      t.created_at || new Date().toISOString()
    );
    nuevos++;
    (itemsPorTx[t.id] || []).forEach(function (i) {
      insertItem.run(info.lastInsertRowid, i.description, i.amount, i.quantity || 1);
      itemsMigrados++;
    });
  });
});

/* --------------------------------------------------------- suscripciones */

var subsNuevas = 0;
var migrarSubs = dst.transaction(function () {
  if (tablasOrigen.indexOf('subscriptions') === -1) return;
  var cols = columnasDe(src, 'subscriptions');
  var subs = src.prepare('SELECT * FROM subscriptions').all();
  var existe = dst.prepare('SELECT id FROM subscriptions WHERE name = ?');
  var ins = dst.prepare(
    'INSERT INTO subscriptions (name, plan, amount, category, billing_day, active, promo_price, promo_end, normal_price)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  subs.forEach(function (s) {
    if (existe.get(s.name)) return;
    ins.run(
      s.name,
      s.plan || 'Estandar',
      s.amount,
      s.category || 'Servicios',
      s.billing_day || 1,
      s.active == null ? 1 : (s.active ? 1 : 0),
      cols.indexOf('promo_price') !== -1 ? (s.promo_price || s.amount) : s.amount,
      cols.indexOf('promo_end') !== -1 ? (s.promo_end || '') : '',
      cols.indexOf('normal_price') !== -1 ? (s.normal_price || 0) : 0
    );
    subsNuevas++;
  });
});

/* --------------------------------------------------------------- cripto */

var activosNuevos = 0;
var migrarActivos = dst.transaction(function () {
  if (tablasOrigen.indexOf('portfolio_assets') === -1) return;
  var cols = columnasDe(src, 'portfolio_assets');
  var activos = src.prepare('SELECT * FROM portfolio_assets').all();
  var existe = dst.prepare('SELECT id FROM portfolio_assets WHERE symbol = ?');
  var ins = dst.prepare(
    'INSERT INTO portfolio_assets (symbol, name, asset_type, quantity, avg_price, real_pnl, real_pnl_pct) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  activos.forEach(function (a) {
    if (existe.get(a.symbol)) return;
    ins.run(
      a.symbol,
      a.name || a.symbol,
      a.asset_type || 'crypto',
      a.quantity || 0,
      a.avg_price || 0,
      cols.indexOf('real_pnl') !== -1 ? (a.real_pnl || 0) : 0,
      cols.indexOf('real_pnl_pct') !== -1 ? (a.real_pnl_pct || 0) : 0
    );
    activosNuevos++;
  });
});

/* ----------------------------------------------------------------- correr */

console.log('Origen : ' + ORIGEN);
console.log('Destino: ' + destino.config.dbPath);
console.log('');

if (DRY) {
  console.log('Modo prueba: no se escribe nada.');
  console.log('  movimientos en la base vieja: ' + txOrigen.length);
  console.log('  items de tickets:             ' + itemsOrigen.length);
  process.exit(0);
}

migrarTx();
migrarSubs();
migrarActivos();

console.log('Movimientos migrados: ' + nuevos + (repetidos ? '  (ya estaban: ' + repetidos + ')' : ''));
console.log('Items de tickets:     ' + itemsMigrados);
console.log('Suscripciones:        ' + subsNuevas);
console.log('Activos cripto:       ' + activosNuevos);
console.log('');
console.log('Total ahora: ' + dst.prepare('SELECT COUNT(*) c FROM transactions').get().c + ' movimientos');
