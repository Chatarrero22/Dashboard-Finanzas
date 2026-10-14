/**
 * LOS MONTOS SE LEEN IGUAL EN LOS DOS LADOS.
 *
 * La gente escribe «1.000.000», no «1000000». El front usa `montoDesde()` de
 * `comunes.jsx` y el server usa `numeroSuelto()` de `plata.js`, y tienen que
 * seguir la misma regla: si leyeran distinto, el mismo gasto valdría una cosa
 * cargado por la web y otra por Telegram.
 *
 * Esta prueba lee la función del front del archivo y la ejecuta de verdad,
 * en vez de comparar los regex a ojo: lo que importa es que den el mismo
 * número, no que el código se parezca.
 */
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');

var plata = require('../server/plata.js');

/**
 * Saca `montoDesde` de `comunes.jsx` y la vuelve ejecutable.
 *
 * `comunes.jsx` es un módulo ESM con JSX adentro, así que no se puede
 * `require`. Pero esta función no usa JSX ni importa nada: alcanza con
 * recortarla y compilarla sola.
 */
function traerMontoDesde() {
  var ruta = path.join(__dirname, '..', 'client', 'src', 'comunes.jsx');
  var src = fs.readFileSync(ruta, 'utf8');

  var marca = 'export function montoDesde(';
  var i = src.indexOf(marca);
  assert.ok(i >= 0, 'No encontré montoDesde() en comunes.jsx — ¿le cambiaron el nombre?');

  // Desde la primera llave hasta la que la cierra.
  var abre = src.indexOf('{', i);
  var nivel = 0;
  var fin = -1;
  for (var j = abre; j < src.length; j++) {
    if (src[j] === '{') nivel++;
    else if (src[j] === '}') {
      nivel--;
      if (nivel === 0) { fin = j; break; }
    }
  }
  assert.ok(fin > 0, 'No pude recortar el cuerpo de montoDesde()');

  var cuerpo = src.slice(i + marca.length - 1, fin + 1);
  // eslint-disable-next-line no-new-func
  return new Function('return function montoDesde' + cuerpo)();
}

var montoDesde = traerMontoDesde();

/*
 * Los casos que importan. Cada uno está acá porque rompió algo de verdad o
 * porque es la forma en que la gente escribe.
 */
var CASOS = [
  ['300.000', 300000],
  ['1.000.000', 1000000],
  ['15.400', 15400],
  ['2.500,50', 2500.5],
  ['300,50', 300.5],
  ['1.234.567', 1234567],
  ['50000', 50000],
  ['0,809', 0.809],
  ['0.809', 0.809],
  ['1.000', 1000],
  ['999', 999]
];

test('los dos lados leen el mismo número', function () {
  CASOS.forEach(function (caso) {
    var texto = caso[0];
    var esperado = caso[1];

    assert.strictEqual(montoDesde(texto), esperado,
      'el front leyó mal "' + texto + '"');
    assert.strictEqual(plata.numeroSuelto(texto), esperado,
      'el server leyó mal "' + texto + '"');
  });
});

/*
 * «0.809» NO es «cero mil ochocientos nueve».
 *
 * Un separador de miles nunca va detrás de un cero solo. Sin esta excepción
 * Emanuel cargó SUI a US$0,809, la app leyó US$809, y 370,81 unidades por el
 * MEP le descontaron $457 MILLONES de la cuenta.
 *
 * Es el bug más caro que tuvo la app, así que tiene su propia prueba.
 */
test('un punto detrás de un cero solo no es separador de miles', function () {
  assert.strictEqual(montoDesde('0.809'), 0.809);
  assert.strictEqual(plata.numeroSuelto('0.809'), 0.809);

  // Y la regla de al lado sigue viva: 15.400 son quince mil cuatrocientos.
  assert.strictEqual(montoDesde('15.400'), 15400);
  assert.strictEqual(plata.numeroSuelto('15.400'), 15400);
});

/*
 * Lo que había antes fallaba de dos formas, y las dos se veían en la app:
 * «300.000» daba 300 (movía trescientos pesos sin avisar) y «1.000.000» daba
 * NaN, que apagaba el botón de guardar y parecía que la app «no dejaba».
 */
test('ni 300 ni NaN', function () {
  assert.notStrictEqual(montoDesde('300.000'), 300);
  assert.ok(!Number.isNaN(montoDesde('1.000.000')));
  assert.strictEqual(montoDesde('1.000.000'), 1000000);
});

test('un texto vacío es cero, no NaN', function () {
  assert.strictEqual(montoDesde(''), 0);
  assert.strictEqual(montoDesde(null), 0);
  assert.strictEqual(montoDesde('   '), 0);
});

test('el menos se respeta: podés tener plata en contra', function () {
  assert.strictEqual(montoDesde('-9045'), -9045);
  assert.strictEqual(montoDesde('-300.000'), -300000);
});

test('como se habla: lucas, palos y k', function () {
  assert.strictEqual(plata.extraerMonto('5 lucas de super').monto, 5000);
  assert.strictEqual(plata.extraerMonto('un palo y medio').monto, 1500000);
  assert.strictEqual(plata.extraerMonto('15k de nafta').monto, 15000);
  assert.strictEqual(plata.extraerMonto('tres lucas').monto, 3000);
  assert.strictEqual(plata.extraerMonto('20 mangos').monto, 20);
});
