require('dotenv').config();

var CMC_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

var cache = { at: 0, data: {} };
var TTL_MS = 2 * 60 * 1000;

/**
 * Devuelve { BTC: {price, change24h}, ... } para los simbolos pedidos.
 * Si no hay CMC_API_KEY o falla la request, devuelve {} (el front muestra
 * el portfolio sin precios en vez de romperse).
 */
async function getPrices(symbols) {
  var list = (symbols || []).filter(Boolean).map(function (s) { return String(s).toUpperCase(); });
  if (list.length === 0) return {};

  var now = Date.now();
  var cacheHit = now - cache.at < TTL_MS && list.every(function (s) {
    return Object.prototype.hasOwnProperty.call(cache.data, s);
  });
  if (cacheHit) return cache.data;

  if (!process.env.CMC_API_KEY) return {};

  var url = CMC_URL + '?symbol=' + encodeURIComponent(list.join(',')) + '&convert=USD';

  try {
    var res = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
        Accept: 'application/json'
      }
    });
    if (!res.ok) throw new Error('CMC respondio ' + res.status);

    var json = await res.json();
    var out = {};
    Object.keys(json.data || {}).forEach(function (sym) {
      var entry = json.data[sym];

      // Muchos tickers estan repetidos: hay decenas de monedas llamadas "W",
      // "RWA" o "PIXEL". CMC devuelve un array con todas y el orden NO es
      // estable, asi que tomar la primera hacia variar el patrimonio entre
      // una carga y otra. Nos quedamos con la de mayor capitalizacion, que
      // es la moneda de verdad.
      if (Array.isArray(entry)) {
        entry = entry
          .filter(function (c) { return c && c.quote && c.quote.USD; })
          .sort(function (a, b) {
            var rankA = a.cmc_rank == null ? Infinity : a.cmc_rank;
            var rankB = b.cmc_rank == null ? Infinity : b.cmc_rank;
            if (rankA !== rankB) return rankA - rankB;
            return (b.quote.USD.market_cap || 0) - (a.quote.USD.market_cap || 0);
          })[0];
      }

      if (!entry || !entry.quote || !entry.quote.USD) return;
      out[sym] = {
        price: entry.quote.USD.price,
        change24h: entry.quote.USD.percent_change_24h
      };
    });

    cache = { at: now, data: out };
    return out;
  } catch (err) {
    console.error('No se pudieron traer precios:', err.message);
    return {};
  }
}

var dolarCache = { at: 0, data: null };

/** Cotizaciones del dolar (blue / oficial). API publica, no necesita clave. */
async function getDolar() {
  if (dolarCache.data && Date.now() - dolarCache.at < TTL_MS) return dolarCache.data;
  try {
    var res = await fetch('https://dolarapi.com/v1/dolares');
    if (!res.ok) throw new Error('dolarapi respondio ' + res.status);
    var json = await res.json();
    var out = {};
    json.forEach(function (d) {
      out[d.casa] = { compra: d.compra, venta: d.venta, nombre: d.nombre };
    });
    dolarCache = { at: Date.now(), data: out };
    return out;
  } catch (err) {
    console.error('No se pudo traer el dolar:', err.message);
    return dolarCache.data || {};
  }
}

/**
 * El último dólar que trajimos, sin ir a la red.
 *
 * Sirve para los lugares que se llaman todo el tiempo (el dashboard) y no
 * pueden quedarse esperando a una API de afuera. Si todavía no trajimos
 * ninguno devuelve 0, y quien lo use tiene que bancarse eso.
 */
function ultimoDolar() {
  var d = dolarCache.data;
  if (!d) return 0;
  return (d.bolsa && d.bolsa.venta) || (d.blue && d.blue.venta) || 0;
}

module.exports = { getPrices: getPrices, getDolar: getDolar, ultimoDolar: ultimoDolar };
