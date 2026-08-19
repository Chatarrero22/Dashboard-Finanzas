/**
 * Cómo se escriben las descripciones de los movimientos.
 *
 * Antes se guardaba tal cual lo que entraba: "uade matricula",
 * "uade(educacion) cuota", "NETFLIX", "  cafe  ". Cada movimiento se veía
 * distinto según cómo lo hubieras tecleado ese día.
 *
 * La lógica es una sola y simple:
 *   1. Se limpian los espacios de más y se separan los paréntesis.
 *   2. Las marcas conocidas se escriben como se escriben de verdad
 *      (UADE, Netflix, YPF, MercadoLibre…).
 *   3. Todo lo demás va como una oración: mayúscula sola en la primera letra.
 *
 * Lo que NO hacemos: poner tildes que la persona no escribió ni corregir
 * ortografía. Adivinar el texto de otro es peor que dejarlo como lo escribió.
 */

/* Marcas y nombres propios, con la forma correcta. La clave va en minúscula
   y sin tildes; el valor es cómo se escribe. */
var MARCAS = {
  // Educación
  'uade': 'UADE', 'uba': 'UBA', 'utn': 'UTN', 'uca': 'UCA', 'ucema': 'UCEMA',
  'udesa': 'UdeSA', 'unlp': 'UNLP', 'unsam': 'UNSAM', 'itba': 'ITBA',
  'cbc': 'CBC', 'siglo 21': 'Siglo 21', 'di tella': 'Di Tella',
  'coderhouse': 'CoderHouse', 'digital house': 'Digital House',
  'educacion it': 'Educación IT', 'udemy': 'Udemy', 'platzi': 'Platzi',
  'coursera': 'Coursera', 'duolingo': 'Duolingo', 'domestika': 'Domestika',
  'crehana': 'Crehana',

  // Servicios y suscripciones
  'netflix': 'Netflix', 'spotify': 'Spotify', 'hbo max': 'HBO Max', 'hbo': 'HBO',
  'disney': 'Disney+', 'disney+': 'Disney+', 'youtube': 'YouTube',
  'amazon': 'Amazon', 'prime video': 'Prime Video', 'apple': 'Apple',
  'google': 'Google', 'microsoft': 'Microsoft', 'openai': 'OpenAI',
  'chatgpt': 'ChatGPT', 'claude': 'Claude', 'anthropic': 'Anthropic',
  'edenor': 'Edenor', 'edesur': 'Edesur', 'metrogas': 'Metrogas',
  'aysa': 'AySA', 'personal': 'Personal', 'movistar': 'Movistar',
  'claro': 'Claro', 'fibertel': 'Fibertel', 'telecentro': 'Telecentro',
  'directv': 'DirecTV', 'flow': 'Flow',

  // Supermercados y compras
  'coto': 'Coto', 'disco': 'Disco', 'carrefour': 'Carrefour', 'jumbo': 'Jumbo',
  'vea': 'Vea', 'dia': 'Día', 'chango mas': 'Changomas', 'walmart': 'Walmart',
  'mercadolibre': 'MercadoLibre', 'mercado libre': 'MercadoLibre',
  'mercadopago': 'Mercado Pago', 'mercado pago': 'Mercado Pago',
  'farmacity': 'Farmacity', 'easy': 'Easy', 'sodimac': 'Sodimac',

  // Transporte
  'ypf': 'YPF', 'shell': 'Shell', 'axion': 'Axion', 'puma': 'Puma',
  'sube': 'SUBE', 'uber': 'Uber', 'cabify': 'Cabify', 'didi': 'DiDi',

  // Delivery y comida
  'rappi': 'Rappi', 'pedidosya': 'PedidosYa', 'pedidos ya': 'PedidosYa',
  'mcdonalds': "McDonald's", 'burger king': 'Burger King', 'starbucks': 'Starbucks',
  'mostaza': 'Mostaza', 'havanna': 'Havanna',

  // Salud y otros
  'osde': 'OSDE', 'swiss medical': 'Swiss Medical', 'medicus': 'Medicus',
  'galeno': 'Galeno', 'pami': 'PAMI', 'afip': 'AFIP', 'arba': 'ARBA',
  'agip': 'AGIP', 'anses': 'ANSES',

  // Bancos y billeteras
  'brubank': 'Brubank', 'uala': 'Ualá', 'naranja x': 'Naranja X',
  'galicia': 'Galicia', 'santander': 'Santander', 'bbva': 'BBVA',
  'macro': 'Macro', 'nacion': 'Nación', 'provincia': 'Provincia',
  'binance': 'Binance', 'lemon': 'Lemon', 'belo': 'Belo',
};

function sinTildes(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Las marcas de varias palabras hay que probarlas primero: si buscáramos
   "mercado" antes que "mercado pago", partiríamos el nombre al medio. */
var CLAVES = Object.keys(MARCAS).sort(function (a, b) { return b.length - a.length; });

/**
 * Deja una descripción prolija.
 * Es idempotente: pasarla dos veces da lo mismo que pasarla una.
 */
function ordenarDescripcion(texto) {
  var t = String(texto == null ? '' : texto);

  // 1. Espacios: los de los bordes, los repetidos, y los que faltan alrededor
  //    de un paréntesis ("uade(educacion)" -> "uade (educacion)").
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ') ');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+([,.;:])/g, '$1');

  if (!t) return '';

  // 2. Si vino TODO EN MAYÚSCULAS (típico de los resúmenes del banco), lo
  //    bajamos: si no, el paso siguiente no puede hacer nada con él.
  if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(t)) t = t.toLowerCase();

  // 3. Las marcas conocidas, respetando los límites de palabra.
  var plano = sinTildes(t);
  CLAVES.forEach(function (clave) {
    var desde = 0;
    while (true) {
      var i = plano.indexOf(clave, desde);
      if (i === -1) break;

      var antes = i === 0 ? '' : plano[i - 1];
      var despues = plano[i + clave.length] || '';
      // Solo si es una palabra entera: "dia" no puede pegar dentro de "dias".
      var limpio = /[^a-z0-9]/.test(antes || ' ') && /[^a-z0-9]/.test(despues || ' ');

      if (limpio) {
        var reemplazo = MARCAS[clave];
        t = t.slice(0, i) + reemplazo + t.slice(i + clave.length);
        plano = sinTildes(t);
        desde = i + reemplazo.length;
      } else {
        desde = i + 1;
      }
    }
  });

  // 4. Mayúscula solo en el PRIMER carácter, y solo si es una letra.
  //    Si arranca con un número ("3 dias de estacionamiento") no se toca:
  //    buscar la primera letra en cualquier posición daba "3 Dias".
  //    Tampoco se toca si la primera palabra ya es una marca conocida.
  if (/[a-záéíóúñ]/.test(t[0])) {
    var primeraPalabra = t.split(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9+']/)[0];
    var esMarca = CLAVES.some(function (k) { return MARCAS[k] === primeraPalabra; });
    if (!esMarca) t = t[0].toUpperCase() + t.slice(1);
  }

  return t;
}

module.exports = { ordenarDescripcion: ordenarDescripcion, MARCAS: MARCAS };
