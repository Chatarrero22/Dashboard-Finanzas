/**
 * Entender cuando te estás corrigiendo, en vez de anotar otro gasto.
 *
 * El problema real: escribías "Salida con Martin 30000", después "perdón eran
 * 22 la salida con martin", y el bot anotaba un gasto NUEVO de $22. Peor
 * todavía con "en vez de 30000 eran 22000": agarraba el primer número que veía
 * y guardaba otro gasto de $30.000 con toda la frase como descripción.
 *
 * Acá se detecta que es una corrección y se saca el monto correcto.
 */
var plata = require('./plata.js');

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Frases que por sí solas ya dicen "me estoy corrigiendo".
 */
var FUERTES = [
  /\bperdon\b/, /\bperdona\b/, /\bdisculpa/, /\bme equivoque\b/,
  /\bno,? era[n]?\b/, /\ben realidad\b/, /\ben (?:vez|lugar) de\b/,
  /\bmejor dicho\b/, /\bquise decir\b/, /\bme refiero\b/, /\bcorregi/,
  /\bcambia(le|lo)?\b/, /\bmodifica/, /\bactualiza/, /\bno{2,}\b/,
];

/**
 * "era/eran/son…" sola no alcanza: "era buena la pizza 8000" es un gasto,
 * no una corrección. Solo cuenta si el número viene JUSTO después del verbo.
 */
var VERBO_Y_NUMERO = /\b(?:era|eran|es|son|fue|fueron|van|iban)\s+(?:como\s+)?\$?\s*\d/;

/**
 * ¿Me está corrigiendo el último movimiento?
 * Devuelve { monto } con el monto nuevo, o null si no parece una corrección.
 */
function intencionDeCorregir(texto) {
  var t = normalizar(texto);
  if (!t) return null;

  var señal = FUERTES.some(function (re) { return re.test(t); }) || VERBO_Y_NUMERO.test(t);
  if (!señal) return null;

  // "en vez de 30000 eran 22000" -> el que vale es el SEGUNDO.
  // Este es el caso que más se rompía: el parser agarraba el primero.
  var enVezDe = t.match(/en (?:vez|lugar) de\s+([\d.,]+\s*(?:lucas?|palos?|mil|k)?)\s*(?:eran?|es|son|fue|fueron|iban?)?\s*([\d.,]+\s*(?:lucas?|palos?|mil|k)?)/);
  if (enVezDe && enVezDe[2]) {
    var nuevo = plata.extraerMonto(enVezDe[2]);
    if (nuevo && nuevo.monto) return { monto: Math.abs(nuevo.monto), seguro: true };
  }

  // "eran 22000", "era 22 lucas", "son 5 mil": el número que viene después
  // del verbo es el nuevo.
  var trasVerbo = texto.match(/\b(?:eran?|es|son|fue|fueron|van?|iban?)\s+([^,;]+)/i);
  if (trasVerbo) {
    var m = plata.extraerMonto(trasVerbo[1]);
    if (m && m.monto) return { monto: Math.abs(m.monto), seguro: true };
  }

  // Último recurso: cualquier monto de la frase.
  var suelto = plata.extraerMonto(texto);
  if (suelto && suelto.monto) return { monto: Math.abs(suelto.monto), seguro: false };

  return null;
}

/**
 * ¿El monto que dijo es ambiguo?
 *
 * Si venías de $30.000 y decís "eran 22", casi seguro querías $22.000, no $22.
 * Pero adivinar plata está mal: mejor preguntar. Devuelve las dos opciones
 * cuando hay duda, o null cuando está claro.
 */
function esAmbiguo(montoNuevo, montoAnterior) {
  var nuevo = Math.abs(montoNuevo);
  var anterior = Math.abs(montoAnterior);

  // Solo dudamos si el nuevo es chico y el anterior era de miles para arriba.
  if (nuevo >= 1000 || anterior < 1000) return null;

  // Y solo si multiplicarlo por mil lo deja en el orden del anterior.
  var enMiles = nuevo * 1000;
  if (enMiles < anterior / 20 || enMiles > anterior * 20) return null;

  return { tal_cual: nuevo, en_miles: enMiles };
}

module.exports = {
  intencionDeCorregir: intencionDeCorregir,
  esAmbiguo: esAmbiguo
};
