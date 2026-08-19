require('dotenv').config();
var Anthropic = require('@anthropic-ai/sdk');

var MODEL = 'claude-opus-5';

var CATEGORIES = [
  'Supermercado',
  'Delivery',
  'Transporte',
  'Servicios',
  'Entretenimiento',
  'Salud',
  'Ropa',
  'Educacion',
  'Sueldo',
  'Transferencia',
  'Otros'
];

// Reglas locales: se usan como respaldo si no hay API key o si la llamada falla.
//
// OJO con el orden: se recorre de arriba abajo y gana la PRIMERA que coincide.
// Las palabras se buscan como subcadena sobre el texto normalizado (minúscula,
// sin tildes), así que 'uade' también pega en "UADE CUOTA AGOSTO".
//
// Por eso mismo cuidado con las palabras cortas o ambiguas: 'ub' o 'unc'
// pegarían dentro de cualquier palabra, y 'palermo' es tanto un barrio como
// una universidad. Ante la duda, poné el nombre largo.
var RULES = [
  { cat: 'Supermercado', words: ['disco', 'coto', 'carrefour', 'jumbo', 'dia %', 'vea', 'chango', 'super', 'almacen', 'verduleria', 'carniceria'] },
  { cat: 'Delivery', words: ['rappi', 'pedidos ya', 'pedidosya', 'uber eats', 'mcdonald', 'burger', 'pizza', 'sushi', 'delivery'] },
  { cat: 'Transporte', words: ['uber', 'cabify', 'didi', 'sube', 'taxi', 'ypf', 'shell', 'axion', 'nafta', 'peaje', 'estacionamiento'] },
  { cat: 'Servicios', words: ['netflix', 'spotify', 'hbo', 'disney', 'crunchyrol', 'claude', 'openai', 'edenor', 'edesur', 'metrogas', 'aysa', 'personal', 'movistar', 'claro', 'fibertel', 'telecentro', 'internet', 'luz', 'gas', 'agua', 'seguro', 'abono'] },
  { cat: 'Entretenimiento', words: ['cine', 'teatro', 'bar', 'boliche', 'steam', 'playstation', 'xbox', 'nintendo', 'concierto', 'recital'] },
  { cat: 'Salud', words: ['farmacia', 'osde', 'swiss medical', 'medicus', 'galeno', 'dentista', 'medico', 'laboratorio'] },
  { cat: 'Ropa', words: ['zara', 'adidas', 'nike', 'indumentaria', 'ropa', 'calzado', 'zapatilla'] },
  { cat: 'Educacion', words: [
      'curso', 'universidad', 'facultad', 'instituto', 'colegio', 'escuela',
      'cuota escolar', 'matricula', 'posgrado', 'maestria', 'libreria', 'libro',
      'apunte', 'fotocopia', 'ingles', 'idiomas', 'capacitacion',
      // Universidades e institutos argentinos: es lo que figura en el resumen
      'uade', 'uba', 'utn', 'uca', 'ucema', 'udesa', 'unlp', 'unsam',
      'siglo 21', 'siglo21', 'kennedy', 'austral', 'di tella', 'ditella',
      'maimonides', 'favaloro', 'itba', 'flacso', 'cbc',
      'educacion it', 'educacionit', 'digital house', 'coderhouse',
      // Plataformas
      'udemy', 'platzi', 'coursera', 'domestika', 'crehana', 'duolingo',
      'skillshare', 'edx'
    ] },
  { cat: 'Sueldo', words: ['sueldo', 'salario', 'haberes', 'honorarios', 'factura cobrada'] },
  { cat: 'Transferencia', words: ['transferencia', 'reintegro', 'mercado pago', 'modo', 'cvu', 'plazo fijo', 'devolucion'] }
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function categorizeByRules(description, amount) {
  var desc = normalize(description);
  for (var i = 0; i < RULES.length; i++) {
    for (var j = 0; j < RULES[i].words.length; j++) {
      if (desc.indexOf(RULES[i].words[j]) !== -1) return RULES[i].cat;
    }
  }
  if (Number(amount) > 0) return 'Transferencia';
  return 'Otros';
}

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

function extractJSON(text) {
  var start = text.indexOf('[');
  var end = text.lastIndexOf(']');
  if (start === -1 || end === -1) {
    start = text.indexOf('{');
    end = text.lastIndexOf('}');
  }
  if (start === -1 || end === -1) throw new Error('No se encontro JSON en la respuesta');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Recibe [{date, description, amount}] y devuelve los mismos con
 * {category, ai_categorized} completados.
 */
async function categorizeTransactions(transactions) {
  var list = (transactions || []).map(function (t) {
    return {
      date: t.date || new Date().toISOString().slice(0, 10),
      description: String(t.description || '').trim(),
      amount: Number(t.amount) || 0,
      items: t.items || []
    };
  });

  if (list.length === 0) return [];

  var client = getClient();
  if (!client) {
    return list.map(function (t) {
      t.category = categorizeByRules(t.description, t.amount);
      t.ai_categorized = 0;
      return t;
    });
  }

  var prompt =
    'Categorizá estos movimientos de una cuenta personal argentina.\n' +
    'Categorías válidas (usá exactamente una de estas): ' + CATEGORIES.join(', ') + '.\n' +
    'Montos negativos son gastos, positivos son ingresos.\n' +
    'Nombres argentinos frecuentes: UADE, UBA, UTN, UCA, Siglo 21, Di Tella y ' +
    'CoderHouse son Educacion; Edenor, Edesur, Metrogas y AySA son Servicios; ' +
    'Coto, Disco, Jumbo y Vea son Supermercado; SUBE, YPF y Shell, Transporte.\n' +
    'Si dudás entre una categoría concreta y Otros, elegí la concreta.\n\n' +
    JSON.stringify(list.map(function (t, i) {
      return { i: i, description: t.description, amount: t.amount };
    })) +
    '\n\nRespondé SOLO con un array JSON: [{"i": 0, "category": "..."}, ...]. Sin texto adicional.';

  try {
    var response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    if (response.stop_reason === 'refusal') throw new Error('refusal');

    var text = response.content
      .filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; })
      .join('');

    var parsed = extractJSON(text);
    var byIndex = {};
    parsed.forEach(function (row) { byIndex[row.i] = row.category; });

    return list.map(function (t, i) {
      var cat = byIndex[i];
      if (CATEGORIES.indexOf(cat) === -1) {
        t.category = categorizeByRules(t.description, t.amount);
        t.ai_categorized = 0;
      } else {
        t.category = cat;
        t.ai_categorized = 1;
      }
      return t;
    });
  } catch (err) {
    console.error('Categorizacion con IA fallo, uso reglas locales:', err.message);
    return list.map(function (t) {
      t.category = categorizeByRules(t.description, t.amount);
      t.ai_categorized = 0;
      return t;
    });
  }
}

module.exports = {
  categorizeTransactions: categorizeTransactions,
  categorizeByRules: categorizeByRules,
  CATEGORIES: CATEGORIES,
  MODEL: MODEL,
  getClient: getClient,
  extractJSON: extractJSON
};
