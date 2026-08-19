/**
 * Login y sesiones.
 *
 * Las contraseñas se guardan hasheadas con scrypt (viene en Node, no hace falta
 * instalar nada) y nunca en texto plano. La sesion es un token random que vive
 * en una cookie httpOnly, asi el JavaScript de la pagina no puede leerla.
 */
var crypto = require('crypto');
var db_module = require('./db.js');
var db = db_module.db;

var DIAS_SESION = 30;

/* ------------------------------------------------------------ contraseñas */

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPassword(password, stored) {
  try {
    var partes = String(stored).split('$');
    if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
    var esperado = Buffer.from(partes[2], 'hex');
    var calculado = crypto.scryptSync(String(password), partes[1], esperado.length);
    // timingSafeEqual evita filtrar informacion por el tiempo de comparacion
    return crypto.timingSafeEqual(esperado, calculado);
  } catch (err) {
    return false;
  }
}

/* --------------------------------------------------------------- usuarios */

function crearUsuario(opciones) {
  var username = String(opciones.username || '').trim().toLowerCase();
  if (!username) throw new Error('Falta el nombre de usuario');
  if (!opciones.password || String(opciones.password).length < 6) {
    throw new Error('La contraseña tiene que tener al menos 6 caracteres');
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    throw new Error('Ya existe un usuario con ese nombre');
  }

  var info = db.prepare(
    'INSERT INTO users (username, display_name, password_hash, is_admin, simple_ui) VALUES (?, ?, ?, ?, ?)'
  ).run(
    username,
    opciones.displayName || opciones.username,
    hashPassword(opciones.password),
    opciones.isAdmin ? 1 : 0,
    // El modo simple se saco: todos ven la app completa.
    0
  );

  return db.prepare('SELECT id, username, display_name, is_admin, simple_ui FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
}

function cambiarPassword(userId, password) {
  if (!password || String(password).length < 6) {
    throw new Error('La contraseña tiene que tener al menos 6 caracteres');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
  // Al cambiar la clave se cierran las sesiones abiertas.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function contarUsuarios() {
  return db.prepare('SELECT COUNT(*) c FROM users').get().c;
}

/* --------------------------------------------------------------- sesiones */

function crearSesion(userId) {
  var token = crypto.randomBytes(32).toString('hex');
  var expira = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expira);
  return { token: token, expiresAt: expira };
}

function usuarioDeSesion(token) {
  if (!token) return null;
  var fila = db.prepare(
    'SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.is_admin, u.simple_ui' +
    ' FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).get(token);

  if (!fila) return null;
  if (new Date(fila.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: fila.id,
    username: fila.username,
    displayName: fila.display_name,
    isAdmin: Boolean(fila.is_admin),
    simpleUi: Boolean(fila.simple_ui)
  };
}

function cerrarSesion(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function limpiarSesionesVencidas() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

/* ------------------------------------------------------------ login/logout */

function login(username, password) {
  var user = db.prepare('SELECT * FROM users WHERE username = ?')
    .get(String(username || '').trim().toLowerCase());

  // Mismo mensaje para usuario inexistente y clave incorrecta: no le decimos
  // a nadie que un usuario existe.
  if (!user || !verifyPassword(password, user.password_hash)) return null;

  var sesion = crearSesion(user.id);
  return {
    session: sesion,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      isAdmin: Boolean(user.is_admin),
      simpleUi: Boolean(user.simple_ui)
    }
  };
}

/* ------------------------------------------------------------- middleware */

function leerCookie(req, nombre) {
  var header = req.headers.cookie;
  if (!header) return null;
  var encontrada = header.split(';').map(function (c) { return c.trim(); })
    .find(function (c) { return c.indexOf(nombre + '=') === 0; });
  return encontrada ? decodeURIComponent(encontrada.slice(nombre.length + 1)) : null;
}

var COOKIE = 'sesion';

/** Deja req.user si hay sesion valida; si no, no corta. */
function opcional(req, res, next) {
  req.user = usuarioDeSesion(leerCookie(req, COOKIE));
  next();
}

/** Corta con 401 si no hay sesion. */
function requerido(req, res, next) {
  req.user = req.user || usuarioDeSesion(leerCookie(req, COOKIE));
  if (!req.user) return res.status(401).json({ error: 'Tenés que entrar con tu usuario' });
  next();
}

/** Solo admin. */
function soloAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Esto lo puede hacer solo el administrador' });
  }
  next();
}

function ponerCookie(res, token, expiresAt) {
  var partes = [
    COOKIE + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=' + new Date(expiresAt).toUTCString()
  ];
  // En el servidor va por https, asi que exigimos cookie segura.
  if (process.env.NODE_ENV === 'production') partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

function borrarCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Max-Age=0');
}

/* ---------------------------------------------- vincular Telegram a usuario */

/** Genera un codigo corto para escribirle al bot y quedar vinculado. */
function generarCodigoVinculo(userId) {
  var codigo = String(crypto.randomInt(100000, 999999));
  db.prepare('UPDATE users SET link_code = ? WHERE id = ?').run(codigo, userId);
  return codigo;
}

/** El bot llama a esto cuando alguien manda "/vincular 123456". */
function vincularTelegram(codigo, chatId) {
  var user = db.prepare('SELECT * FROM users WHERE link_code = ?').get(String(codigo).trim());
  if (!user) return null;
  db.prepare('UPDATE users SET telegram_chat_id = ?, link_code = NULL WHERE id = ?')
    .run(String(chatId), user.id);
  return { id: user.id, displayName: user.display_name };
}

function usuarioPorChatId(chatId) {
  return db.prepare(
    'SELECT id, username, display_name, simple_ui FROM users WHERE telegram_chat_id = ?'
  ).get(String(chatId));
}

module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  crearUsuario: crearUsuario,
  cambiarPassword: cambiarPassword,
  contarUsuarios: contarUsuarios,
  login: login,
  cerrarSesion: cerrarSesion,
  limpiarSesionesVencidas: limpiarSesionesVencidas,
  usuarioDeSesion: usuarioDeSesion,
  opcional: opcional,
  requerido: requerido,
  soloAdmin: soloAdmin,
  ponerCookie: ponerCookie,
  borrarCookie: borrarCookie,
  leerCookie: leerCookie,
  COOKIE: COOKIE,
  generarCodigoVinculo: generarCodigoVinculo,
  vincularTelegram: vincularTelegram,
  usuarioPorChatId: usuarioPorChatId
};
