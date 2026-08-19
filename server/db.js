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

    -- Tarjetas de crédito: para saber cuánto llevás gastado y cuándo cierra.
    -- close_day / due_day son días del mes (28, 10). El consumo NO se guarda:
    -- se calcula sumando los movimientos que tienen esta card_id.
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      last4 TEXT DEFAULT '',
      color TEXT DEFAULT '#EE8A17',
      limit_amount REAL DEFAULT 0,
      close_day INTEGER DEFAULT 1,
      due_day INTEGER DEFAULT 10,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Resúmenes de tarjeta que ya pagaste.
    --
    -- El pago NO se guarda como un movimiento: si lo hiciéramos, contaría dos
    -- veces (las compras del resumen ya están cargadas una por una). Acá solo
    -- anotamos "el resumen que cerró tal día, está pagado".
    CREATE TABLE IF NOT EXISTS card_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      period_close TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_on TEXT NOT NULL,
      UNIQUE (card_id, period_close)
    );

    -- Dónde está la plata: efectivo, banco, la cuenta de alguien, un plazo
    -- fijo. El saldo NO se guarda: es la suma de los movimientos de esa
    -- cuenta, así nunca queda desincronizado.
    --
    -- tipo: 'gasto'      de acá sale el día a día
    --       'ahorro'     apartada, no la tocás
    --       'inversion'  puesta a rendir (plazo fijo, fondo)
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      tipo TEXT DEFAULT 'gasto',
      color TEXT DEFAULT '#EE8A17',
      es_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
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

  // Con qué tarjeta se pagó cada movimiento. Va suelta (sin FOREIGN KEY) para
  // que borrar una tarjeta no se lleve puestos los gastos: los movimientos
  // pasados existieron igual.
  if (!tieneColumna('transactions', 'card_id')) {
    db.exec('ALTER TABLE transactions ADD COLUMN card_id INTEGER');
  }

  // El "modo simple" se saco: escondia secciones que la persona necesitaba
  // (Tarjetas, sin ir mas lejos) y no habia forma de darse cuenta de por que
  // no aparecian. La columna queda porque borrarla en SQLite es un lio, pero
  // no se lee mas y se pone en 0 para que nadie quede a medias.
  if (tieneColumna('users', 'simple_ui')) {
    db.exec('UPDATE users SET simple_ui = 0 WHERE simple_ui = 1');
  }

  // Suscripciones en dólares (Netflix, hosting, ChatGPT...).
  //
  // Acá va distinto que en un gasto suelto: el importe se guarda EN DÓLARES y
  // se convierte cada mes al cambio de ese día. Es lo correcto: una
  // suscripción de US$15 no te sale lo mismo en marzo que en agosto, y
  // congelarla haría que el gasto fijo dijera un número que ya no pagás.
  if (!tieneColumna('subscriptions', 'moneda')) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN moneda TEXT DEFAULT 'ars'");
  }

  // En qué cuenta cayó cada movimiento. Nulo = la cuenta principal, así las
  // bases viejas siguen sumando bien sin tener que tocar nada.
  if (!tieneColumna('transactions', 'account_id')) {
    db.exec('ALTER TABLE transactions ADD COLUMN account_id INTEGER');
    // Las dos patas de un traspaso comparten este grupo.
    db.exec('ALTER TABLE transactions ADD COLUMN transfer_group TEXT');
  }

  // Gastos en dólares.
  //
  // El monto SIEMPRE se guarda en pesos, convertido al cambio del día en que
  // lo cargaste. Es el valor real de lo que pagaste: que el dólar suba después
  // no cambia lo que te salió ese día. Guardamos además cuántos dólares eran y
  // a qué cambio, para poder mostrarlo y para que se pueda auditar.
  if (!tieneColumna('transactions', 'amount_usd')) {
    db.exec('ALTER TABLE transactions ADD COLUMN amount_usd REAL');
    db.exec('ALTER TABLE transactions ADD COLUMN usd_rate REAL');
  }

  // La tarjeta con la que pagás casi todo: los movimientos nuevos van ahí
  // solos y vos marcás las excepciones (efectivo, débito, transferencia).
  if (!tieneColumna('cards', 'es_default')) {
    db.exec('ALTER TABLE cards ADD COLUMN es_default INTEGER DEFAULT 0');
  }

  // Compras en cuotas: cada cuota es una fila con su propia fecha, así cae en
  // el mes que corresponde sin que ninguna consulta tenga que saber de cuotas.
  // Las tres se comparten por grupo para poder borrar el plan entero.
  if (!tieneColumna('transactions', 'installment_group')) {
    db.exec('ALTER TABLE transactions ADD COLUMN installment_group TEXT');
    db.exec('ALTER TABLE transactions ADD COLUMN installment_num INTEGER');
    db.exec('ALTER TABLE transactions ADD COLUMN installment_total INTEGER');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tx_card ON transactions(card_id)');
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
