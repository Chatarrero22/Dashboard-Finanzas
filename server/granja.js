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
 *
 * LAS ESPECIES NUEVAS VAN AL FINAL, NUNCA EN EL MEDIO. Cada animal es «el
 * número N que llegó», y su especie y el nombre que le pusiste cuelgan de
 * ese número. Si se mete un perro entre el conejo y el chancho, el tercer
 * animal de todos los que ya lo tenían pasa de chancho a perro, y el nombre
 * que le habían puesto queda pegado a otro bicho. Hay una prueba que lo
 * cuida.
 *
 * Las seis después del caballo llegan cada 1.500 puntos, justo donde antes
 * nacían crías: así la CANTIDAD de animales para cualquier puntaje no
 * cambió al agregarlas, solo qué especie es el octavo en adelante.
 */
var ESPECIES = [
  { especie: 'gallina', llega: 200,  emoji: '🐔', emojiCria: '🐣', etapas: ['pollito', 'pollita', 'gallina'] },
  { especie: 'conejo',  llega: 700,  emoji: '🐇', emojiCria: '🐰', etapas: ['gazapo', 'conejito', 'conejo'] },
  { especie: 'chancho', llega: 1500, emoji: '🐷', emojiCria: '🐖', etapas: ['lechón', 'chanchito', 'chancho'] },
  { especie: 'oveja',   llega: 2600, emoji: '🐑', emojiCria: '🐑', etapas: ['corderito', 'cordera', 'oveja'] },
  { especie: 'pato',    llega: 4000, emoji: '🦆', emojiCria: '🐥', etapas: ['patito', 'pato joven', 'pato'] },
  { especie: 'vaca',    llega: 6000, emoji: '🐄', emojiCria: '🐮', etapas: ['ternero', 'vaquillona', 'vaca'] },
  { especie: 'caballo', llega: 9000, emoji: '🐴', emojiCria: '🐴', etapas: ['potrillo', 'potranca', 'caballo'] },
  { especie: 'perro',     llega: 10500, emoji: '🐕', emojiCria: '🐶', etapas: ['cachorro', 'perrito', 'perro'] },
  { especie: 'gato',      llega: 12000, emoji: '🐈', emojiCria: '🐱', etapas: ['gatito', 'gatita', 'gato'] },
  { especie: 'cabra',     llega: 13500, emoji: '🐐', emojiCria: '🐐', etapas: ['cabrito', 'cabrita', 'cabra'] },
  { especie: 'burro',     llega: 15000, emoji: '🫏', emojiCria: '🫏', etapas: ['burrito', 'burrita', 'burro'] },
  { especie: 'llama',     llega: 16500, emoji: '🦙', emojiCria: '🦙', etapas: ['llamita', 'llama joven', 'llama'] },
  // No hay emoji de carpincho: el castor es lo más parecido que existe.
  { especie: 'carpincho', llega: 18000, emoji: '🦫', emojiCria: '🦫', etapas: ['carpinchito', 'carpincha', 'carpincho'] }
];

/*
 * Después del último (el carpincho) nace una cría cada tanto, rotando las
 * especies. Así no hay tope: siempre hay un próximo animal.
 */
var CADA_CUANTO_NACE = 1500;

/*
 * LOS PUNTOS TRAEN ANIMALES; CRECEN SI LOS CUIDÁS.
 *
 * Al principio crecían solos con los puntos. Emanuel pidió que fuera más
 * interactivo: «los puntos que vas ganando, en realidad para que crezca la
 * granja vos los tengas que alimentar, bañar». Así que lo que hacés con tu
 * plata te da cosas (alimento, jabón, premios), y con esas cosas los cuidás.
 * Cada cuidado suma, y con los cuidados suficientes pasan de cría a joven y
 * de joven a grande.
 *
 * Nunca se achican ni se mueren: es una app de plata, y el descuido no
 * castiga, solo deja de avanzar.
 */
var CRECE_CUIDADOS = [0, 6, 18];

/*
 * Las cosas para cuidarlos, y CÓMO SE GANAN. Cada una sale de algo distinto
 * que hacés con la plata, para que la acción tenga que ver con el logro:
 * el alimento es de todos los días (anotar), el jabón de tener la plata
 * ordenada (presupuestos, metas) y el premio de los logros grandes (cerrar
 * el mes en verde, cumplir una meta, invertir).
 */
var ITEMS = {
  alimento: { emoji: '🌾', uno: 'alimento', varios: 'alimento', seGana: 'anotando lo que gastás y sin cortar la racha' },
  jabon: { emoji: '🫧', uno: 'jabón', varios: 'jabones', seGana: 'respetando un presupuesto o sumando a una meta' },
  premio: { emoji: '🎁', uno: 'premio', varios: 'premios', seGana: 'cerrando el mes en verde, cumpliendo una meta o invirtiendo' }
};

/*
 * Qué da cada cosa que ya sumaba puntos. Las claves son los `motivo` con
 * que arbol.js llama a sumarXP(): así cada logro da puntos Y cosas desde un
 * solo lado, y no hay dos listas que se separen.
 */
var POR_MOTIVO = {
  'anotar': { alimento: 1 },
  'racha': { alimento: 1 },
  'aporte a meta': { jabon: 1 },
  'presupuesto respetado': { jabon: 2 },
  'mes en verde': { premio: 3 },
  'meta cumplida': { premio: 3 },
  'primera inversión': { premio: 2 },
  // Invertir de nuevo no da puntos (solo la primera vez), pero sí un premio
  // por día: es de lo que más tiene que valer la pena.
  'invertir': { premio: 1 }
};

/*
 * Lo que se puede hacer con un animal. `cada` es cada cuánto: un animal que
 * acaba de comer está lleno. Es lo que hace que haya motivo para volver, y
 * lo que impide engordarlo en un minuto con toda la canasta.
 */
var HORA = 60 * 60 * 1000;
var ACCIONES = {
  comer: { item: 'alimento', suma: 1, cada: 8 * HORA, campo: 'comio', dice: 'comió' },
  banar: { item: 'jabon', suma: 2, cada: 20 * HORA, campo: 'banio', dice: 'se bañó' },
  premio: { item: 'premio', suma: 3, cada: 20 * HORA, campo: 'premiado', dice: 'recibió su premio' },
  // Mimar es gratis y no hace crecer: es la visita de todos los días.
  mimar: { item: null, suma: 0, cada: 0, campo: null, dice: 'recibió mimos' }
};

// Tiene hambre si no comió en 12 horas; está sucio si no se bañó en 3 días.
var HAMBRE_DESPUES = 12 * HORA;
var SUCIO_DESPUES = 72 * HORA;

/*
 * Cómo crecían ANTES, con los puntos. Ya no se usa para crecer: sirve solo
 * para que, al pasar a los cuidados, nadie pierda los animales que ya
 * tenía grandes (ver arbol.prepararGranja).
 */
var CRECE = [0, 400, 1000];

function etapaPorPuntos(i, xp) {
  var crecio = xp - llegadaDe(i);
  if (crecio >= CRECE[2]) return 2;
  if (crecio >= CRECE[1]) return 1;
  return 0;
}

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

/** 0 = cría, 1 = joven, 2 = grande, según los cuidados que recibió. */
function etapaPorCuidado(cuidado) {
  if (cuidado >= CRECE_CUIDADOS[2]) return 2;
  if (cuidado >= CRECE_CUIDADOS[1]) return 1;
  return 0;
}

function hace(fecha, ahora) {
  return fecha ? ahora - new Date(fecha).getTime() : Infinity;
}

/*
 * Qué puede hacerse con este animal ahora, y cuándo se va a poder lo que no.
 * Sale de cuándo comió, se bañó y recibió su último premio.
 */
function estadoDe(reg, ahora) {
  var puede = {};
  var vuelve = {};
  Object.keys(ACCIONES).forEach(function (k) {
    var a = ACCIONES[k];
    var paso = a.campo ? hace(reg[a.campo], ahora) : Infinity;
    puede[k] = paso >= a.cada;
    vuelve[k] = puede[k] ? 0 : a.cada - paso;
  });
  return {
    hambre: hace(reg.comio, ahora) >= HAMBRE_DESPUES,
    // Uno que nunca se bañó está sucio: recién llegado viene embarrado.
    sucio: hace(reg.banio, ahora) >= SUCIO_DESPUES,
    puede: puede,
    // En cuántos milisegundos se puede de nuevo (0 = ya).
    vuelve: vuelve
  };
}

function armarAnimal(i, xp, nombres, cuidados, ahora) {
  var e = especieDe(i);
  var llego = llegadaDe(i);
  var reg = (cuidados && cuidados[i]) || {};
  var cuidado = reg.cuidado || 0;
  var etapa = etapaPorCuidado(cuidado);
  var siguiente = CRECE_CUIDADOS[etapa + 1];

  return Object.assign({
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
    cuidado: cuidado,
    // Cuánto le falta para la etapa que sigue, en porcentaje. Grande = 100.
    crece: siguiente == null
      ? 100
      : Math.min(((cuidado - CRECE_CUIDADOS[etapa]) / (siguiente - CRECE_CUIDADOS[etapa])) * 100, 100),
    // En cuidados: un bañito son 2, un premio 3.
    faltaParaCrecer: siguiente == null ? 0 : siguiente - cuidado,
    proximaEtapa: siguiente == null ? null : e.etapas[etapa + 1]
  }, estadoDe(reg, ahora || Date.now()));
}

/**
 * La granja entera para esos puntos.
 *
 * `animales` va en el orden en que llegaron. `proximo` es el que viene, que
 * siempre existe: no hay tope.
 */
function granja(xp, nombres, cuidados, ahora) {
  var puntos = Math.max(0, Number(xp) || 0);
  var n = cuantosCon(puntos);

  var animales = [];
  for (var i = 0; i < n; i++) animales.push(armarAnimal(i, puntos, nombres, cuidados, ahora));

  var desde = n === 0 ? 0 : llegadaDe(n - 1);
  var hasta = llegadaDe(n);
  var e = especieDe(n);

  return {
    animales: animales,
    total: n,
    especies: ESPECIES.length,
    // Ya llegaron todas las especies: desde ahora nacen crías.
    completa: n >= ESPECIES.length,
    /*
     * Las especies que todavía no llegaron, con cuántos puntos piden. Las
     * nuevas tardan (la primera llega a los 10.500), y lo que no se ve no
     * motiva: así se sabe desde el principio qué falta.
     */
    porLlegar: ESPECIES.slice(n).map(function (x) {
      return { especie: x.especie, emoji: x.emoji, nombre: x.etapas[2], llega: x.llega, faltan: x.llega - puntos };
    }),
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
function novedades(antes, despues, nombres, cuidados) {
  var a = granja(antes, nombres, cuidados);
  var d = granja(despues, nombres, cuidados);

  var llegaron = d.animales.slice(a.total);

  var crecieron = d.animales.filter(function (animal) {
    var viejo = a.animales[animal.id];
    return viejo && animal.etapa > viejo.etapa;
  });

  return { llegaron: llegaron, crecieron: crecieron };
}

/** Cómo se dice una novedad, igual en todos lados. */
/** «2 jabones», «1 premio». */
function cuantas(item, n) {
  var x = ITEMS[item];
  return n + ' ' + (n === 1 ? x.uno : x.varios);
}

/** Qué cosas da un motivo (el de sumarXP), o null. */
function itemsPor(motivo) {
  return POR_MOTIVO[motivo] || null;
}

function frases(nov) {
  var out = [];
  (nov.llegaron || []).forEach(function (a) {
    out.push(a.emoji + ' ¡Llegó un ' + a.etapaNombre + ' a tu granja! Se llama ' + a.nombre + '.');
  });
  (nov.crecieron || []).forEach(function (a) {
    out.push(a.emoji + ' ' + a.nombre + ' creció: ya es ' + a.etapaNombre + '.');
  });
  var ganados = nov.ganados || {};
  Object.keys(ganados).forEach(function (item) {
    if (item === 'alimento' || !ganados[item]) return;
    out.push(ITEMS[item].emoji + ' Ganaste ' + cuantas(item, ganados[item]) + ' para la granja.');
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
  CRECE_CUIDADOS: CRECE_CUIDADOS,
  ITEMS: ITEMS,
  POR_MOTIVO: POR_MOTIVO,
  ACCIONES: ACCIONES,
  HAMBRE_DESPUES: HAMBRE_DESPUES,
  SUCIO_DESPUES: SUCIO_DESPUES,
  etapaPorPuntos: etapaPorPuntos,
  etapaPorCuidado: etapaPorCuidado,
  itemsPor: itemsPor,
  cuantas: cuantas,
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
