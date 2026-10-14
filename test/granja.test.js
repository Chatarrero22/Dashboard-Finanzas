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
  // Con el caballo ya NO están todas: después vienen las que se agregaron.
  assert.ok(!justo.completa);
});

/* Después del caballo llegan las especies que se agregaron después. */
test('después del caballo llega el perro', function () {
  var mangal = arbol.ETAPAS[arbol.ETAPAS.length - 1].desde;
  var g = granja.granja(mangal + granja.CADA_CUANTO_NACE);
  assert.strictEqual(g.animales[g.total - 1].especie, 'perro');
});

/*
 * DESPUÉS DE TODAS LAS ESPECIES NACEN CRÍAS, rotando. Así siempre hay uno
 * que viene.
 */
test('después de la última especie nacen crías de cada una', function () {
  var ultima = granja.ESPECIES[granja.ESPECIES.length - 1];
  var g = granja.granja(ultima.llega + granja.CADA_CUANTO_NACE);
  var nueva = g.animales[g.total - 1];

  assert.strictEqual(g.total, granja.ESPECIES.length + 1);
  assert.strictEqual(nueva.especie, 'gallina', 'la rueda vuelve a empezar');
  assert.strictEqual(nueva.etapa, 0, 'y nace cría');
  assert.ok(granja.granja(ultima.llega).completa, 'con la última ya están todas');
});

/*
 * LAS ESPECIES NUEVAS VAN AL FINAL, NUNCA EN EL MEDIO.
 *
 * Cada animal es «el número N que llegó», y su especie y el nombre que le
 * pusiste cuelgan de ese número. Meter una especie en el medio le cambia el
 * bicho a gente que ya lo tiene, y el nombre queda pegado a otro animal.
 *
 * Si esta prueba falla porque agregaste una especie: ponela al final.
 */
test('el orden de las especies que ya existían no cambia', function () {
  var ORDEN = [
    'gallina', 'conejo', 'chancho', 'oveja', 'pato', 'vaca', 'caballo',
    'perro', 'gato', 'cabra', 'burro', 'llama', 'carpincho',
  ];
  var hoy = granja.ESPECIES.map(function (e) { return e.especie; });
  assert.deepStrictEqual(hoy.slice(0, ORDEN.length), ORDEN);
});

/*
 * Y la cantidad de animales para un puntaje tampoco: las especies nuevas
 * llegan justo donde antes nacían crías.
 */
test('agregar especies no cambió cuántos animales tiene cada puntaje', function () {
  // Antes de agregar las seis: siete especies y después una cría cada 1.500.
  function antes(xp) {
    var umbrales = [200, 700, 1500, 2600, 4000, 6000, 9000];
    var n = 0;
    while (xp >= (n < 7 ? umbrales[n] : 9000 + (n - 6) * 1500)) n++;
    return n;
  }
  [0, 199, 200, 1040, 9000, 10499, 10500, 18000, 25000, 60000].forEach(function (xp) {
    assert.strictEqual(granja.granja(xp).total, antes(xp), 'con ' + xp + ' puntos');
  });
});

/* El álbum: lo que falta, con cuántos puntos pide cada uno. */
test('se sabe desde el principio qué animales faltan', function () {
  var g = granja.granja(1040);
  var faltan = g.porLlegar.map(function (x) { return x.especie; });
  assert.strictEqual(faltan[0], 'chancho');
  assert.ok(faltan.includes('carpincho'));
  assert.strictEqual(g.porLlegar[0].faltan, 460);
  assert.strictEqual(granja.granja(999999).porLlegar.length, 0, 'con todas, no falta ninguna');
});

/*
 * LOS PUNTOS TRAEN ANIMALES; CRECEN SI LOS CUIDÁS. Cría, joven y grande,
 * según los cuidados que recibió.
 */
test('un animal nace cría y crece con los cuidados', function () {
  var llega = granja.llegadaDe(0);
  var c = granja.CRECE_CUIDADOS;
  var con = function (n) { return granja.granja(llega + 99999, {}, { 0: { cuidado: n } }).animales[0]; };

  assert.strictEqual(granja.granja(llega + 99999).animales[0].etapa, 0, 'sin cuidados no crece, por más puntos que tengas');
  assert.strictEqual(con(0).etapaNombre, 'pollito');
  assert.strictEqual(con(c[1]).etapa, 1);
  assert.strictEqual(con(c[2]).etapa, 2);
  assert.strictEqual(con(c[2]).etapaNombre, 'gallina');
  assert.strictEqual(con(999).crece, 100, 'grande es grande para siempre');
});

/*
 * MISMOS PUNTOS Y MISMOS CUIDADOS, MISMA GRANJA: dos pantallas no pueden
 * mostrar granjas distintas.
 */
test('la granja sale de los puntos y los cuidados, y los nombres no cambian', function () {
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

/* ================================================== los nombres ========== */

/** Un usuario con esos puntos. */
function conPuntos(xp) {
  var u = ayuda.usuario();
  ayuda.db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, ?, 0, 0, ?)')
    .run(u.id, xp, '');
  return u;
}

/*
 * EL NOMBRE QUE ELEGISTE LE GANA AL QUE LE TOCÓ, y aparece en todos lados:
 * en la pantalla y en lo que se avisa cuando crece.
 */
test('se le puede cambiar el nombre a un animal', function () {
  var u = conPuntos(granja.llegadaDe(0) + 10);

  var a = arbol.renombrar(u.id, 0, '  Doña   Pocha  ');
  assert.strictEqual(a.nombre, 'Doña Pocha', 'sin espacios de más');
  assert.strictEqual(arbol.progreso(u.id).granja.animales[0].nombre, 'Doña Pocha');
  assert.strictEqual(arbol.progreso(u.id).granja.animales[0].nombreOriginal, 'Pocha');
});

test('borrar el nombre vuelve al que le había tocado', function () {
  var u = conPuntos(granja.llegadaDe(0) + 10);
  arbol.renombrar(u.id, 0, 'Turuleca');
  var a = arbol.renombrar(u.id, 0, '   ');
  assert.strictEqual(a.nombre, 'Pocha');
});

/*
 * Un nombre va en un globito arriba del animal y en una fila del celular:
 * tiene tope.
 */
test('un nombre larguísimo se corta', function () {
  var u = conPuntos(granja.llegadaDe(0) + 10);
  var a = arbol.renombrar(u.id, 0, 'Pocha la gallina más linda de toda la provincia');
  assert.ok(a.nombre.length <= granja.LARGO_NOMBRE);
});

/* El que todavía no llegó no es de nadie, y uno que no existe tampoco. */
test('no se puede nombrar un animal que no llegó', function () {
  var u = conPuntos(granja.llegadaDe(0) + 10);
  assert.strictEqual(arbol.renombrar(u.id, 1, 'Bugs'), null);
  assert.strictEqual(arbol.renombrar(u.id, -1, 'Bugs'), null);
  assert.strictEqual(arbol.renombrar(u.id, 'x', 'Bugs'), null);
});

/* Cada uno nombra los suyos: Pocha de Cami no es Pocha de Emanuel. */
test('los nombres son de cada persona', function () {
  var a = conPuntos(granja.llegadaDe(0) + 10);
  var b = ayuda.usuario('otra');
  ayuda.db.prepare('INSERT INTO user_stats (user_id, xp, streak, best_streak, last_active) VALUES (?, ?, 0, 0, ?)')
    .run(b.id, granja.llegadaDe(0) + 10, '');

  arbol.renombrar(a.id, 0, 'Turuleca');
  assert.strictEqual(arbol.progreso(b.id).granja.animales[0].nombre, 'Pocha');
});
