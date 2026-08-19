/**
 * Lo que Manguito aprende de vos.
 *
 * Cuando corregís la categoría de un movimiento, no alcanza con arreglar ese:
 * la próxima vez que escribas lo mismo tiene que acordarse. Acá se guarda esa
 * memoria, separada por persona (lo que para vos es Servicios para otro puede
 * ser otra cosa).
 *
 * Cómo se busca, en este orden:
 *   1. Coincidencia exacta de la clave.
 *   2. Que una clave aprendida aparezca como palabra dentro de lo nuevo:
 *      si enseñaste "expensas", después "expensas agosto" también entra.
 *      Ante varias, gana la más larga (la más específica).
 *
 * Las claves se guardan normalizadas: minúscula, sin tildes, sin números y
 * sin los signos de plata. Así "Expensas $45.000" y "expensas" son lo mismo.
 */
var db_module = require('./db.js');
var db = db_module.db;

/** Deja la descripción en su forma comparable. */
function clave(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Fuera montos y números: "expensas 45000" y "expensas" son lo mismo
    .replace(/[$€]/g, ' ')
    .replace(/\d+([.,]\d+)*/g, ' ')
    // Fuera lo que no sea letra o espacio
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Guarda que para esta persona, este texto va en esta categoría.
 * Si ya existía, le suma una al contador y actualiza la categoría.
 */
function recordar(userId, descripcion, categoria) {
  var k = clave(descripcion);
  // Una clave de una sola letra o vacía no sirve para nada y ensuciaría todo.
  if (k.length < 3) return null;

  db.prepare(
    'INSERT INTO learned_categories (user_id, clave, category, veces, updated_at)' +
    ' VALUES (?, ?, ?, 1, datetime(\'now\'))' +
    ' ON CONFLICT(user_id, clave) DO UPDATE SET' +
    '   category = excluded.category,' +
    '   veces = learned_categories.veces + 1,' +
    '   updated_at = datetime(\'now\')'
  ).run(userId, k, categoria);

  return k;
}

/**
 * Palabras que aparecen en cualquier gasto y no distinguen nada. Si dejáramos
 * que "cuota" o "pago" hagan coincidir, enseñar una cosa contaminaría todas
 * las demás.
 */
var COMUNES = {
  cuota: 1, pago: 1, pagos: 1, mes: 1, mensual: 1, gasto: 1, gastos: 1,
  compra: 1, compras: 1, factura: 1, abono: 1, servicio: 1, servicios: 1,
  para: 1, con: 1, por: 1, del: 1, los: 1, las: 1, una: 1, uno: 1, unos: 1,
  enero: 1, febrero: 1, marzo: 1, abril: 1, mayo: 1, junio: 1, julio: 1,
  agosto: 1, septiembre: 1, setiembre: 1, octubre: 1, noviembre: 1, diciembre: 1,
};

/** Las palabras que de verdad identifican al gasto. */
function significativas(k) {
  return String(k).split(' ').filter(function (p) {
    return p.length >= 4 && !COMUNES[p];
  });
}

/**
 * ¿Ya me enseñaron qué es esto? Devuelve la categoría o null.
 *
 * Primero prueba la coincidencia exacta. Si no, compara las palabras que
 * identifican al gasto: enseñaste "cuota gimnasio megatlon" y después
 * escribís solo "megatlon", tiene que reconocerlo igual. Por eso NO alcanza
 * con ver si una clave está contenida en la otra: hay que mirar las palabras.
 *
 * Gana la que comparte más palabras; a igualdad, la que corregiste más veces.
 */
function recordar_buscar(userId, descripcion) {
  var k = clave(descripcion);
  if (!k) return null;

  var exacta = db.prepare(
    'SELECT category FROM learned_categories WHERE user_id = ? AND clave = ?'
  ).get(userId, k);
  if (exacta) return exacta.category;

  var palabras = significativas(k);
  if (palabras.length === 0) return null;

  var todas = db.prepare(
    'SELECT clave, category, veces FROM learned_categories WHERE user_id = ?'
  ).all(userId);

  var mejor = null;
  todas.forEach(function (fila) {
    var suyas = significativas(fila.clave);
    var compartidas = suyas.filter(function (p) { return palabras.indexOf(p) !== -1; });
    if (compartidas.length === 0) return;

    if (!mejor ||
        compartidas.length > mejor.compartidas ||
        (compartidas.length === mejor.compartidas && fila.veces > mejor.veces)) {
      mejor = { category: fila.category, compartidas: compartidas.length, veces: fila.veces };
    }
  });

  return mejor ? mejor.category : null;
}

/** Lo que aprendió hasta ahora, para poder mirarlo y borrarlo. */
function listar(userId) {
  return db.prepare(
    'SELECT id, clave, category, veces, updated_at FROM learned_categories' +
    ' WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId);
}

function olvidar(userId, id) {
  return db.prepare('DELETE FROM learned_categories WHERE id = ? AND user_id = ?')
    .run(id, userId).changes > 0;
}

module.exports = {
  clave: clave,
  recordar: recordar,
  buscar: recordar_buscar,
  listar: listar,
  olvidar: olvidar
};
