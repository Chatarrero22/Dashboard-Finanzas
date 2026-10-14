import { useEffect, useRef, useState } from 'react'
import { api } from './comunes.jsx'
import { useDialogos } from './Dialogos.jsx'

/**
 * La granja, dibujada en SVG y animada con CSS.
 *
 * Es lo único que queda en la pantalla de «Árbol»: el árbol tenía tope (en
 * 9.000 puntos era «Mangal» y no pasaba nada más) y Emanuel pidió sacarlo.
 * La granja no termina: van llegando animales, cada uno crece, y después de
 * que llegan todas las especies nacen crías para siempre. Qué animal hay y en
 * qué etapa lo decide el server (`granja.js`); acá solo se dibuja.
 *
 * CÓMO SE MUEVEN. Cada animal son cuatro grupos anidados, y no es capricho:
 *
 *   <g transform="translate scale">   dónde vive y qué tan grande es.
 *     <g class="animal">               el recorrido por el corral (CSS).
 *       <g class="toque">              el salto cuando lo tocás (CSS).
 *         <g class="cuerpo">           rebote, bamboleo y saltitos (CSS).
 *
 * Una animación CSS que usa `transform` le gana al atributo `transform` del
 * mismo elemento, y el dibujo sale volando (ya nos pasó con el árbol). Por
 * eso la posición va en un grupo y cada movimiento en un hijo distinto.
 *
 * LA PRIMERA VERSIÓN ERA «DURA», y tenía números: cada animal caminaba entre
 * 22 y 52 unidades en unos siete segundos, o sea unos 5 píxeles por segundo
 * en el celular. Se movía, pero no se notaba. Y el cuerpo no acompañaba: solo
 * giraban las patas. Ahora recorren tres o cuatro veces más, rebotan y se
 * bambolean con cada paso, paran a comer, miran alrededor y pegan saltitos.
 */

/* --------------------------------------------------------------- partes */

function Ojo({ x, y, r = 1.4, blanco = false }) {
  return (
    <g className="ojo">
      {blanco && <circle cx={x} cy={y} r={r + 0.7} fill="#fff" />}
      <circle cx={x} cy={y} r={r} fill="#2a1c0c" />
      <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#fff" />
    </g>
  )
}

function Cachete({ x, y, r = 1.7 }) {
  return <circle cx={x} cy={y} r={r} fill="#ff8fa3" opacity="0.45" />
}

/* ------------------------------------------------------------ las especies */

/*
 * Todas miran a la derecha y tienen los pies en y = 0, con el cuerpo hacia
 * arriba (y negativa). Así crecer es escalar desde los pies, y darse vuelta
 * es espejar en x sin que el animal salte de lugar.
 */

function Gallina() {
  return (
    <>
      <g className="pata a"><path d="M-3 -5 V0 M-3 0 h-2.5 M-3 0 h2" stroke="#e8962a" strokeWidth="1.5" strokeLinecap="round" /></g>
      <g className="pata b"><path d="M3 -5 V0 M3 0 h-2.5 M3 0 h2" stroke="#e8962a" strokeWidth="1.5" strokeLinecap="round" /></g>
      <g className="cola">
        <path className="pluma" d="M-11 -16 Q-21 -26 -17 -33 Q-12 -25 -7 -21 Z" fill="#fffaf2" stroke="#e6d9c3" strokeWidth="0.8" />
        <path className="pluma-2" d="M-12 -15 Q-23 -20 -22 -27 Q-15 -22 -9 -18 Z" fill="#f1e7d6" />
      </g>
      <ellipse className="pluma" cx="-1" cy="-14" rx="13" ry="10.5" fill="#fffaf2" stroke="#e6d9c3" strokeWidth="0.8" />
      <ellipse className="pluma-2" cx="-3" cy="-14" rx="7" ry="5" fill="#efe4d1" />
      <g className="cabeza">
        <g className="cresta">
          <circle cx="7" cy="-31" r="2.6" fill="#e5484d" />
          <circle cx="10" cy="-32.2" r="2.8" fill="#e5484d" />
          <circle cx="13" cy="-30.6" r="2.4" fill="#e5484d" />
          <ellipse cx="14.4" cy="-19.8" rx="1.6" ry="2.4" fill="#e5484d" />
        </g>
        <circle className="pluma" cx="9" cy="-24" r="7" fill="#fffaf2" stroke="#e6d9c3" strokeWidth="0.8" />
        <path d="M15.2 -25.4 L20.5 -23.6 L15.2 -21.8 Z" fill="#f0a030" />
        <Ojo x={11.2} y={-25.6} />
        <Cachete x={8.4} y={-21.6} />
      </g>
    </>
  )
}

function Conejo() {
  return (
    <>
      <g className="pata a"><ellipse cx="7" cy="-1.6" rx="3.6" ry="1.9" fill="#b9a693" /></g>
      <g className="pata b"><ellipse cx="-6" cy="-1.6" rx="4" ry="2" fill="#b9a693" /></g>
      <g className="cola"><circle cx="-13.5" cy="-12" r="4.2" fill="#fffdf8" /></g>
      <ellipse cx="-2" cy="-11" rx="13" ry="9.6" fill="#cdbca9" />
      <ellipse cx="-6.5" cy="-7" rx="6" ry="5" fill="#bfac97" />
      <g className="cabeza">
        <g className="orejas">
          <ellipse cx="6" cy="-33" rx="2.9" ry="9" fill="#cdbca9" transform="rotate(-14 6 -33)" />
          <ellipse cx="6" cy="-33" rx="1.3" ry="6.2" fill="#f4b8c4" transform="rotate(-14 6 -33)" />
          <ellipse cx="11.5" cy="-33.5" rx="2.9" ry="9" fill="#cdbca9" transform="rotate(8 11.5 -33.5)" />
          <ellipse cx="11.5" cy="-33.5" rx="1.3" ry="6.2" fill="#f4b8c4" transform="rotate(8 11.5 -33.5)" />
        </g>
        <circle cx="9.5" cy="-21" r="7.6" fill="#cdbca9" />
        <Ojo x={12} y={-22.6} />
        <circle cx="16.6" cy="-19.8" r="1.25" fill="#e88aa0" />
        <Cachete x={10} y={-17.8} />
      </g>
    </>
  )
}

function Chancho() {
  return (
    <>
      <g className="pata a">
        <rect x="-12" y="-5.5" width="4.2" height="5.5" rx="1.4" fill="#ee9fb2" />
        <rect x="4" y="-5.5" width="4.2" height="5.5" rx="1.4" fill="#ee9fb2" />
      </g>
      <g className="pata b">
        <rect x="-5" y="-5.5" width="4.2" height="5.5" rx="1.4" fill="#ee9fb2" />
        <rect x="9.5" y="-5.5" width="4.2" height="5.5" rx="1.4" fill="#ee9fb2" />
      </g>
      <g className="cola">
        <path d="M-16.5 -15 q-5 -1.5 -4.2 -5.6 q0.8 -3.2 3.6 -1.6 q2.2 1.8 -0.9 3.4" fill="none" stroke="#e98aa0" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <ellipse cx="-1" cy="-13" rx="16" ry="10.8" fill="#f7b5c4" />
      <g className="cabeza">
        <path d="M8.6 -22.4 L11.2 -29.4 L14.6 -23 Z" fill="#ee9fb2" />
        <path d="M14.6 -23.2 L18.6 -28.6 L19.4 -21.6 Z" fill="#ee9fb2" />
        <circle cx="13.5" cy="-16" r="8.6" fill="#f7b5c4" />
        <ellipse cx="21.4" cy="-15" rx="3.7" ry="3.3" fill="#f08ea6" />
        <circle cx="20.3" cy="-15" r="0.75" fill="#bf5d78" />
        <circle cx="22.6" cy="-15" r="0.75" fill="#bf5d78" />
        <Ojo x={15.6} y={-18.8} r={1.3} />
        <Cachete x={12.4} y={-12.4} r={2} />
      </g>
    </>
  )
}

function Oveja() {
  return (
    <>
      <g className="pata a">
        <rect x="-10" y="-7" width="2.8" height="7" rx="1.2" fill="#4a4038" />
        <rect x="3" y="-7" width="2.8" height="7" rx="1.2" fill="#4a4038" />
      </g>
      <g className="pata b">
        <rect x="-4.5" y="-7" width="2.8" height="7" rx="1.2" fill="#4a4038" />
        <rect x="8" y="-7" width="2.8" height="7" rx="1.2" fill="#4a4038" />
      </g>
      <g className="cola"><circle cx="-15" cy="-15" r="3.6" fill="#fbf8f2" stroke="#e5ddcf" strokeWidth="0.8" /></g>
      <g fill="#fbf8f2" stroke="#e5ddcf" strokeWidth="0.8">
        <circle cx="-12" cy="-11.5" r="4.8" />
        <circle cx="-9" cy="-16" r="6" />
        <circle cx="-3" cy="-19.5" r="6.6" />
        <circle cx="3.5" cy="-19.5" r="6.6" />
        <circle cx="8.5" cy="-15.5" r="6" />
        <circle cx="-5" cy="-11" r="6" />
        <circle cx="4" cy="-11" r="6" />
      </g>
      <ellipse cx="-1" cy="-15" rx="10" ry="6" fill="#fbf8f2" />
      <g className="cabeza">
        <ellipse cx="11" cy="-21" rx="3.6" ry="1.6" fill="#3d3530" transform="rotate(-25 11 -21)" />
        <ellipse cx="15.5" cy="-18" rx="5.4" ry="7" fill="#3d3530" />
        <circle cx="13.6" cy="-24.6" r="2.6" fill="#fbf8f2" />
        <circle cx="16.6" cy="-25" r="2.6" fill="#fbf8f2" />
        <Ojo x={17.3} y={-19.4} r={1} blanco />
      </g>
    </>
  )
}

function Pato() {
  return (
    <>
      <g className="pata a"><path d="M-2 -4 V0 M-2 0 h3.4" stroke="#f0a030" strokeWidth="1.6" strokeLinecap="round" /></g>
      <g className="pata b"><path d="M3.5 -4 V0 M3.5 0 h3.4" stroke="#f0a030" strokeWidth="1.6" strokeLinecap="round" /></g>
      <g className="cola"><path className="pluma" d="M-11 -12 L-19.5 -18.5 L-10 -16.5 Z" fill="#fffdf8" stroke="#e6ddcc" strokeWidth="0.8" /></g>
      <ellipse className="pluma" cx="-1" cy="-10" rx="12" ry="8.4" fill="#fffdf8" stroke="#e6ddcc" strokeWidth="0.8" />
      <ellipse className="pluma-2" cx="-3" cy="-11" rx="7" ry="4.4" fill="#efe8da" />
      <g className="cabeza">
        <ellipse className="pluma" cx="7" cy="-17" rx="3.4" ry="6" fill="#fffdf8" />
        <circle className="pluma" cx="8" cy="-24" r="5.6" fill="#fffdf8" stroke="#e6ddcc" strokeWidth="0.8" />
        <ellipse cx="14.4" cy="-23.2" rx="4" ry="1.9" fill="#f5a524" />
        <Ojo x={9.6} y={-25.6} r={1.2} />
        <Cachete x={8} y={-21.4} r={1.4} />
      </g>
    </>
  )
}

function Vaca() {
  const pata = (x) => (
    <>
      <rect x={x} y="-11" width="4.2" height="11" rx="1.6" fill="#fffdf8" stroke="#ddd2c1" strokeWidth="0.7" />
      <rect x={x} y="-2.4" width="4.2" height="2.4" rx="0.8" fill="#4a3b31" />
    </>
  )
  return (
    <>
      <g className="pata a">{pata(-16)}{pata(7)}</g>
      <g className="pata b">{pata(-9)}{pata(13)}</g>
      <g className="cola">
        <path d="M-20 -25 Q-24 -18 -23 -11" fill="none" stroke="#ddd2c1" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="-23" cy="-10" rx="1.8" ry="2.6" fill="#3a302a" />
      </g>
      <rect x="-21" y="-30" width="39" height="21" rx="9.5" fill="#fffdf8" stroke="#ddd2c1" strokeWidth="0.8" />
      <ellipse cx="-12" cy="-22" rx="5.4" ry="4.2" fill="#2f2823" />
      <ellipse cx="2" cy="-25.6" rx="4.4" ry="3" fill="#2f2823" />
      <ellipse cx="8.5" cy="-16" rx="3.8" ry="3.2" fill="#2f2823" />
      <ellipse cx="-2" cy="-9.6" rx="3" ry="1.8" fill="#f6b6c4" />
      <g className="cabeza">
        <path d="M17.4 -36 q-1 -4 1.6 -5" fill="none" stroke="#e8d8b6" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M26 -36 q1 -4 -1.6 -5" fill="none" stroke="#e8d8b6" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="14.4" cy="-33" rx="3.4" ry="1.7" fill="#fffdf8" stroke="#ddd2c1" strokeWidth="0.7" transform="rotate(-20 14.4 -33)" />
        <ellipse cx="29" cy="-33" rx="3.4" ry="1.7" fill="#fffdf8" stroke="#ddd2c1" strokeWidth="0.7" transform="rotate(20 29 -33)" />
        <ellipse cx="21.7" cy="-28.5" rx="7" ry="8" fill="#fffdf8" stroke="#ddd2c1" strokeWidth="0.8" />
        <ellipse cx="18.6" cy="-31.6" rx="3" ry="2.4" fill="#2f2823" />
        <ellipse cx="21.7" cy="-22.6" rx="6.4" ry="4.2" fill="#f6b6c4" />
        <circle cx="19.6" cy="-22.6" r="0.8" fill="#c26b80" />
        <circle cx="23.8" cy="-22.6" r="0.8" fill="#c26b80" />
        <Ojo x={19.4} y={-29} r={1.2} />
        <Ojo x={24.2} y={-29} r={1.2} />
      </g>
    </>
  )
}

function Caballo() {
  const pata = (x) => (
    <>
      <rect x={x} y="-17" width="3.8" height="17" rx="1.6" fill="#a76b40" />
      <rect x={x - 0.2} y="-2.6" width="4.2" height="2.6" rx="0.8" fill="#3b2618" />
    </>
  )
  return (
    <>
      <g className="pata a">{pata(-15)}{pata(9)}</g>
      <g className="pata b">{pata(-9)}{pata(14)}</g>
      <g className="cola">
        <path d="M-19 -30 Q-28 -25 -25 -12" fill="none" stroke="#4a2e1c" strokeWidth="4.2" strokeLinecap="round" />
      </g>
      <ellipse cx="-1" cy="-26" rx="19" ry="10.4" fill="#b87a4b" />
      <g className="cabeza">
        <path d="M9 -31 L18.5 -46 L26.5 -42.5 L18 -24 Z" fill="#b87a4b" />
        <path d="M10 -32 Q13 -45 19.5 -49.5 L18.6 -44 Q14.4 -37 14 -29 Z" fill="#4a2e1c" />
        <path d="M19.5 -49 L20.6 -55 L23.4 -49.4 Z" fill="#a76b40" />
        <ellipse cx="26" cy="-43.5" rx="9" ry="4.9" fill="#b87a4b" transform="rotate(28 26 -43.5)" />
        <ellipse cx="29.6" cy="-40.4" rx="3.6" ry="3" fill="#9c6239" transform="rotate(28 29.6 -40.4)" />
        <circle cx="31" cy="-39.6" r="0.8" fill="#3b2618" />
        <path d="M24 -48 L27.6 -42" stroke="#fff6e8" strokeWidth="1.6" strokeLinecap="round" />
        <Ojo x={23.4} y={-46} r={1.25} />
      </g>
    </>
  )
}

const DIBUJOS = {
  gallina: Gallina,
  conejo: Conejo,
  chancho: Chancho,
  oveja: Oveja,
  pato: Pato,
  vaca: Vaca,
  caballo: Caballo,
}

/* ========================================================= los recorridos */

/*
 * Cada animal sigue una rutina: una lista de cosas que hace, con cuánto de
 * su vuelta dura cada una (en %). Al caminar va a un punto del corral dado
 * como fracción de su campo (--dx a lo ancho, --dy a lo profundo).
 *
 *   ['camina', 18, 1, 0]   camina el 18% de la vuelta hasta (dx, 0)
 *   ['come', 12]           se para y baja la cabeza a comer
 *   ['mira', 8]            se para y mira alrededor
 *   ['salta', 6]           pega un saltito en el lugar
 *
 * Tres rutinas distintas, repartidas entre los animales, para que no
 * parezca un desfile. Todas suman 100 y terminan donde empezaron.
 */
const RUTAS = [
  [['camina', 18, 1, 0], ['come', 12], ['camina', 14, 0.55, 1], ['mira', 8], ['camina', 12, 0.1, 0.4],
    ['salta', 6], ['camina', 14, 0.8, -0.2], ['come', 6], ['camina', 10, 0, 0]],
  [['mira', 6], ['camina', 16, 0.7, 0.6], ['come', 14], ['camina', 10, 1, 0.1], ['salta', 5],
    ['camina', 20, 0.15, -0.3], ['come', 10], ['mira', 6], ['camina', 13, 0, 0]],
  [['camina', 12, 0.4, -0.2], ['come', 16], ['camina', 18, 1, 0.5], ['mira', 7], ['salta', 5],
    ['camina', 14, 0.5, 0.9], ['come', 10], ['camina', 18, 0, 0]],
]

// Una vuelta dura entre 14 y 18 segundos; para calcular cuántos pasos entran
// en cada tramo se toma una de 16. Un medio paso cada 0,18 s se ve como un
// trote tranquilo.
const VUELTA_NOMINAL = 16
const MEDIO_PASO = 0.18

const pct = (n) => `${Math.round(n * 100) / 100}%`

/**
 * Arma las animaciones de una rutina: el recorrido, las patas, el cuerpo y
 * la cabeza. Salen de la MISMA lista, así que siempre están sincronizadas:
 * las patas se mueven solo mientras avanza, y la cabeza baja solo cuando
 * está parado. Hacerlo a mano en el CSS era garantizar que se desfasen.
 */
function animacionesDe(ruta, r) {
  const pasea = []
  const pataA = []
  const pataB = []
  const cuerpo = []
  const conejo = []
  const cabeza = []
  const pica = []

  let x = 0
  let y = 0
  let mira = 1
  let t = 0
  const lugar = () => `translate: calc(var(--dx) * ${x}) calc(var(--dy) * ${y}); scale: ${mira} 1;`

  pasea.push([0, lugar()])
  ;[pataA, pataB, cabeza, pica].forEach((k) => k.push([0, 'rotate: 0deg;']))
  ;[cuerpo, conejo].forEach((k) => k.push([0, 'translate: 0 0; rotate: 0deg; scale: 1 1;']))

  ruta.forEach(([que, dura, ax, ay]) => {
    const desde = t
    const hasta = t + dura

    if (que === 'camina') {
      // Darse vuelta es instantáneo y pasa antes de arrancar, no a mitad de
      // camino: si no, camina un rato de espaldas.
      const hacia = ax > x ? 1 : ax < x ? -1 : mira
      if (hacia !== mira) {
        pasea.push([desde, lugar()])
        mira = hacia
        pasea.push([desde + 0.01, lugar()])
      }
      x = ax
      y = ay
      pasea.push([hasta, lugar()])

      const medios = Math.max(2, Math.round((dura / 100) * VUELTA_NOMINAL / MEDIO_PASO))
      for (let k = 1; k <= medios; k++) {
        const p = desde + (dura * k) / medios
        const mitad = desde + (dura * (k - 0.5)) / medios
        const ultimo = k === medios
        const lado = k % 2 ? 1 : -1
        pataA.push([p, `rotate: ${ultimo ? 0 : 18 * lado}deg;`])
        pataB.push([p, `rotate: ${ultimo ? 0 : -18 * lado}deg;`])
        // Con cada medio paso sube un poco y se bambolea hacia un lado.
        cuerpo.push([mitad, `translate: 0 calc(var(--bamboleo) * -1.8px); rotate: calc(var(--bamboleo) * ${3 * lado}deg); scale: 1 1;`])
        cuerpo.push([p, 'translate: 0 0; rotate: 0deg; scale: 1 1;'])
        cabeza.push([mitad, `rotate: ${4 * lado}deg;`])
        cabeza.push([p, 'rotate: 0deg;'])
        pica.push([mitad, `rotate: ${6 * lado}deg;`])
        pica.push([p, 'rotate: 0deg;'])
        // El conejo no camina: salta, uno cada dos medios pasos.
        if (k % 2) {
          conejo.push([mitad, 'translate: 0 calc(var(--salto) * -7px); rotate: -6deg; scale: 0.96 1.06;'])
        } else {
          conejo.push([mitad, 'translate: 0 0; rotate: 0deg; scale: 1.06 0.92;'])
        }
        conejo.push([p, 'translate: 0 0; rotate: 0deg; scale: 1 1;'])
      }
    } else {
      pasea.push([hasta, lugar()])
      pataA.push([hasta, 'rotate: 0deg;'])
      pataB.push([hasta, 'rotate: 0deg;'])
    }

    if (que === 'come') {
      // Baja, mordisquea dos veces y sube.
      const a = 'var(--agacha)'
      cabeza.push([desde + dura * 0.12, `rotate: ${a};`])
      cabeza.push([desde + dura * 0.35, `rotate: calc(${a} * 0.75);`])
      cabeza.push([desde + dura * 0.5, `rotate: ${a};`])
      cabeza.push([desde + dura * 0.7, `rotate: calc(${a} * 0.75);`])
      cabeza.push([desde + dura * 0.86, `rotate: ${a};`])
      cabeza.push([hasta, 'rotate: 0deg;'])
      // La gallina picotea: rápido y muchas veces.
      const picotazos = 6
      for (let k = 0; k < picotazos; k++) {
        pica.push([desde + (dura * (k + 0.4)) / picotazos, `rotate: ${a};`])
        pica.push([desde + (dura * (k + 0.9)) / picotazos, 'rotate: 4deg;'])
      }
      pica.push([hasta, 'rotate: 0deg;'])
    }

    if (que === 'mira') {
      // Levanta la cabeza, mira para un lado y vuelve.
      ;[cabeza, pica].forEach((k) => {
        k.push([desde + dura * 0.25, 'rotate: -16deg;'])
        k.push([desde + dura * 0.55, 'rotate: -16deg;'])
        k.push([desde + dura * 0.75, 'rotate: 7deg;'])
        k.push([hasta, 'rotate: 0deg;'])
      })
    }

    if (que === 'salta') {
      // Se agacha, salta estirado y cae aplastándose: sin eso el salto es
      // un dibujo que sube y baja.
      ;[cuerpo, conejo].forEach((k) => {
        k.push([desde + dura * 0.18, 'translate: 0 0; rotate: 0deg; scale: 1.1 0.84;'])
        k.push([desde + dura * 0.48, 'translate: 0 calc(var(--salto) * -13px); rotate: 0deg; scale: 0.93 1.1;'])
        k.push([desde + dura * 0.78, 'translate: 0 0; rotate: 0deg; scale: 1.12 0.86;'])
        k.push([hasta, 'translate: 0 0; rotate: 0deg; scale: 1 1;'])
      })
    }

    if (que !== 'camina' && que !== 'salta') {
      cuerpo.push([hasta, 'translate: 0 0; rotate: 0deg; scale: 1 1;'])
      conejo.push([hasta, 'translate: 0 0; rotate: 0deg; scale: 1 1;'])
    }
    if (que === 'camina' || que === 'salta') {
      cabeza.push([hasta, 'rotate: 0deg;'])
      pica.push([hasta, 'rotate: 0deg;'])
    }

    t = hasta
  })

  const bloque = (nombre, cuadros) => {
    // Dos cuadros en el mismo porcentaje: gana el último, que es el que vale.
    const porPct = new Map()
    cuadros.forEach(([p, css]) => porPct.set(pct(Math.min(p, 100)), css))
    const filas = [...porPct.entries()].map(([p, css]) => `  ${p} { ${css} }`).join('\n')
    return `@keyframes ${nombre} {\n${filas}\n}`
  }

  const quien = [
    [`.ruta-${r}`, `gr-pasea-${r}`],
    [`.ruta-${r} .pata.a`, `gr-pata-a-${r}`],
    [`.ruta-${r} .pata.b`, `gr-pata-b-${r}`],
    [`.ruta-${r} .cuerpo`, `gr-cuerpo-${r}`],
    [`.ruta-${r}.conejo .cuerpo`, `gr-conejo-${r}`],
    [`.ruta-${r} .cabeza`, `gr-cabeza-${r}`],
    [`.ruta-${r}.gallina .cabeza`, `gr-pica-${r}`],
  ]

  /*
   * Con «reducir movimiento», shell.css hace `* { animation: none
   * !important }`: le borra el NOMBRE a todas las animaciones, no solo la
   * duración. Así que acá se vuelven a declarar, también con !important. Sin
   * esto la granja quedaba quieta del todo (ver granja.css).
   */
  return [
    bloque(`gr-pasea-${r}`, pasea),
    bloque(`gr-pata-a-${r}`, pataA),
    bloque(`gr-pata-b-${r}`, pataB),
    bloque(`gr-cuerpo-${r}`, cuerpo),
    bloque(`gr-conejo-${r}`, conejo),
    bloque(`gr-cabeza-${r}`, cabeza),
    bloque(`gr-pica-${r}`, pica),
    ...quien.map(([sel, nombre]) => `.granja-escena ${sel} { animation-name: ${nombre}; }`),
    '@media (prefers-reduced-motion: reduce) {',
    ...quien.map(([sel, nombre]) => `  .granja-escena ${sel} { animation-name: ${nombre} !important; }`),
    '}',
  ].join('\n')
}

// Se arma una sola vez, cuando se carga el archivo: es siempre el mismo.
const MOVIMIENTOS = RUTAS.map((ruta, r) => animacionesDe(ruta, r)).join('\n\n')

/* ----------------------------------------------------------- el corral */

// Cría, joven, grande. La cría además tiene la cabeza más grande (en el CSS),
// que es lo que hace que se vea bebé y no un animal grande mirado de lejos.
const TAMANO = [0.58, 0.8, 1]

// Cuántos se dibujan como mucho. Más que esto no entra en un celular sin que
// se pisen; los demás se cuentan abajo, en la lista.
const MAXIMO_EN_PANTALLA = 14

/*
 * Dónde vive cada uno y cuánto campo tiene. Sale del número de animal, no del
 * azar: si fuera al azar, cada vez que entrás la granja se reordenaría y
 * Pocha nunca estaría en el mismo lugar.
 *
 * Saltos de «número de oro»: cada uno cae lo más lejos posible de los que ya
 * están. Con saltos fijos dos conejos quedaban en la misma fila y se chocaban.
 */
function lugarDe(id) {
  const fraccion = (n) => n - Math.floor(n)
  /*
   * El CENTRO de su zona se reparte por todo el campo, y el paseo va de un
   * lado al otro de ese centro. Antes el lugar era el borde izquierdo y el
   * paseo iba siempre hacia la derecha: se amontonaban todos a la izquierda
   * y el lado derecho del campo quedaba vacío.
   */
  const centro = 128 + Math.round(fraccion(id * 0.618034) * 232)
  // Que no se salga del corral para ningún lado.
  // El 372 deja lugar para el cuerpo: el lugar es el centro de las patas y
  // un conejo en 384 quedaba cortado por el borde del dibujo.
  const ancho = Math.min(70 + ((id * 23) % 60), 2 * (centro - 106), 2 * (372 - centro))
  const x = Math.round(centro - ancho / 2)
  const y = 150 + Math.round(fraccion(id * 0.381966 + 0.2) * 34)
  return {
    x,
    y,
    // Cuánto camina a lo ancho.
    ancho,
    // Y a lo profundo, para que no anden todos en fila.
    hondo: 10 + ((id * 7) % 9),
    // Lo de atrás se ve más chico: así parece un campo y no una fila.
    profundidad: 0.8 + ((y - 150) / 34) * 0.3,
    ruta: id % RUTAS.length,
    // Cada uno a su ritmo: si todos caminaran juntos parecería un desfile.
    duracion: 14 + ((id * 7) % 5),
    retardo: -((id * 5.3) % 14),
  }
}

/*
 * En el celular el corral entero mide menos de 300 píxeles de ancho, y a esa
 * escala una gallina quedaba de 25: se movía, pero no se veía que se moviera.
 * En pantallas angostas los animales van más grandes. El paisaje no: un
 * granero gigante no suma nada.
 */
function useAngosta() {
  const consulta = '(max-width: 600px)'
  const [angosta, setAngosta] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(consulta).matches
  )
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const cambio = () => setAngosta(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return angosta
}

function Animal({ a, zoom, saltando, durmiendo, onTocar }) {
  const Dibujo = DIBUJOS[a.especie]
  if (!Dibujo) return null
  const l = lugarDe(a.id)
  const escala = l.profundidad * TAMANO[a.etapa] * zoom

  return (
    <g transform={`translate(${l.x} ${l.y}) scale(${escala})`}>
      <g
        className={`animal ${a.especie} etapa-${a.etapa} ruta-${l.ruta}${durmiendo ? ' durmiendo' : ''}`}
        style={{
          // El recorrido se mide en el corral, pero el grupo está escalado:
          // se divide para que una cría no camine menos que un caballo.
          '--dx': `${l.ancho / escala}px`,
          '--dy': `${l.hondo / escala}px`,
          '--t': `${l.duracion}s`,
          '--retardo': `${l.retardo}s`,
        }}
        role="button"
        tabIndex={0}
        aria-label={`${a.nombre}, ${a.etapaNombre}${durmiendo ? ', durmiendo' : ''}`}
        onClick={(e) => onTocar(a, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTocar(a, e.currentTarget) }
        }}
      >
        <title>{`${a.nombre}, ${a.etapaNombre}`}</title>
        {/* La sombra camina con el animal (adentro de .animal) pero no salta
            con él (afuera de .cuerpo). Afuera de los dos quedaba en el pasto
            sin nadie encima. */}
        <ellipse className="sombra" cx="0" cy="0.5" rx="15" ry="2.6" />
        {/* Un rectángulo invisible para que sea fácil de tocar con el dedo:
            sin él, hay que acertarle justo al dibujo. */}
        <rect x="-24" y="-48" width="52" height="50" fill="transparent" />
        <g className={`toque ${saltando ? 'saltando' : ''}`}>
          <g className="cuerpo">
            <Dibujo />
          </g>
        </g>
        {/* Las «z» de los que duermen. Un animal dormido no camina ni se da
            vuelta, así que el texto nunca queda espejado. */}
        {durmiendo && (
          <g className="zzz" aria-hidden="true">
            <text x="9" y="-33">z</text>
            <text x="14" y="-38">z</text>
            <text x="19" y="-44">Z</text>
          </g>
        )}
      </g>
    </g>
  )
}

/* El huevo del que viene: se mueve cada vez más a medida que se acerca. */
function Huevo({ progreso }) {
  const nervioso = progreso > 75 ? 'mucho' : progreso > 40 ? 'algo' : ''
  return (
    <g transform="translate(100 196)">
      <ellipse className="sombra" cx="0" cy="0.5" rx="8" ry="2" />
      <g className={`huevo ${nervioso}`}>
        <path d="M0 0 C-8 0 -8.4 -9 -6 -14 C-4 -18.5 4 -18.5 6 -14 C8.4 -9 8 0 0 0 Z" fill="#fff7e6" stroke="#e5d4b5" strokeWidth="0.9" />
        <circle cx="-2.4" cy="-10" r="1.1" fill="#e8cfa4" />
        <circle cx="2.6" cy="-6" r="0.9" fill="#e8cfa4" />
        <circle cx="1" cy="-13.4" r="0.7" fill="#e8cfa4" />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------- el cielo */

/*
 * EL CIELO ES EL DE AFUERA. La hora del día y el clima vienen del server
 * (`clima.js`), con el clima real de la ciudad de la persona: si en la granja
 * llueve, es porque está lloviendo. Emanuel: «la granja va cambiando si es de
 * día, de noche, si llueve».
 *
 * Antes el cielo dependía del modo oscuro de la app: modo noche, granja de
 * noche. Ahora no tienen nada que ver, y está bien: la granja es una ventana
 * al campo, no parte de los botones.
 */

// Los estados en los que el cielo está tapado: no hay sol ni estrellas.
const TAPADO = ['nublado', 'niebla', 'llovizna', 'lluvia', 'nieve', 'tormenta']

// Cuántas nubes hay según el clima. Sin dato, dos y livianas: un cielo
// neutro, que no afirma nada.
const NUBES = {
  'despejado': 1, 'algo-nublado': 3, 'nublado': 6, 'niebla': 4, 'llovizna': 6,
  'lluvia': 7, 'nieve': 6, 'tormenta': 7,
}

const LUGARES_NUBE = [
  [60, 38, 1], [220, 26, 1.2], [320, 58, 0.9], [140, 62, 0.8],
  [10, 70, 1.1], [270, 18, 1], [380, 34, 1.15],
]

// Gotas y copos: posiciones fijas que se reparten por el cielo, para que la
// lluvia no cambie cada vez que se redibuja.
function particulas(n, semilla) {
  return Array.from({ length: n }, (_, i) => {
    const f = (k) => ((i + 1) * k + semilla) % 1
    return {
      x: Math.round(f(0.618034) * 420) - 10,
      y: Math.round(f(0.381966) * 220),
      retardo: -(f(0.7548776) * 1.2).toFixed(2),
      largo: 6 + Math.round(f(0.5698403) * 5),
    }
  })
}

const GOTAS = { llovizna: 26, lluvia: 48, tormenta: 70 }

function Cielo({ clima }) {
  const estado = clima?.estado
  const tapado = TAPADO.includes(estado)
  const arco = clima?.arco
  // El sol (o la luna) hace un arco de izquierda a derecha: sale bajo, sube
  // al mediodía y se pone bajo.
  const f = arco ? arco.fraccion : 0.7
  const ax = 30 + f * 340
  const ay = 82 - Math.sin(Math.PI * f) * 56
  const esLuna = arco ? arco.astro === 'luna' : false
  const cuantas = estado ? NUBES[estado] : 2

  return (
    <>
      <rect x="0" y="0" width="400" height="140" fill="url(#granja-cielo)" />

      <g className="estrellas">
        {[[40, 22], [92, 14], [150, 30], [205, 12], [262, 26], [300, 10], [372, 30], [128, 52], [232, 48],
          [20, 50], [180, 8], [342, 66]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.3 : 0.9} style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </g>

      {/* El sol o la luna, en su lugar del arco. Tapado por las nubes, apenas
          se adivina. */}
      <g className={`astro ${esLuna ? 'luna' : 'sol'} ${tapado ? 'tapado' : ''}`}>
        {!esLuna && <circle className="resplandor" cx={ax} cy={ay} r="28" />}
        <circle className="disco" cx={ax} cy={ay} r={esLuna ? 13 : 16} />
        {esLuna && (
          <>
            <circle className="crater" cx={ax - 4} cy={ay - 3} r="2.6" />
            <circle className="crater" cx={ax + 4} cy={ay + 4} r="1.8" />
          </>
        )}
      </g>

      <g className="nubes">
        {LUGARES_NUBE.slice(0, cuantas).map(([x, y, s], i) => (
          <g key={i} className="nube" style={{
            animationDuration: `${(clima?.ventoso ? 40 : 80) + i * 13}s`,
            animationDelay: `-${i * 17}s`,
          }}>
            <g transform={`translate(${x} ${y}) scale(${s})`}>
              <ellipse cx="0" cy="4" rx="22" ry="7" />
              <ellipse cx="11" cy="-1" rx="12" ry="8.5" />
              <ellipse cx="-9" cy="1" rx="10" ry="6.5" />
            </g>
          </g>
        ))}
      </g>
    </>
  )
}

/* Lo que pasa adelante de todo: lluvia, nieve, niebla, rayos. */
function Tiempo({ clima }) {
  const estado = clima?.estado
  if (!estado) return null
  const gotas = GOTAS[estado] ? GOTAS[estado] + (clima.fuerte ? 20 : 0) : 0

  return (
    <g className="tiempo" aria-hidden="true">
      {gotas > 0 && (
        <g className={`lluvia ${estado === 'llovizna' ? 'fina' : ''} ${clima.ventoso ? 'ventosa' : ''}`}>
          {particulas(gotas, 0.13).map((g, i) => (
            <line key={i} x1={g.x} y1={g.y - 220} x2={g.x - 2} y2={g.y - 220 + g.largo}
                  style={{ animationDelay: `${g.retardo}s` }} />
          ))}
        </g>
      )}

      {estado === 'nieve' && (
        <g className="nieve">
          {particulas(clima.fuerte ? 60 : 38, 0.29).map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y - 220} r={1 + (i % 3) * 0.5}
                    style={{ animationDelay: `${c.retardo * 4}s` }} />
          ))}
        </g>
      )}

      {estado === 'niebla' && (
        <g className="niebla" filter="url(#granja-difuso)">
          <ellipse cx="120" cy="150" rx="190" ry="22" />
          <ellipse cx="300" cy="172" rx="200" ry="20" style={{ animationDelay: '-9s' }} />
          <ellipse cx="80" cy="198" rx="170" ry="18" style={{ animationDelay: '-17s' }} />
        </g>
      )}

      {/*
        El rayo es un fogonazo suave y espaciado, no un estroboscopio: un
        destello blanco fuerte y repetido es justo lo que no hay que mostrarle
        a alguien sensible a la luz. Con «reducir movimiento» no aparece.
      */}
      {estado === 'tormenta' && (
        <g className="rayo">
          <rect className="fogonazo" x="0" y="0" width="400" height="220" />
          <path className="chispa" d="M262 18 L250 52 L260 52 L246 92 L272 46 L261 46 L272 18 Z" />
        </g>
      )}
    </g>
  )
}

function Escena({ animales, progresoProximo, saltando, onTocar, clima }) {
  const zoom = useAngosta() ? 1.4 : 1
  // Se dibujan de atrás para adelante: el que está más abajo tapa al de atrás.
  const visibles = animales.slice(-MAXIMO_EN_PANTALLA)
    .slice()
    .sort((x, y) => lugarDe(x.id).y - lugarDe(y.id).y)

  const momento = clima?.momento || 'dia'
  const estado = clima?.estado || 'sin-dato'
  const mojado = ['llovizna', 'lluvia', 'tormenta'].includes(estado)
  // De noche duerme la mitad; la otra mitad sigue dando vueltas. Si
  // durmieran todos, de noche la granja sería un cuadro quieto, que es
  // exactamente lo que no tiene que ser.
  const duerme = (a) => momento === 'noche' && a.id % 2 === 0

  const clases = [
    'granja-escena',
    `momento-${momento}`,
    `clima-${estado}`,
    TAPADO.includes(estado) ? 'tapado' : '',
    clima?.fuerte ? 'fuerte' : '',
  ].filter(Boolean).join(' ')

  const etiqueta = clima?.frase
    ? `${clima.frase.dice} en ${clima.ciudad}, ${momento === 'noche' ? 'de noche' : momento === 'dia' ? 'de día' : momento}`
    : `Tu granja, ${momento === 'noche' ? 'de noche' : 'de día'}`

  return (
    <svg className={clases} viewBox="0 0 400 220" role="group"
         aria-label={`${etiqueta}: ${animales.length} ${animales.length === 1 ? 'animal' : 'animales'}`}>
      <style>{MOVIMIENTOS}</style>
      <defs>
        <linearGradient id="granja-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cielo-arriba)' }} />
          <stop offset="1" style={{ stopColor: 'var(--cielo-abajo)' }} />
        </linearGradient>
        <filter id="granja-difuso" x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="granja-farol">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <Cielo clima={clima} />

      <path className="loma" d="M0 128 Q60 96 130 118 T260 112 T400 116 V150 H0 Z" />
      <rect className="pasto" x="0" y="134" width="400" height="86" />
      <path className="pasto-frente" d="M0 186 Q100 176 200 184 T400 180 V220 H0 Z" />

      {/* Charcos cuando llueve: abajo de los animales, que los pisan. */}
      {mojado && (
        <g className="charcos">
          <ellipse cx="150" cy="200" rx="22" ry="3.4" />
          <ellipse cx="300" cy="174" rx="16" ry="2.6" />
          <ellipse cx="240" cy="208" rx="13" ry="2.2" />
        </g>
      )}

      {/* El granero, a la izquierda, siempre. */}
      <g className="granero">
        <path d="M18 150 V102 L55 78 L92 102 V150 Z" className="granero-pared" />
        <path d="M12 104 L55 74 L98 104 L92 108 L55 82 L18 108 Z" className="granero-techo" />
        <rect x="40" y="118" width="30" height="32" className="granero-puerta" />
        <path d="M40 118 L70 150 M70 118 L40 150" stroke="#fff6ea" strokeWidth="2" />
        <rect x="40" y="118" width="30" height="32" fill="none" stroke="#fff6ea" strokeWidth="2" />
        <circle cx="55" cy="99" r="5" className="granero-ventana" />
      </g>
      <g className="fardo">
        <rect x="70" y="140" width="22" height="14" rx="3" />
        <path d="M74 140 V154 M88 140 V154" />
      </g>

      {/* El alambrado del fondo */}
      <g className="alambrado">
        <path d="M98 140 H400 M98 133 H400" />
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={104 + i * 29} y="128" width="3.4" height="16" rx="1" />
        ))}
      </g>

      {visibles.map((a) => (
        <Animal key={a.id} a={a} zoom={zoom} saltando={saltando === a.id}
                durmiendo={duerme(a)} onTocar={onTocar} />
      ))}

      <Huevo progreso={progresoProximo} />

      {/* La luz del momento, encima de todo lo que está en el campo: de noche
          oscurece también a los animales, como pasa de verdad. No se puede
          tocar: los clics tienen que llegar a los animales de abajo. */}
      <rect className="velo" x="0" y="0" width="400" height="220" />

      {/* La ventana del granero se prende de noche, y va encima del velo:
          es lo único que alumbra. */}
      <g className="farol">
        <circle cx="55" cy="99" r="20" fill="url(#granja-farol)" />
        <circle cx="55" cy="99" r="5" fill="#ffe3a3" />
      </g>

      <Tiempo clima={clima} />
    </svg>
  )
}

/** Lo que dice abajo del corral: el clima de afuera, y dónde. */
function Pronostico({ clima, onCambiarCiudad }) {
  if (!clima) return null
  return (
    <p className="granja-pista">
      {clima.frase
        ? <>{clima.frase.emoji} {clima.frase.dice}{clima.temperatura != null ? ` · ${clima.temperatura}°` : ''} en {clima.ciudad}</>
        : <>En {clima.ciudad}</>}
      {' · '}
      <button type="button" className="link" onClick={onCambiarCiudad}>
        {clima.porDefecto ? '¿Estás en otra ciudad?' : 'cambiar'}
      </button>
    </p>
  )
}

/* ============================================================ la pantalla */

/**
 * Pide un nombre nuevo y lo guarda. Vacío vuelve al que le había tocado.
 * Devuelve el progreso nuevo, o null si se arrepintió.
 */
async function renombrar(a, pedirTexto) {
  const texto = await pedirTexto({
    titulo: `¿Cómo se llama ${a.nombre === a.nombreOriginal ? 'tu ' + a.etapaNombre : a.nombre}?`,
    detalle: a.nombre === a.nombreOriginal
      ? `Ahora se llama ${a.nombre}. Ponele el que quieras.`
      : `Si lo dejás vacío vuelve a llamarse ${a.nombreOriginal}.`,
    valor: a.nombre,
    placeholder: a.nombreOriginal,
    aceptar: 'Guardar',
  })
  if (texto == null) return null
  return api(`/granja/${a.id}`, { method: 'PATCH', body: JSON.stringify({ nombre: texto }) })
}

export default function Granja({ progreso, onCambio, onError }) {
  const { pedirTexto, pedirOpcion } = useDialogos()
  const corral = useRef(null)
  const [saltando, setSaltando] = useState(null)
  const [globo, setGlobo] = useState(null)
  const [clima, setClima] = useState(null)

  /*
   * El cielo se vuelve a pedir cada 10 minutos mientras la pantalla está
   * abierta: así el atardecer llega solo, sin recargar. El server guarda el
   * clima 15 minutos por ciudad, así que esto no le pega a Open-Meteo cada
   * vez. Si falla, la granja se dibuja igual con un cielo de día neutro.
   */
  useEffect(() => {
    let vivo = true
    const pedir = () => api('/clima').then((c) => { if (vivo) setClima(c) }).catch(() => {})
    pedir()
    const t = setInterval(pedir, 10 * 60 * 1000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  // El globito se va solo a los cinco segundos.
  useEffect(() => {
    if (!globo) return
    const t = setTimeout(() => setGlobo(null), 5000)
    return () => clearTimeout(t)
  }, [globo])

  useEffect(() => {
    if (saltando == null) return
    const t = setTimeout(() => setSaltando(null), 700)
    return () => clearTimeout(t)
  }, [saltando])

  if (!progreso || !progreso.granja) return null
  const { animales, proximo, total } = progreso.granja
  const { racha, mejorRacha, rachaHoy } = progreso

  /*
   * Tocar un animal: salta, y arriba aparece un globito con su nombre y un
   * corazón. El globito es HTML encima del dibujo y no parte del SVG: el
   * animal se espeja al darse vuelta, y un texto adentro se leería al revés.
   */
  function tocar(a, elemento) {
    setSaltando(a.id)
    const caja = corral.current.getBoundingClientRect()
    const r = elemento.getBoundingClientRect()
    setGlobo({
      id: a.id,
      x: Math.min(Math.max(r.left + r.width / 2 - caja.left, 70), caja.width - 70),
      y: Math.max(r.top - caja.top + r.height * 0.25, 30),
      clave: Date.now(),
    })
  }

  async function cambiarNombre(a) {
    setGlobo(null)
    try {
      const nuevo = await renombrar(a, pedirTexto)
      if (nuevo) onCambio(nuevo)
    } catch (err) {
      onError(err.message)
    }
  }

  /*
   * Elegir la ciudad para el clima. Hay un San Martín en cada provincia, así
   * que si aparece más de una se pregunta cuál, con la provincia al lado.
   */
  async function cambiarCiudad() {
    const texto = await pedirTexto({
      titulo: '¿En qué ciudad estás?',
      detalle: 'Para que en la granja haga el mismo tiempo que afuera.',
      placeholder: 'Rosario, Córdoba, Mar del Plata…',
      aceptar: 'Buscar',
    })
    if (!texto || !texto.trim()) return
    try {
      const encontradas = await api(`/clima/buscar?q=${encodeURIComponent(texto.trim())}`)
      if (!encontradas.length) return onError(`No encontré «${texto.trim()}». Probá con otro nombre.`)
      let elegida = encontradas[0]
      if (encontradas.length > 1) {
        const cual = await pedirOpcion({
          titulo: '¿Cuál de estas?',
          opciones: encontradas.map((c, i) => ({ valor: String(i), nombre: c.nombre, sub: c.donde })),
        })
        if (cual == null) return
        elegida = encontradas[Number(cual)]
      }
      setClima(await api('/clima/ciudad', {
        method: 'PUT',
        body: JSON.stringify({ nombre: elegida.nombre, lat: elegida.lat, lon: elegida.lon }),
      }))
    } catch (err) {
      onError(err.message)
    }
  }

  const delGlobo = globo && animales.find((a) => a.id === globo.id)

  return (
    <section className="card granja-card">
      <div className="card-title-row">
        <h2>Tu granja</h2>
        <span className="tag">
          {total === 0 ? 'vacía' : `${total} ${total === 1 ? 'animal' : 'animales'}`}
        </span>
      </div>

      <div className="granja-grilla">
        <div className="granja-corral" ref={corral}>
          <Escena
            animales={animales}
            progresoProximo={proximo.progreso}
            saltando={saltando}
            onTocar={tocar}
            clima={clima}
          />
          {delGlobo && (
            <div className="granja-globo" key={globo.clave} style={{ left: globo.x, top: globo.y }}>
              <span className="granja-corazon" aria-hidden="true">❤</span>
              <strong>{delGlobo.nombre}</strong>
              <span className="granja-globo-meta">{delGlobo.etapaNombre}</span>
              <button type="button" className="link" onClick={() => cambiarNombre(delGlobo)}>
                Cambiar nombre
              </button>
            </div>
          )}
          <Pronostico clima={clima} onCambiarCiudad={cambiarCiudad} />
          {total > 0 && <p className="granja-pista">Tocá un animal para saludarlo.</p>}
        </div>

        <div className="granja-lado">
          <div className="granja-proximo">
            <span className="granja-proximo-ico" aria-hidden="true">🥚</span>
            <div className="granja-proximo-txt">
              <div className="granja-proximo-titulo">
                {proximo.nace
                  ? `Está por nacer un ${proximo.etapaNombre}`
                  : `Viene un ${proximo.etapaNombre}`}
              </div>
              <div className="arbol-barra" role="img"
                   aria-label={`Vas ${Math.round(proximo.progreso)}% hacia el próximo animal`}>
                <div style={{ width: `${proximo.progreso}%` }} />
              </div>
              <div className="arbol-falta">faltan {proximo.faltan} puntos</div>
            </div>
          </div>

          <div className={`racha ${racha === 0 ? 'apagada' : ''}`}>
            🔥 {racha === 0
              ? 'Sin racha — anotá algo hoy'
              : `${racha} ${racha === 1 ? 'día' : 'días'} seguidos`}
          </div>
          {mejorRacha > racha && (
            <p className="hint">Tu mejor racha fue de {mejorRacha} días</p>
          )}
          {racha > 0 && !rachaHoy && (
            <p className="hint">Todavía no anotaste nada hoy. No la cortes.</p>
          )}

          {/* Lo que antes era una tarjeta aparte al final de la pantalla:
              acá llena el costado, que si no queda corto al lado del corral. */}
          <p className="granja-como">
            Anotar suma poco y tiene tope por día. Lo que de verdad trae
            animales es <strong>gastar mejor</strong>: cerrar el mes en verde,
            no pasarte de los presupuestos, juntar para una meta e invertir.
          </p>
        </div>
      </div>

      {/* La lista va abajo y a lo ancho, en columnas. Al costado del corral
          era mucho más alta que el dibujo y dejaba un hueco blanco enorme. */}
      {total === 0 ? (
        <p className="hint granja-vacia">
          Todavía no llegó nadie. Con cada cosa que anotás, cada mes que
          cerrás en verde y cada meta que cumplís van llegando animales, y
          cada uno crece mientras seguís sumando.
        </p>
      ) : (
        <div className="granja-lista">
          {animales.slice().reverse().slice(0, 12).map((a) => (
            <div className="granja-bicho" key={a.id}>
              <span className="granja-bicho-ico" aria-hidden="true">{a.emoji}</span>
              <span className="granja-bicho-txt">
                <button
                  type="button"
                  className="granja-bicho-nombre"
                  onClick={() => cambiarNombre(a)}
                  aria-label={`Cambiarle el nombre a ${a.nombre}`}
                >
                  {a.nombre} <span className="granja-lapiz" aria-hidden="true">✎</span>
                </button>
                <span className="granja-bicho-meta">
                  {a.etapa === 2
                    ? a.etapaNombre
                    : `${a.etapaNombre} · le faltan ${a.faltaParaCrecer} para ${a.proximaEtapa}`}
                </span>
              </span>
              {a.etapa < 2 && (
                <span className="granja-bicho-crece" aria-hidden="true">
                  <span style={{ width: `${a.crece}%` }} />
                </span>
              )}
            </div>
          ))}
          {total > 12 && (
            <p className="hint">
              Y {total - 12} más{total > MAXIMO_EN_PANTALLA ? ' (en el corral se ven los últimos 14)' : ''}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
