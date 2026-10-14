/**
 * La granja de Manguito.
 *
 * El árbol tiene tope: en 9.000 puntos llega a «Mangal» y ahí se queda. La
 * experiencia sigue sumando, pero ya no hay nada nuevo que ver, y lo que no se
 * ve no motiva. Emanuel: «habría que poner algo más que el arbolito porque
 * llega a un tope».
 *
 * La granja NO TIENE TOPE. Van llegando animales a medida que juntás puntos,
 * cada uno nace cría y crece con los puntos que sumás después, y cuando ya
 * llegaron todas las especies empiezan a nacer crías nuevas, para siempre.
 *
 * NO SE GUARDA NADA. La granja es una función de la experiencia, igual que la
 * etapa del árbol: mismos puntos, misma granja. Es la misma regla que el saldo
 * de una cuenta —si se guardara aparte serían dos verdades que se pueden
 * contradecir— y además hace que la gente que ya venía juntando puntos
 * encuentre su granja con lo que se ganó, sin empezar de cero.
 */

/*
 * Las especies, en el orden en que llegan.
 *
 * El caballo llega justo en 9.000, el mismo punto en que el árbol se vuelve
 * Mangal: terminar el árbol tiene premio, y la granja sigue.
 *
 * Tres nombres por especie, uno por etapa. Suenan mejor que «cría / joven /
 * adulto» y es lo que hace que se sienta un animal y no un contador.
 */
var ESPECIES = [
  { especie: 'gallina', llega: 200,  emoji: '🐔', emojiCria: '🐣', etapas: ['pollito', 'pollita', 'gallina'] },
  { especie: 'conejo',  llega: 700,  emoji: '🐇', emojiCria: '🐰', etapas: ['gazapo', 'conejito', 'conejo'] },
  { especie: 'chancho', llega: 1500, emoji: '🐷', emojiCria: '🐖', etapas: ['lechón', 'chanchito', 'chancho'] },
  { especie: 'oveja',   llega: 2600, emoji: '🐑', emojiCria: '🐑', etapas: ['corderito', 'cordera', 'oveja'] },
  { especie: 'pato',    llega: 4000, emoji: '🦆', emojiCria: '🐥', etapas: ['patito', 'pato joven', 'pato'] },
  { especie: 'vaca',    llega: 6000, emoji: '🐄', emojiCria: '🐮', etapas: ['ternero', 'vaquillona', 'vaca'] },
  { especie: 'caballo', llega: 9000, emoji: '🐴', emojiCria: '🐴', etapas: ['potrillo', 'potranca', 'caballo'] }
];

/*
 * Después del caballo nace una cría cada tanto, rotando las especies. Así no
 * hay tope: siempre hay un próximo animal.
 */
var CADA_CUANTO_NACE = 1500;

/*
 * Cuánto crece un animal con los puntos que sumás DESPUÉS de que llegó.
 * Crece antes de que llegue el siguiente, a propósito: entre una llegada y
 * otra siempre pasa algo.
 */
var CRECE = [0, 400, 1000];

/*
 * Cada animal tiene nombre. Sale del orden en que llegó, así que es siempre
 * el mismo: Pocha es Pocha hoy y dentro de un año.
 */
var NOMBRES = [
  'Pocha', 'Chiche', 'Toto', 'Coco', 'Mora', 'Rulo', 'Negra', 'Pancho',
  'Lola', 'Manchita', 'Tito', 'Frida', 'Pipo', 'Nina', 'Fito', 'Chola',
  'Bicho', 'Luna', 'Ramón', 'Bombón', 'Tota', 'Pirata', 'Canela', 'Tango'
];

function nombrePara(i) {
  // Saltando de a 7 (que no divide a 24) recorre todos antes de repetir, y
  // dos animales seguidos no tienen nombres que empiezan igual.
  var nombre = NOMBRES[(i * 7) % NOMBRES.length];
  var vuelta = Math.floor(i / NOMBRES.length);
  return vuelta > 0 ? nombre + ' ' + (vuelta + 1) : nombre;
}

/** Con cuántos puntos llega el animal número `i` (empezando en 0). */
function llegadaDe(i) {
  if (i < ESPECIES.length) return ESPECIES[i].llega;
  var ultimo = ESPECIES[ESPECIES.length - 1].llega;
  return ultimo + (i - ESPECIES.length + 1) * CADA_CUANTO_NACE;
}

/** Qué especie es el animal número `i`. Después del caballo, rotan. */
function especieDe(i) {
  return ESPECIES[i % ESPECIES.length];
}

/** Cuántos animales hay con esos puntos. */
function cuantosCon(xp) {
  var n = 0;
  while (xp >= llegadaDe(n)) n++;
  return n;
}

/*
 * El nombre que eligió la persona le gana al que le tocó. `nombres` es un
 * objeto { idDelAnimal: 'Nombre' } con lo que está guardado; lo que no está
 * ahí usa el de la lista.
 */
function nombreDe(i, nombres) {
  var elegido = nombres && nombres[i];
  return elegido || nombrePara(i);
}

function armarAnimal(i, xp, nombres) {
  var e = especieDe(i);
  var llego = llegadaDe(i);
  var crecio = xp - llego;

  var etapa = 0;
  if (crecio >= CRECE[2]) etapa = 2;
  else if (crecio >= CRECE[1]) etapa = 1;

  var siguiente = CRECE[etapa + 1];
  return {
    id: i,
    especie: e.especie,
    nombre: nombreDe(i, nombres),
    // Para poder volver al de antes: si lo borrás, queda este.
    nombreOriginal: nombrePara(i),
    emoji: etapa === 0 ? e.emojiCria : e.emoji,
    // 0 = cría, 1 = joven, 2 = grande. El dibujo usa esto para el tamaño.
    etapa: etapa,
    etapaNombre: e.etapas[etapa],
    llegoCon: llego,
    // Cuánto le falta para la etapa que sigue, en porcentaje. Grande = 100.
    crece: siguiente == null
      ? 100
      : Math.min(((crecio - CRECE[etapa]) / (siguiente - CRECE[etapa])) * 100, 100),
    faltaParaCrecer: siguiente == null ? 0 : llego + siguiente - xp,
    proximaEtapa: siguiente == null ? null : e.etapas[etapa + 1]
  };
}

/**
 * La granja entera para esos puntos.
 *
 * `animales` va en el orden en que llegaron. `proximo` es el que viene, que
 * siempre existe: no hay tope.
 */
function granja(xp, nombres) {
  var puntos = Math.max(0, Number(xp) || 0);
  var n = cuantosCon(puntos);

  var animales = [];
  for (var i = 0; i < n; i++) animales.push(armarAnimal(i, puntos, nombres));

  var desde = n === 0 ? 0 : llegadaDe(n - 1);
  var hasta = llegadaDe(n);
  var e = especieDe(n);

  return {
    animales: animales,
    total: n,
    especies: ESPECIES.length,
    // Ya llegaron todas las especies: desde ahora nacen crías.
    completa: n >= ESPECIES.length,
    proximo: {
      id: n,
      especie: e.especie,
      emoji: e.emojiCria,
      nombre: nombreDe(n, nombres),
      etapaNombre: e.etapas[0],
      llega: hasta,
      faltan: hasta - puntos,
      // Si ya tenés todas las especies no «llega»: nace.
      nace: n >= ESPECIES.length,
      progreso: Math.min(((puntos - desde) / (hasta - desde)) * 100, 100)
    }
  };
}

/**
 * Qué cambió en la granja al pasar de `antes` a `despues` puntos.
 *
 * Es lo que se le cuenta a la persona después de anotar algo, en la web y en
 * Telegram. Puede llegar un animal y crecer otro en la misma suma: se cuentan
 * los dos, primero la llegada, que es lo más lindo.
 */
function novedades(antes, despues, nombres) {
  var a = granja(antes, nombres);
  var d = granja(despues, nombres);

  var llegaron = d.animales.slice(a.total);

  var crecieron = d.animales.filter(function (animal) {
    var viejo = a.animales[animal.id];
    return viejo && animal.etapa > viejo.etapa;
  });

  return { llegaron: llegaron, crecieron: crecieron };
}

/** Cómo se dice una novedad, igual en todos lados. */
function frases(nov) {
  var out = [];
  (nov.llegaron || []).forEach(function (a) {
    out.push(a.emoji + ' ¡Llegó un ' + a.etapaNombre + ' a tu granja! Se llama ' + a.nombre + '.');
  });
  (nov.crecieron || []).forEach(function (a) {
    out.push(a.emoji + ' ' + a.nombre + ' creció: ya es ' + a.etapaNombre + '.');
  });
  return out;
}

/*
 * Un nombre es corto: va en un globito arriba del animal y en una fila de la
 * lista. Veinte letras alcanzan para «Doña Pocha» y no rompen el celular.
 */
var LARGO_NOMBRE = 20;

function limpiarNombre(texto) {
  return String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE);
}

module.exports = {
  LARGO_NOMBRE: LARGO_NOMBRE,
  limpiarNombre: limpiarNombre,
  ESPECIES: ESPECIES,
  CADA_CUANTO_NACE: CADA_CUANTO_NACE,
  CRECE: CRECE,
  granja: granja,
  novedades: novedades,
  frases: frases,
  llegadaDe: llegadaDe,
  nombrePara: nombrePara
};
