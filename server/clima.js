/**
 * El clima y la hora del día, para la granja.
 *
 * Emanuel: «la granja va cambiando si es de día, de noche, si llueve». Es el
 * clima DE VERDAD de la ciudad de cada persona, no uno inventado: si en la
 * granja llueve es porque está lloviendo afuera.
 *
 * Sale de Open-Meteo, que es gratis y no pide clave (como dolarapi). Se pide
 * una vez cada 15 minutos por ciudad, no una vez por persona ni por pantalla.
 *
 * SI NO HAY DATO, NO SE INVENTA. Sin clima la granja no muestra ni lluvia ni
 * sol radiante: muestra un cielo neutro y no dice nada abajo. Lo que sí se
 * sabe siempre es la hora, así que la noche y el día andan igual.
 */

// Donde arranca todo el mundo: no sabemos dónde vive cada uno, y pedirle la
// ubicación al celular en una app de plata asusta. Se cambia desde la granja.
var POR_DEFECTO = { nombre: 'Buenos Aires', lat: -34.6037, lon: -58.3816 };

// Argentina, para cuando no hay dato de la ciudad: la hora igual se sabe.
var DESFASE_ARGENTINA = -3 * 60 * 60;
// Y una salida y puesta de sol razonables para el mismo caso.
var SALIDA_TIPICA = 7 * 60;
var PUESTA_TIPICA = 19 * 60 + 30;

var CADA_CUANTO = 15 * 60 * 1000;
// Un dato viejo sirve si la API se cae un rato, pero no para siempre: con
// tres horas de atraso ya puede estar lloviendo donde decíamos sol.
var VIEJO_SIRVE = 3 * 60 * 60 * 1000;

var cache = {};

/*
 * Los códigos del clima (WMO) a lo que dibuja la granja. Son muchos y muy
 * finos; la granja necesita siete.
 */
function estadoDe(codigo) {
  var c = Number(codigo);
  if (!Number.isFinite(c)) return null;
  if (c === 0) return { estado: 'despejado', fuerte: false };
  if (c === 1 || c === 2) return { estado: 'algo-nublado', fuerte: false };
  if (c === 3) return { estado: 'nublado', fuerte: false };
  if (c === 45 || c === 48) return { estado: 'niebla', fuerte: false };
  if (c >= 51 && c <= 57) return { estado: 'llovizna', fuerte: false };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) {
    return { estado: 'lluvia', fuerte: c === 65 || c === 67 || c === 82 };
  }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { estado: 'nieve', fuerte: c === 75 || c === 86 };
  if (c >= 95) return { estado: 'tormenta', fuerte: true };
  return null;
}

// Cómo se dice, abajo del corral.
var FRASES = {
  'despejado': { emoji: '☀️', dice: 'Despejado' },
  'algo-nublado': { emoji: '🌤️', dice: 'Algo nublado' },
  'nublado': { emoji: '☁️', dice: 'Nublado' },
  'niebla': { emoji: '🌫️', dice: 'Hay niebla' },
  'llovizna': { emoji: '🌦️', dice: 'Llovizna' },
  'lluvia': { emoji: '🌧️', dice: 'Llueve' },
  'nieve': { emoji: '🌨️', dice: 'Nieva' },
  'tormenta': { emoji: '⛈️', dice: 'Hay tormenta' }
};

/*
 * Qué momento del día es, en minutos desde la medianoche de esa ciudad.
 *
 * El amanecer y el atardecer duran un rato alrededor de la salida y la
 * puesta del sol, no un minuto: es cuando el cielo se pone rosa.
 */
function momentoDe(minuto, salida, puesta) {
  if (minuto < salida - 40 || minuto > puesta + 40) return 'noche';
  if (minuto < salida + 50) return 'amanecer';
  if (minuto > puesta - 50) return 'atardecer';
  return 'dia';
}

/*
 * Dónde va el sol (o la luna): qué tanto del arco recorrió, de 0 a 1. De día
 * va de la salida a la puesta; de noche, la luna de la puesta a la salida.
 */
function arcoDe(minuto, salida, puesta) {
  if (minuto >= salida && minuto <= puesta) {
    return { astro: 'sol', fraccion: (minuto - salida) / (puesta - salida) };
  }
  var largo = 24 * 60 - (puesta - salida);
  var desde = minuto > puesta ? minuto - puesta : minuto + 24 * 60 - puesta;
  return { astro: 'luna', fraccion: Math.min(Math.max(desde / largo, 0), 1) };
}

/** «06:21» → 381. */
function minutosDe(hora) {
  var m = /T?(\d{2}):(\d{2})/.exec(String(hora || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Qué hora es en esa ciudad, en minutos desde la medianoche. */
function minutoLocal(desfaseSegundos, ahora) {
  var d = new Date((ahora || Date.now()) + desfaseSegundos * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

async function pedir(url) {
  var res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('Open-Meteo respondió ' + res.status);
  return res.json();
}

/** El pronóstico de ahora para ese lugar, con caché de 15 minutos. */
async function datosDe(lugar) {
  var clave = lugar.lat.toFixed(2) + ',' + lugar.lon.toFixed(2);
  var guardado = cache[clave];
  if (guardado && Date.now() - guardado.at < CADA_CUANTO) return guardado.datos;

  try {
    var j = await pedir(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lugar.lat + '&longitude=' + lugar.lon +
      '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m' +
      '&daily=sunrise,sunset&timezone=auto&forecast_days=1'
    );
    var datos = {
      desfase: Number(j.utc_offset_seconds) || 0,
      temperatura: j.current ? j.current.temperature_2m : null,
      codigo: j.current ? j.current.weather_code : null,
      nubes: j.current ? j.current.cloud_cover : null,
      viento: j.current ? j.current.wind_speed_10m : null,
      salida: j.daily && j.daily.sunrise ? minutosDe(j.daily.sunrise[0]) : null,
      puesta: j.daily && j.daily.sunset ? minutosDe(j.daily.sunset[0]) : null
    };
    cache[clave] = { at: Date.now(), datos: datos };
    return datos;
  } catch (err) {
    if (guardado && Date.now() - guardado.at < VIEJO_SIRVE) return guardado.datos;
    return null;
  }
}

function hhmm(minutos) {
  return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
}

/**
 * Lo que necesita la granja para dibujar el cielo.
 *
 * El momento del día se calcula con el reloj de AHORA de esa ciudad, no con
 * la hora del pronóstico: así el sol se mueve aunque el clima venga de la
 * caché, y la noche llega a horario aunque Open-Meteo no conteste.
 */
function armar(lugar, datos, ahora) {
  var desfase = datos ? datos.desfase : DESFASE_ARGENTINA;
  var salida = datos && datos.salida != null ? datos.salida : SALIDA_TIPICA;
  var puesta = datos && datos.puesta != null ? datos.puesta : PUESTA_TIPICA;
  var minuto = minutoLocal(desfase, ahora);
  var est = datos ? estadoDe(datos.codigo) : null;
  var momento = momentoDe(minuto, salida, puesta);

  /*
   * De noche no hay sol. «☀️ Despejado» a las once de la noche lo decía la
   * primera versión, y es el tipo de error que hace dudar de todo lo demás.
   */
  var frase = est ? FRASES[est.estado] : null;
  if (frase && momento === 'noche' && est.estado === 'despejado') frase = { emoji: '🌙', dice: 'Despejado' };
  if (frase && momento === 'noche' && est.estado === 'algo-nublado') frase = { emoji: '☁️', dice: 'Algo nublado' };

  return {
    ciudad: lugar.nombre,
    porDefecto: Boolean(lugar.porDefecto),
    momento: momento,
    arco: arcoDe(minuto, salida, puesta),
    hora: hhmm(minuto),
    salida: hhmm(salida),
    puesta: hhmm(puesta),
    // Sin dato no hay clima: ni lluvia ni sol radiante, y no se dice nada.
    hayDato: Boolean(est),
    estado: est ? est.estado : null,
    fuerte: est ? est.fuerte : false,
    frase: frase,
    temperatura: datos && datos.temperatura != null ? Math.round(datos.temperatura) : null,
    nubes: datos ? datos.nubes : null,
    // Con viento las nubes van más rápido y la lluvia cae torcida.
    ventoso: Boolean(datos && datos.viento >= 30)
  };
}

/** Dónde está esa persona (o Buenos Aires si no lo dijo). */
function lugarDe(usuario) {
  if (usuario && usuario.ciudad && usuario.ciudad_lat != null && usuario.ciudad_lon != null) {
    return { nombre: usuario.ciudad, lat: usuario.ciudad_lat, lon: usuario.ciudad_lon };
  }
  return Object.assign({ porDefecto: true }, POR_DEFECTO);
}

async function climaPara(usuario) {
  var lugar = lugarDe(usuario);
  return armar(lugar, await datosDe(lugar));
}

/**
 * Buscar una ciudad por nombre. Devuelve hasta 5, con provincia y país para
 * poder distinguir: hay un San Martín en cada provincia.
 */
async function buscar(texto) {
  var q = String(texto || '').trim();
  if (q.length < 2) return [];
  var j = await pedir(
    'https://geocoding-api.open-meteo.com/v1/search?count=5&language=es&format=json&name=' +
    encodeURIComponent(q)
  );
  return (j.results || []).map(function (r) {
    return {
      nombre: r.name,
      donde: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude
    };
  });
}

module.exports = {
  POR_DEFECTO: POR_DEFECTO,
  estadoDe: estadoDe,
  momentoDe: momentoDe,
  arcoDe: arcoDe,
  armar: armar,
  lugarDe: lugarDe,
  climaPara: climaPara,
  buscar: buscar,
  // Para las pruebas: empezar sin nada guardado.
  _vaciarCache: function () { cache = {}; }
};
