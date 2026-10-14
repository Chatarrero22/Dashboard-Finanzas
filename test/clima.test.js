/**
 * EL CIELO DE LA GRANJA.
 *
 * Es el clima de verdad de la ciudad de cada persona. Las dos reglas que no
 * se pueden romper: si en la granja llueve es porque llueve afuera, y si no
 * hay dato del clima no se inventa uno.
 *
 * No se llama a Open-Meteo de verdad: se reemplaza `fetch`. Una prueba que
 * depende de internet falla cuando se corta la luz, no cuando se rompe algo.
 */
var test = require('node:test');
var assert = require('node:assert');

var clima = require('../server/clima.js');

var fetchDeVerdad = global.fetch;

/** Hace que Open-Meteo «conteste» esto. */
function openMeteoDice(cuerpo) {
  global.fetch = async function () {
    return { ok: true, json: async function () { return cuerpo; } };
  };
}

function openMeteoSeCae() {
  global.fetch = async function () { throw new Error('sin internet'); };
}

test.beforeEach(function () { clima._vaciarCache(); });
test.after(function () { global.fetch = fetchDeVerdad; });

/** Un pronóstico como el de Open-Meteo, en Buenos Aires (UTC-3). */
function pronostico(codigo, extra) {
  return Object.assign({
    utc_offset_seconds: -3 * 3600,
    current: { temperature_2m: 17.6, weather_code: codigo, cloud_cover: 90, wind_speed_10m: 12 },
    daily: { sunrise: ['2026-10-14T06:12'], sunset: ['2026-10-14T19:07'] }
  }, extra || {});
}

/* ======================================================== el clima ======= */

test('los códigos del clima se traducen a lo que dibuja la granja', function () {
  assert.strictEqual(clima.estadoDe(0).estado, 'despejado');
  assert.strictEqual(clima.estadoDe(2).estado, 'algo-nublado');
  assert.strictEqual(clima.estadoDe(3).estado, 'nublado');
  assert.strictEqual(clima.estadoDe(45).estado, 'niebla');
  assert.strictEqual(clima.estadoDe(53).estado, 'llovizna');
  assert.strictEqual(clima.estadoDe(63).estado, 'lluvia');
  assert.strictEqual(clima.estadoDe(81).estado, 'lluvia', 'los chaparrones también son lluvia');
  assert.strictEqual(clima.estadoDe(65).fuerte, true);
  assert.strictEqual(clima.estadoDe(73).estado, 'nieve');
  assert.strictEqual(clima.estadoDe(95).estado, 'tormenta');
  assert.strictEqual(clima.estadoDe(undefined), null);
});

test('si llueve afuera, en la granja llueve', async function () {
  openMeteoDice(pronostico(63));
  var c = await clima.climaPara(null);
  assert.strictEqual(c.hayDato, true);
  assert.strictEqual(c.estado, 'lluvia');
  assert.strictEqual(c.temperatura, 18);
  assert.match(c.frase.dice, /Llueve/);
});

/*
 * SIN DATO NO SE INVENTA. Si Open-Meteo no contesta, la granja no muestra
 * sol radiante ni lluvia: muestra la hora del día, que eso sí se sabe, y no
 * dice nada del clima.
 */
test('si Open-Meteo se cae, no se inventa el clima pero la hora sí se sabe', async function () {
  openMeteoSeCae();
  var c = await clima.climaPara(null);
  assert.strictEqual(c.hayDato, false);
  assert.strictEqual(c.estado, null);
  assert.strictEqual(c.frase, null);
  assert.ok(['noche', 'amanecer', 'dia', 'atardecer'].includes(c.momento), 'el momento del día sale igual');
});

/*
 * Un dato de hace un rato sirve si la API se cae un momento. Se pide una vez
 * cada 15 minutos por ciudad, no en cada pantalla.
 */
test('se pide una vez y se guarda un rato', async function () {
  var veces = 0;
  global.fetch = async function () {
    veces++;
    return { ok: true, json: async function () { return pronostico(0); } };
  };
  await clima.climaPara(null);
  await clima.climaPara(null);
  await clima.climaPara(null);
  assert.strictEqual(veces, 1);
});

/* ================================================== la hora del día ====== */

test('el momento del día sale de la salida y la puesta del sol', function () {
  var salida = 6 * 60 + 12;
  var puesta = 19 * 60 + 7;
  assert.strictEqual(clima.momentoDe(3 * 60, salida, puesta), 'noche');
  assert.strictEqual(clima.momentoDe(6 * 60 + 20, salida, puesta), 'amanecer');
  assert.strictEqual(clima.momentoDe(13 * 60, salida, puesta), 'dia');
  assert.strictEqual(clima.momentoDe(19 * 60, salida, puesta), 'atardecer');
  assert.strictEqual(clima.momentoDe(22 * 60, salida, puesta), 'noche');
});

test('el sol cruza el cielo de día y la luna de noche', function () {
  var salida = 6 * 60;
  var puesta = 18 * 60;
  assert.deepStrictEqual(clima.arcoDe(12 * 60, salida, puesta), { astro: 'sol', fraccion: 0.5 });
  assert.strictEqual(clima.arcoDe(6 * 60, salida, puesta).fraccion, 0);
  var noche = clima.arcoDe(0, salida, puesta);
  assert.strictEqual(noche.astro, 'luna');
  assert.strictEqual(noche.fraccion, 0.5, 'a la medianoche la luna está en la mitad');
});

/*
 * La hora es la de LA CIUDAD, no la del servidor: Render corre en UTC, y a
 * las 22 de Buenos Aires allá ya es la una de la mañana.
 */
test('la hora es la de la ciudad, no la del servidor', function () {
  var lugar = { nombre: 'Buenos Aires' };
  var datos = { desfase: -3 * 3600, codigo: 0, salida: 6 * 60, puesta: 19 * 60 };
  // 01:00 UTC son las 22:00 en Buenos Aires.
  var c = clima.armar(lugar, datos, Date.UTC(2026, 9, 15, 1, 0));
  assert.strictEqual(c.hora, '22:00');
  assert.strictEqual(c.momento, 'noche');
});

/* ======================================================= la ciudad ======= */

test('sin ciudad elegida es Buenos Aires', function () {
  var l = clima.lugarDe({ ciudad: null, ciudad_lat: null, ciudad_lon: null });
  assert.strictEqual(l.nombre, 'Buenos Aires');
  assert.strictEqual(l.porDefecto, true);
});

test('con ciudad elegida es esa', function () {
  var l = clima.lugarDe({ ciudad: 'Rosario', ciudad_lat: -32.95, ciudad_lon: -60.64 });
  assert.strictEqual(l.nombre, 'Rosario');
  assert.ok(!l.porDefecto);
});

test('buscar una ciudad trae provincia y país para distinguir', async function () {
  openMeteoDice({ results: [
    { name: 'San Martín', admin1: 'Mendoza', country: 'Argentina', latitude: -33.08, longitude: -68.47 },
    { name: 'San Martín', admin1: 'Buenos Aires', country: 'Argentina', latitude: -34.57, longitude: -58.53 }
  ] });
  var r = await clima.buscar('San Martín');
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].donde, 'Mendoza, Argentina');
  assert.strictEqual(r[1].donde, 'Buenos Aires, Argentina');
});

/* De noche no hay sol: «☀️ Despejado» a las once de la noche. */
test('de noche despejado no tiene sol', function () {
  var datos = { desfase: -3 * 3600, codigo: 0, salida: 6 * 60, puesta: 19 * 60 };
  var noche = clima.armar({ nombre: 'Buenos Aires' }, datos, Date.UTC(2026, 9, 15, 2, 0));
  assert.strictEqual(noche.momento, 'noche');
  assert.strictEqual(noche.frase.emoji, '🌙');
  var dia = clima.armar({ nombre: 'Buenos Aires' }, datos, Date.UTC(2026, 9, 15, 15, 0));
  assert.strictEqual(dia.frase.emoji, '☀️');
});
