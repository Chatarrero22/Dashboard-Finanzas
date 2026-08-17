/**
 * Entiende la plata como se habla en Argentina.
 *
 *   "5 lucas"        -> 5000
 *   "20 mangos"      -> 20
 *   "un palo y medio"-> 1500000
 *   "2.500,50"       -> 2500.5
 *   "15k"            -> 15000
 *   "tres lucas"     -> 3000
 */

var MULTIPLICADORES = [
  { palabras: ['palo', 'palos', 'millon', 'millones', 'm'], factor: 1000000 },
  { palabras: ['luca', 'lucas', 'mil', 'k'], factor: 1000 },
  { palabras: ['mango', 'mangos', 'peso', 'pesos', 'gamba', 'gambas'], factor: 1 }
];

var NUMEROS_ESCRITOS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40,
  cincuenta: 50, cien: 100, ciento: 100, doscientos: 200, quinientos: 500,
  medio: 0.5, media: 0.5
};

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** "1.234,56" (formato argentino) o "1234.56" -> 1234.56 */
function numeroSuelto(token) {
  var s = String(token).replace(/[^0-9.,]/g, '');
  if (!s) return null;
  if (s.indexOf(',') !== -1 && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');            // 1.234.567
  } else if (/^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace('.', '');               // 15.400 son quince mil, no 15,4
  } else {
    s = s.replace(/,/g, '');
  }
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Busca un monto dentro de una frase.
 * Devuelve { monto, resto } donde "resto" es la frase sin la parte del monto,
 * para usarla como descripcion. Si no encuentra nada, devuelve null.
 */
function extraerMonto(frase) {
  var original = String(frase || '').trim();
  var texto = normalizar(original);
  var tokens = texto.split(/\s+/);

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    // Caso "15k", "15lucas", "2palos" (todo pegado)
    var pegado = token.match(/^([+-]?[\d.,]+)\s*(k|lucas?|palos?|mangos?|millones?|mil)$/);
    if (pegado) {
      var base = numeroSuelto(pegado[1]);
      if (base != null) {
        var factor = factorDe(pegado[2]);
        return armar(original, base * factor, [i], token.indexOf('+') === 0);
      }
    }

    var valor = numeroSuelto(token);
    var esPalabra = NUMEROS_ESCRITOS[token] != null;
    if (valor == null && !esPalabra) continue;
    if (valor == null) valor = NUMEROS_ESCRITOS[token];

    // El token siguiente puede ser la unidad: "5 lucas", "2 palos"
    var usados = [i];
    var siguiente = tokens[i + 1];
    var factorSiguiente = siguiente ? factorDe(siguiente) : null;

    if (factorSiguiente) {
      valor = valor * factorSiguiente;
      usados.push(i + 1);

      // "un palo y medio", "2 lucas y media"
      if (tokens[i + 2] === 'y' && /^medi[ao]$/.test(tokens[i + 3] || '')) {
        valor = valor + factorSiguiente / 2;
        usados.push(i + 2, i + 3);
      }
    }

    return armar(original, valor, usados, token.indexOf('+') === 0);
  }

  return null;
}

function factorDe(palabra) {
  var limpia = normalizar(palabra).replace(/[^a-z]/g, '');
  for (var i = 0; i < MULTIPLICADORES.length; i++) {
    if (MULTIPLICADORES[i].palabras.indexOf(limpia) !== -1) return MULTIPLICADORES[i].factor;
  }
  return null;
}

function armar(original, monto, indicesUsados, positivoExplicito) {
  var palabras = original.split(/\s+/);
  var resto = palabras
    .filter(function (_, idx) { return indicesUsados.indexOf(idx) === -1; })
    .join(' ')
    // sacamos preposiciones que quedan colgadas: "gaste en el super" -> "el super"
    .replace(/^\s*(gast[eé]|pagu[eé]|compr[eé]|puse|saqu[eé])\s+/i, '')
    .replace(/^\s*(en|de|por|para|a)\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    monto: monto,
    resto: resto,
    positivoExplicito: Boolean(positivoExplicito)
  };
}

/** Palabras que indican que la plata entra en vez de salir. */
function esIngreso(texto) {
  return /ingreso|cobr[eé]|me pagaron|sueldo|salario|reintegro|devoluc|deposit|entr[oó]|vendi/i.test(String(texto));
}

module.exports = {
  extraerMonto: extraerMonto,
  esIngreso: esIngreso,
  numeroSuelto: numeroSuelto
};
