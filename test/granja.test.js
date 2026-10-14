/**
 * LA GRANJA.
 *
 * Existe porque el árbol tiene tope: en 9.000 puntos llega a «Mangal» y no
 * pasa nada más. La regla que no se puede romper es la contraria: la granja
 * no termina nunca.
 */
var test = require('node:test');
var assert = require('node:assert');

// PRIMERO esto: abre la base de prueba antes de que nadie toque db.js.
var ayuda = require('./ayuda.js');

var granja = require('../server/granja.js');
var arbol = require('../server/arbol.js');

test.beforeEach(function () {
  ayuda.limpiar();
});

/*
 * SIN TOPE. Es la razón de ser de la granja: Emanuel pidió «algo más que el
 * arbolito porque llega a un tope». Con cualquier cantidad de puntos tiene
 * que haber un próximo animal, y más puntos tienen que dar más animales.
 */
test('la granja no tiene tope', function () {
  [0, 9000, 50000, 1000000].forEach(function (xp) {
    var g = granja.granja(xp);
    assert.ok(g.proximo, 'con ' + xp + ' puntos tiene que haber un próximo animal');
    assert.ok(g.proximo.faltan > 0, 'y tiene que faltar algo para que llegue');
  });
  assert.ok(granja.granja(50000).total > granja.granja(9000).total);
  assert.ok(granja.granja(1000000).total > granja.granja(50000).total);
});

test('sin puntos no hay animales, y el primero llega pronto', function () {
  var g = granja.granja(0);
  assert.strictEqual(g.total, 0);
  assert.strictEqual(g.proximo.especie, 'gallina');
  assert.ok(g.proximo.llega <= 300, 'el primero tiene que llegar en los primeros días');
});

/*
 * EL CABALLO LLEGA JUSTO CUANDO EL ÁRBOL TERMINA. Terminar el árbol tiene
 * premio, y la granja sigue.
 */
test('el caballo llega con el mismo puntaje que el Mangal', function () {
  var mangal = arbol.ETAPAS[arbol.ETAPAS.length - 1].desde;
  var antes = granja.granja(mangal - 1);
  var justo = granja.granja(mangal);

  assert.ok(!antes.animales.some(function (a) { return a.especie === 'caballo'; }));
  assert.strictEqual(justo.animales[justo.total - 1].especie, 'caballo');
  assert.ok(justo.completa, 'con el caballo ya están todas las especies');
});

/*
 * DESPUÉS DE TODAS LAS ESPECIES NACEN CRÍAS, rotando. Así siempre hay uno
 * que viene.
 */
test('después del caballo nacen crías de cada especie', function () {
  var mangal = arbol.ETAPAS[arbol.ETAPAS.length - 1].desde;
  var g = granja.granja(mangal + granja.CADA_CUANTO_NACE);
  var nueva = g.animales[g.total - 1];

  assert.strictEqual(g.total, granja.ESPECIES.length + 1);
  assert.strictEqual(nueva.especie, 'gallina', 'la rueda vuelve a empezar');
  assert.strictEqual(nueva.etapa, 0, 'y nace cría');
});

/*
 * CADA ANIMAL CRECE CON LOS PUNTOS QUE SUMÁS DESPUÉS DE QUE LLEGÓ. Cría,
 * joven y grande.
 */
test('un animal nace cría y crece', function () {
  var llega = granja.llegadaDe(0);

  assert.strictEqual(granja.granja(llega).animales[0].etapa, 0);
  assert.strictEqual(granja.granja(llega).animales[0].etapaNombre, 'pollito');
  assert.strictEqual(granja.granja(llega + granja.CRECE[1]).animales[0].etapa, 1);
  assert.strictEqual(granja.granja(llega + granja.CRECE[2]).animales[0].etapa, 2);
  assert.strictEqual(granja.granja(llega + granja.CRECE[2]).animales[0].etapaNombre, 'gallina');
  assert.strictEqual(granja.granja(llega + 99999).animales[0].crece, 100, 'grande es grande para siempre');
});

/*
 * MISMOS PUNTOS, MISMA GRANJA. No se guarda nada: si dependiera de algo más
 * que los puntos, dos pantallas podrían mostrar granjas distintas.
 */
test('la granja sale solo de los puntos, y los nombres no cambian', function () {
  assert.deepStrictEqual(granja.granja(7777), granja.granja(7777));
  assert.strictEqual(granja.granja(300).animales[0].nombre, granja.granja(90000).animales[0].nombre,
    'Pocha es Pocha hoy y dentro de un año');
});

test('dos animales seguidos no se llaman igual', function () {
  var g = granja.granja(80000);
  for (var i = 1; i < g.total; i++) {
    assert.notStrictEqual(g.animales[i].nombre, g.animales[i - 1].nombre);
  }
});

/*
 * LAS NOVEDADES: lo que se le cuenta a la persona después de anotar algo.
 */
test('cruzar un umbral avisa que llegó un animal', function () {
  var n = granja.novedades(granja.llegadaDe(0) - 1, granja.llegadaDe(0));
  assert.strictEqual(n.llegaron.length, 1);
  assert.match(granja.frases(n)[0], /Llegó un pollito/);
});

test('crecer también se avisa', function () {
  var llega = granja.llegadaDe(0);
  var n = granja.novedades(llega + granja.CRECE[1] - 1, llega + granja.CRECE[1]);
  assert.strictEqual(n.llegaron.length, 0);
  assert.strictEqual(n.crecieron.length, 1);
  assert.match(granja.frases(n)[0], /creció: ya es pollita/);
});

test('si no cambia nada, no se dice nada', function () {
  var n = granja.novedades(50, 60);
  assert.strictEqual(granja.frases(n).length, 0);
});

/*
 * Y LLEGA HASTA LA PERSONA. Anotar un gasto que cruza el umbral tiene que
 * devolver la novedad, que es lo que leen la web y el bot.
 */
test('anotar un movimiento que cruza el umbral trae el animal', function () {
  var u = ayuda.usuario();
  // Justo antes de que llegue el primero.
  ayuda.db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, ?, 0, 0, ?)')
    .run(u.id, granja.llegadaDe(0) - 1, '');

  var premio = arbol.alAnotarMovimiento(u.id, {});
  assert.ok(premio.granja, 'la novedad de la granja tiene que venir siempre');
  assert.strictEqual(premio.granja.llegaron.length, 1);
  assert.strictEqual(premio.granja.llegaron[0].especie, 'gallina');

  assert.strictEqual(arbol.progreso(u.id).granja.total, 1, 'y la pantalla lo ve');
});
