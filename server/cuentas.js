/**
 * Dónde está la plata.
 *
 * La app sabía cuánta plata tenías, pero no dónde. Si Cami invierte 300.000 de
 * los 416.000 que hay en su cuenta, eso NO es un gasto: la plata sigue siendo
 * tuya, se movió de lugar. Sin cuentas no había forma de decirlo.
 *
 * Cómo funciona:
 *   - Cada movimiento cae en una cuenta. Si no se dice cuál, va a la principal.
 *   - El saldo de una cuenta es la suma de sus movimientos. No se guarda: así
 *     no puede quedar desincronizado con la realidad.
 *   - Mover plata de una cuenta a otra son DOS movimientos (sale de una, entra
 *     en la otra) con categoría "Traspaso". Se excluyen de ingresos y gastos,
 *     porque no ganaste ni gastaste nada: cambiaste la plata de lugar.
 *
 * Que sean dos filas y no una es a propósito: así la suma de todos los
 * movimientos sigue dando tu plata total, sin que ninguna consulta tenga que
 * saber que existen los traspasos.
 */
var crypto = require('crypto');
var db_module = require('./db.js');
var db = db_module.db;

var TIPOS = {
  gasto: { nombre: 'Para gastar', orden: 1 },
  ahorro: { nombre: 'Ahorro', orden: 2 },
  inversion: { nombre: 'Invertido', orden: 3 }
};

/** La cuenta principal: donde cae todo lo que no dice otra cosa. */
function principal(userId) {
  return db.prepare('SELECT * FROM accounts WHERE user_id = ? AND es_default = 1').get(userId)
    || db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1').get(userId)
    || null;
}

/**
 * Si todavía no hay ninguna cuenta, creamos la principal y le colgamos todo
 * lo que ya estaba cargado. Sin esto, al estrenar la pantalla parecería que
 * no tenés nada.
 */
function asegurarPrincipal(userId) {
  var hay = db.prepare('SELECT COUNT(*) c FROM accounts WHERE user_id = ?').get(userId).c;
  if (hay) return principal(userId);

  var info = db.prepare(
    "INSERT INTO accounts (user_id, name, tipo, color, es_default) VALUES (?, 'Mi plata', 'gasto', '#EE8A17', 1)"
  ).run(userId);

  db.prepare('UPDATE transactions SET account_id = ? WHERE user_id = ? AND account_id IS NULL')
    .run(info.lastInsertRowid, userId);

  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * El saldo de una cuenta: la suma de sus movimientos.
 *
 * Vive en una sola funcion a proposito. Ajustar el saldo real tiene que
 * comparar contra exactamente el mismo numero que muestra la pantalla; si
 * cada lado hiciera su propia cuenta, el ajuste corregiria una diferencia
 * que no existe.
 */
function saldoDe(userId, cuentaId) {
  var base = principal(userId);
  // Los movimientos sin cuenta cuentan para la principal.
  if (base && Number(cuentaId) === base.id) {
    return db.prepare(
      'SELECT COALESCE(SUM(amount),0) t FROM transactions' +
      ' WHERE user_id = ? AND (account_id = ? OR account_id IS NULL)'
    ).get(userId, base.id).t;
  }
  return db.prepare(
    'SELECT COALESCE(SUM(amount),0) t FROM transactions WHERE user_id = ? AND account_id = ?'
  ).get(userId, cuentaId).t;
}

/** Las cuentas con su saldo. */
function listar(userId) {
  asegurarPrincipal(userId);

  return db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id').all(userId)
    .map(function (c) {
      var saldo = saldoDe(userId, c.id);

      return {
        id: c.id,
        name: c.name,
        tipo: c.tipo,
        tipoNombre: (TIPOS[c.tipo] || TIPOS.gasto).nombre,
        color: c.color,
        es_default: Boolean(c.es_default),
        saldo: saldo
      };
    })
    .sort(function (a, b) {
      var oa = (TIPOS[a.tipo] || TIPOS.gasto).orden;
      var ob = (TIPOS[b.tipo] || TIPOS.gasto).orden;
      return oa - ob || a.id - b.id;
    });
}

/**
 * Mueve plata de una cuenta a otra.
 * No es un gasto ni un ingreso: son dos movimientos que se anulan entre sí.
 */
function traspasar(userId, desdeId, hastaId, monto, fecha, nota) {
  var importe = Math.abs(Number(monto) || 0);
  if (!importe) throw new Error('Decime cuánta plata querés mover');
  if (Number(desdeId) === Number(hastaId)) throw new Error('Elegí dos cuentas distintas');

  var desde = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(desdeId, userId);
  var hasta = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(hastaId, userId);
  if (!desde || !hasta) throw new Error('No encontré alguna de las dos cuentas');

  var grupo = crypto.randomBytes(8).toString('hex');
  var cuando = fecha || new Date().toISOString().slice(0, 10);
  var texto = nota ? String(nota).trim() : '';

  var insertar = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    " account_id, transfer_group) VALUES (?, ?, ?, ?, 'Traspaso', 'Traspaso', ?, ?)"
  );

  db.transaction(function () {
    insertar.run(userId, cuando, texto || ('A ' + hasta.name), -importe, desde.id, grupo);
    insertar.run(userId, cuando, texto || ('Desde ' + desde.name), importe, hasta.id, grupo);
  })();

  return { grupo: grupo, monto: importe, desde: desde.name, hasta: hasta.name };
}

/**
 * La plata sale de una cuenta para comprar un título.
 *
 * Va UNA sola pata, al revés que `traspasar()`. En un traspaso los pesos
 * siguen siendo pesos y por eso las dos patas se anulan; acá los pesos dejan
 * de serlo y pasan a ser un bono, así que tu plata en cuentas tiene que bajar
 * de verdad. El patrimonio no cambia: el bono aparece del otro lado, valuado
 * a mercado.
 *
 * Categoría 'Traspaso' porque comprar no es gastar.
 */
function pagarInversion(userId, cuentaId, monto, simbolo, assetId, fecha) {
  var importe = Math.abs(Number(monto) || 0);
  if (!importe) return null;

  var cuenta = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(cuentaId, userId);
  if (!cuenta) throw new Error('No encontré esa cuenta');

  db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    " account_id, asset_id) VALUES (?, ?, ?, ?, 'Traspaso', 'Inversion', ?, ?)"
  ).run(
    userId,
    fecha || new Date().toISOString().slice(0, 10),
    'Compra de ' + simbolo,
    -importe,
    cuenta.id,
    assetId
  );

  return { cuenta: cuenta.name, monto: importe };
}

/** Vendiste: la plata vuelve a una cuenta. */
function cobrarInversion(userId, cuentaId, monto, simbolo, fecha) {
  var importe = Math.abs(Number(monto) || 0);
  if (!importe) return null;

  var cuenta = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(cuentaId, userId);
  if (!cuenta) throw new Error('No encontré esa cuenta');

  db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    " account_id) VALUES (?, ?, ?, ?, 'Traspaso', 'Inversion', ?)"
  ).run(
    userId,
    fecha || new Date().toISOString().slice(0, 10),
    'Venta de ' + simbolo,
    importe,
    cuenta.id
  );

  return { cuenta: cuenta.name, monto: importe };
}

/** Deshacer la compra: como si nunca hubieras sacado la plata. */
function deshacerCompra(userId, assetId) {
  return db.prepare('DELETE FROM transactions WHERE user_id = ? AND asset_id = ?')
    .run(userId, assetId).changes;
}

/** ¿Este activo tiene una compra atada a una cuenta? */
function compraDe(userId, assetId) {
  return db.prepare(
    'SELECT t.*, a.name cuenta FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id' +
    ' WHERE t.user_id = ? AND t.asset_id = ?'
  ).get(userId, assetId) || null;
}

module.exports = {
  TIPOS: TIPOS,
  pagarInversion: pagarInversion,
  cobrarInversion: cobrarInversion,
  deshacerCompra: deshacerCompra,
  compraDe: compraDe,
  principal: principal,
  asegurarPrincipal: asegurarPrincipal,
  saldoDe: saldoDe,
  listar: listar,
  traspasar: traspasar
};
