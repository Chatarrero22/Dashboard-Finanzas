/**
 * Cotizaciones del mercado argentino: acciones, CEDEARs, bonos, letras y ONs.
 *
 * La cripto cotiza en dólares en un mercado global; esto es otra cosa. Acá los
 * precios salen de la Bolsa de Buenos Aires, llegan casi siempre EN PESOS y
 * cambian durante la rueda (11 a 17 hs de Argentina). Por eso vive aparte de
 * `prices.js` y no se mezcla con CoinMarketCap.
 *
 * De dónde salen: data912.com, que publica la punta del mercado en vivo. Es
 * pública y no necesita clave, igual que dolarapi. Si se cae, seguimos
 * mostrando lo último que trajimos y avisamos de cuándo es; nunca inventamos
 * un precio.
 *
 * DOS COSAS QUE SE PAGAN CARO SI SE IGNORAN
 *
 * 1. Los bonos, las letras y las ONs cotizan POR CADA 100 NOMINALES, no por
 *    unidad. Si tenés 100.000 nominales de AL30 y el precio dice 118.800, no
 *    tenés 11.880 millones: tenés 118.800.000 / 100 x 1.000 ... o sea,
 *    cantidad x precio / 100. Sin esa división el patrimonio se va 100 veces
 *    para arriba. Las acciones y los CEDEARs sí van por unidad.
 *
 * 2. NO se puede adivinar la moneda por el ticker. La tentación es decir "si
 *    termina en D es en dólares" (AL30 / AL30D / AL30C). Pero YPFD es una
 *    acción en pesos, y entre los CEDEARs hay AMD, HD, MCD, GILD, JD y hasta
 *    una que se llama C. Adivinando, el patrimonio se multiplica o se divide
 *    por mil y nadie se da cuenta. Por eso la moneda la elige la persona al
 *    cargar el activo y se guarda en la base.
 */

var LISTAS = [
  // El orden importa: si un símbolo está en dos listas, gana la primera.
  { ruta: 'arg_stocks', tipo: 'accion', lamina: 1 },
  { ruta: 'arg_cedears', tipo: 'cedear', lamina: 1 },
  { ruta: 'arg_bonds', tipo: 'bono', lamina: 100 },
  { ruta: 'arg_notes', tipo: 'letra', lamina: 100 },
  { ruta: 'arg_corp', tipo: 'on', lamina: 100 }
];

var TIPOS = {
  accion: { nombre: 'Acción argentina', plural: 'Acciones', unidad: 'acciones', lamina: 1 },
  cedear: { nombre: 'CEDEAR', plural: 'CEDEARs', unidad: 'CEDEARs', lamina: 1 },
  bono: { nombre: 'Bono', plural: 'Bonos', unidad: 'nominales', lamina: 100 },
  letra: { nombre: 'Letra', plural: 'Letras', unidad: 'nominales', lamina: 100 },
  on: { nombre: 'Obligación negociable', plural: 'ONs', unidad: 'nominales', lamina: 100 }
};

var TTL_MS = 2 * 60 * 1000;

// Lo último que trajimos. Se guarda aunque el mercado esté cerrado: un precio
// del viernes es un dato real, un cero no.
var cache = { at: 0, datos: null };
var enVuelo = null;

/**
 * El precio de referencia de una especie.
 * Usamos el último operado; si no hubo operaciones (papel ilíquido, mercado
 * recién abierto), el medio entre punta compradora y vendedora.
 */
function precioDe(fila) {
  var ultimo = Number(fila.c) || 0;
  if (ultimo > 0) return ultimo;

  var compra = Number(fila.px_bid) || 0;
  var venta = Number(fila.px_ask) || 0;
  if (compra > 0 && venta > 0) return (compra + venta) / 2;
  return compra || venta || 0;
}

async function traerLista(lista) {
  var res = await fetch('https://data912.com/live/' + lista.ruta, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(lista.ruta + ' respondió ' + res.status);

  var filas = await res.json();
  if (!Array.isArray(filas)) throw new Error(lista.ruta + ' no devolvió una lista');
  return filas;
}

/** Trae las cinco listas y las deja indexadas por símbolo. */
async function refrescar() {
  var resultados = await Promise.all(LISTAS.map(function (lista) {
    return traerLista(lista).then(
      function (filas) { return { lista: lista, filas: filas }; },
      function (err) {
        console.error('Mercado ARG:', err.message);
        return { lista: lista, filas: null };
      }
    );
  }));

  var indice = {};
  var vivas = 0;

  resultados.forEach(function (r) {
    if (!r.filas) return;
    vivas++;
    r.filas.forEach(function (fila) {
      var simbolo = String(fila.symbol || '').toUpperCase().trim();
      if (!simbolo) return;
      // Gana la primera lista que lo tenga.
      if (indice[simbolo]) return;

      var precio = precioDe(fila);
      if (!(precio > 0)) return;

      indice[simbolo] = {
        symbol: simbolo,
        tipo: r.lista.tipo,
        lamina: r.lista.lamina,
        price: precio,
        change24h: fila.pct_change == null ? null : Number(fila.pct_change),
        volumen: Number(fila.v) || 0
      };
    });
  });

  // Si se cayeron las cinco no pisamos lo bueno que teníamos.
  if (!vivas) throw new Error('No respondió ninguna lista del mercado');

  cache = { at: Date.now(), datos: indice };
  return indice;
}

/**
 * El índice completo, refrescado como mucho cada dos minutos.
 * Si falla y ya teníamos algo, devolvemos lo viejo: es preferible un precio de
 * hace un rato (avisando) a una pantalla vacía.
 */
async function indice() {
  if (cache.datos && Date.now() - cache.at < TTL_MS) return cache.datos;

  // Varias pantallas piden a la vez al entrar; que salga una sola request.
  if (!enVuelo) {
    enVuelo = refrescar()
      .catch(function (err) {
        console.error('Mercado ARG:', err.message);
        return cache.datos || {};
      })
      .then(function (datos) { enVuelo = null; return datos; });
  }
  return enVuelo;
}

/** Hace cuántos minutos son los precios que tenemos. Null si nunca trajimos. */
function antiguedadMin() {
  if (!cache.datos) return null;
  return Math.floor((Date.now() - cache.at) / 60000);
}

/**
 * Cotizaciones de los símbolos pedidos: { AL30: {price, change24h, tipo, lamina} }.
 * Los que no existen simplemente no aparecen, y quien llame tiene que
 * bancarse que falten en vez de poner un cero.
 */
async function cotizar(simbolos) {
  var lista = (simbolos || []).filter(Boolean).map(function (s) {
    return String(s).toUpperCase().trim();
  });
  if (!lista.length) return {};

  var todos = await indice();
  var out = {};
  lista.forEach(function (s) {
    if (todos[s]) out[s] = todos[s];
  });
  return out;
}

/**
 * Busca especies por ticker, para el buscador del formulario.
 * Primero las que empiezan con lo tecleado, después las que lo contienen, y
 * dentro de cada grupo las más operadas: si escribís "AL" querés AL30, no una
 * ON que nadie negocia.
 */
async function buscar(texto, tipo, limite) {
  var q = String(texto || '').toUpperCase().trim();
  var todos = await indice();
  var tope = limite || 20;

  var candidatos = Object.keys(todos).map(function (k) { return todos[k]; });
  if (tipo) candidatos = candidatos.filter(function (a) { return a.tipo === tipo; });

  if (q) {
    candidatos = candidatos.filter(function (a) { return a.symbol.indexOf(q) !== -1; });
  }

  candidatos.sort(function (a, b) {
    if (q) {
      var empiezaA = a.symbol.indexOf(q) === 0 ? 0 : 1;
      var empiezaB = b.symbol.indexOf(q) === 0 ? 0 : 1;
      if (empiezaA !== empiezaB) return empiezaA - empiezaB;
    }
    if (b.volumen !== a.volumen) return b.volumen - a.volumen;
    return a.symbol.localeCompare(b.symbol);
  });

  return candidatos.slice(0, tope).map(function (a) {
    return {
      symbol: a.symbol,
      tipo: a.tipo,
      tipoNombre: (TIPOS[a.tipo] || {}).nombre || a.tipo,
      lamina: a.lamina,
      price: a.price,
      change24h: a.change24h
    };
  });
}

/**
 * Cuánto vale tener `cantidad` de una especie a `precio`.
 * Es una sola línea, pero es LA línea: acá vive la división por 100 de los
 * bonos. Que esté en un solo lado es a propósito.
 */
function valuar(cantidad, precio, lamina) {
  return (Number(cantidad) || 0) * (Number(precio) || 0) / (lamina || 1);
}

/** ¿Este tipo de activo lo cotiza el mercado argentino? */
function esArgentino(tipo) {
  return Object.prototype.hasOwnProperty.call(TIPOS, tipo);
}

module.exports = {
  TIPOS: TIPOS,
  cotizar: cotizar,
  buscar: buscar,
  valuar: valuar,
  esArgentino: esArgentino,
  antiguedadMin: antiguedadMin
};
