var fs = require('fs');
var path = require('path');
var Database = require('better-sqlite3');
var getConfig = require('./config.js').getConfig;

var config = getConfig();
var dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

var db = new Database(config.dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/** ¿Existe esa columna en esa tabla? (para migrar bases viejas) */
function tieneColumna(tabla, columna) {
  try {
    return db.prepare('PRAGMA table_info("' + tabla + '")').all()
      .some(function (c) { return c.name === columna; });
  } catch (err) {
    return false;
  }
}

function existeTabla(tabla) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tabla)
  );
}

function initDB() {
  db.exec(`
    -- Cada persona que usa la app. Los datos de uno nunca se cruzan con los del otro.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      simple_ui INTEGER DEFAULT 0,
      telegram_chat_id TEXT,
      link_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sesiones abiertas (la cookie del navegador apunta acá).
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'Otros',
      platform TEXT NOT NULL,
      ai_categorized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity REAL DEFAULT 1,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      plan TEXT,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'Servicios',
      billing_day INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      promo_price REAL DEFAULT 0,
      promo_end TEXT DEFAULT '',
      normal_price REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, category)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      saved REAL DEFAULT 0,
      deadline TEXT DEFAULT '',
      done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Progreso de cada persona: experiencia, racha y arbol.
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_active TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Logros desbloqueados (uno por persona y codigo).
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Avisos ya enviados, para no repetir el mismo aviso dos veces.
    CREATE TABLE IF NOT EXISTS alerts_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      sent_on TEXT NOT NULL,
      UNIQUE (user_id, kind, ref, sent_on)
    );

    -- Lo que Manguito aprende cuando corregís una categoría a mano.
    -- La clave es la descripción normalizada (ver aprendido.js). Va por
    -- persona: lo que para vos es Servicios para otro puede ser otra cosa.
    CREATE TABLE IF NOT EXISTS learned_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clave TEXT NOT NULL,
      category TEXT NOT NULL,
      veces INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, clave)
    );

    CREATE TABLE IF NOT EXISTS portfolio_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      symbol TEXT NOT NULL,
      name TEXT,
      asset_type TEXT DEFAULT 'crypto',
      quantity REAL DEFAULT 0,
      avg_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      real_pnl REAL DEFAULT 0,
      real_pnl_pct REAL DEFAULT 0
    );
  `);

  // Primero las tablas, después las columnas que falten (bases viejas) y solo
  // al final los índices: un índice sobre user_id falla si la columna no existe.
  migrarAMultiusuario();

  db.exec('CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC)');
}

/**
 * Bases creadas antes del login no tienen user_id. Se lo agregamos y le
 * asignamos todo al usuario 1 (el dueño original de esos datos).
 */
function migrarAMultiusuario() {
  ['transactions', 'subscriptions', 'portfolio_assets', 'budgets', 'goals'].forEach(function (tabla) {
    if (!existeTabla(tabla)) return;
    if (tieneColumna(tabla, 'user_id')) return;
    db.exec('ALTER TABLE "' + tabla + '" ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1');
    console.log('  Base migrada: ' + tabla + ' ahora tiene dueño');
  });

  // El presupuesto era unico por categoria; ahora es unico por (usuario, categoria).
  if (existeTabla('budgets')) {
    var indices = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='budgets'").all();
    var viejo = indices.filter(function (i) {
      return i.sql && i.sql.indexOf('category') !== -1 && i.sql.indexOf('user_id') === -1;
    });
    viejo.forEach(function (i) {
      try { db.exec('DROP INDEX IF EXISTS "' + i.name + '"'); } catch (err) { /* ignorar */ }
    });
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_user_cat ON budgets(user_id, category)');
    } catch (err) { /* ya existia */ }
  }
}

module.exports = {
  db: db,
  initDB: initDB,
  config: config,
  tieneColumna: tieneColumna,
  existeTabla: existeTabla
};
