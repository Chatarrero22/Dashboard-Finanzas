/**
 * Con qué pagaste.
 *
 * Si pagás casi todo con la tarjeta, marcar una por una es imposible. La idea
 * es al revés: hay una tarjeta por defecto y TODO va ahí, salvo que digas que
 * no. Marcás las excepciones, que son pocas.
 *
 * "Coto 15400"            -> va a la tarjeta por defecto
 * "Coto 15400 en efectivo" -> no va a ninguna
 * "Alquiler 300000 transferencia" -> no va a ninguna
 */

/* Formas de decir "esto NO fue con la tarjeta de crédito". */
var SIN_TARJETA = [
  /\befectivo\b/, /\bcash\b/, /\ben mano\b/, /\bplata\b/,
  /\bdebito\b/, /\btarjeta de debito\b/,
  /\btransferencia\b/, /\btransferi\b/, /\bcvu\b/, /\balias\b/,
  /\bdebito automatico\b/
];

/* Y de decir explícitamente que sí. */
var CON_TARJETA = [
  /\bcon (la )?tarjeta\b/, /\bcredito\b/, /\btarjeta de credito\b/,
  /\bvisa\b/, /\bmastercard\b/, /\bamex\b/
];

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Devuelve 'si', 'no' o null (null = no dijo nada, mandan las reglas de arriba).
 */
function loQueDijo(texto) {
  var t = normalizar(texto);
  if (CON_TARJETA.some(function (re) { return re.test(t); })) return 'si';
  if (SIN_TARJETA.some(function (re) { return re.test(t); })) return 'no';
  return null;
}

/**
 * Qué tarjeta le corresponde a un movimiento.
 *
 *   monto      negativo = gasto. Los ingresos nunca llevan tarjeta.
 *   texto      lo que escribió la persona, para buscar "efectivo" y compañía
 *   porDefecto la tarjeta marcada como predeterminada, o null
 *   tarjetas   todas, para poder nombrarlas ("lo pagué con la Naranja")
 *
 * Devuelve el id de la tarjeta o null.
 */
function elegirTarjeta(monto, texto, porDefecto, tarjetas) {
  // Un sueldo o una transferencia que entra no se paga con tarjeta.
  if (Number(monto) >= 0) return null;

  var t = normalizar(texto);

  // Si nombró una tarjeta suya, esa gana sobre todo lo demás.
  var nombrada = (tarjetas || []).find(function (c) {
    var nombre = normalizar(c.name);
    return nombre.length >= 4 && t.indexOf(nombre) !== -1;
  });
  if (nombrada) return nombrada.id;

  var dijo = loQueDijo(texto);
  if (dijo === 'no') return null;
  if (dijo === 'si' && porDefecto) return porDefecto.id;

  // No dijo nada: manda la tarjeta por defecto, si hay.
  return porDefecto ? porDefecto.id : null;
}

module.exports = {
  elegirTarjeta: elegirTarjeta,
  loQueDijo: loQueDijo
};
