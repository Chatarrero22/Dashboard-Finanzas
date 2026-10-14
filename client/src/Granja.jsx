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

function Perro() {
  const pata = (x) => <rect x={x} y="-8" width="3.6" height="8" rx="1.5" fill="#c98d55" />
  return (
    <>
      <g className="pata a">{pata(-12)}{pata(4)}</g>
      <g className="pata b">{pata(-6)}{pata(9)}</g>
      {/* La cola para arriba: un perro contento la mueve rápido. */}
      <g className="cola">
        <path d="M-14 -16 Q-21 -22 -18.5 -29" fill="none" stroke="#d9a066" strokeWidth="3.2" strokeLinecap="round" />
      </g>
      <ellipse cx="-1" cy="-13.5" rx="14" ry="8" fill="#d9a066" />
      <ellipse cx="8" cy="-12.5" rx="4" ry="5" fill="#fff5e6" />
      <g className="cabeza">
        <circle cx="13" cy="-22" r="7.6" fill="#d9a066" />
        <ellipse cx="19.2" cy="-19.4" rx="4.6" ry="3.4" fill="#fff5e6" />
        <ellipse cx="22.6" cy="-20.6" rx="1.7" ry="1.3" fill="#3a2a20" />
        <path d="M19.5 -16.8 q1.2 2.6 2.6 0" fill="#ff8fa3" />
        <g className="orejas">
          <ellipse cx="8.6" cy="-23.4" rx="2.7" ry="5.6" fill="#a8703f" transform="rotate(22 8.6 -23.4)" />
        </g>
        <Ojo x={14.6} y={-24} r={1.3} />
        <Cachete x={12} y={-19.6} r={1.6} />
      </g>
    </>
  )
}

function Gato() {
  const pata = (x) => <rect x={x} y="-7" width="2.7" height="7" rx="1.2" fill="#e8944f" />
  return (
    <>
      <g className="pata a">{pata(-10)}{pata(4)}</g>
      <g className="pata b">{pata(-5)}{pata(8)}</g>
      <g className="cola">
        <path d="M-12 -12 Q-24 -15 -21 -29 Q-20 -33 -17 -30" fill="none" stroke="#f0a35e" strokeWidth="2.7" strokeLinecap="round" />
      </g>
      <ellipse cx="-1" cy="-11.5" rx="12" ry="7" fill="#f0a35e" />
      <path d="M-6 -17.5 q1 3 0 6 M-1 -18.4 q1 3 0 6.4 M4 -17.8 q1 3 0 6" fill="none" stroke="#d27b36" strokeWidth="1.3" strokeLinecap="round" />
      <g className="cabeza">
        <g className="orejas">
          <path d="M6 -24.4 L7.4 -31.4 L11 -26 Z" fill="#f0a35e" />
          <path d="M7.4 -25.4 L8 -29 L9.6 -26.4 Z" fill="#f4b8c4" />
          <path d="M12 -26.4 L15.6 -31.4 L16.4 -24.4 Z" fill="#f0a35e" />
          <path d="M13.4 -26.2 L15.2 -29 L15.6 -25.6 Z" fill="#f4b8c4" />
        </g>
        <circle cx="11.4" cy="-20" r="6.6" fill="#f0a35e" />
        <path d="M14.6 -18.4 l2.2 1.2 M14.6 -17.4 l2.4 0.2 M14 -16.6 l2 1.2" stroke="#fff5e6" strokeWidth="0.5" strokeLinecap="round" />
        <circle cx="16.6" cy="-19.4" r="0.9" fill="#e8768f" />
        <Ojo x={13.4} y={-21.4} r={1.25} />
        <Cachete x={10.6} y={-17.6} r={1.5} />
      </g>
    </>
  )
}

function Cabra() {
  const pata = (x) => (
    <>
      <rect x={x} y="-9.5" width="2.9" height="9.5" rx="1.2" fill="#ece7df" stroke="#d6cfc3" strokeWidth="0.6" />
      <rect x={x} y="-2" width="2.9" height="2" rx="0.6" fill="#5b4f45" />
    </>
  )
  return (
    <>
      <g className="pata a">{pata(-11)}{pata(4)}</g>
      <g className="pata b">{pata(-6)}{pata(9)}</g>
      <g className="cola"><path d="M-14 -20 L-18 -26.5 L-12.4 -22.4 Z" fill="#ece7df" /></g>
      <ellipse cx="-1" cy="-17" rx="14" ry="8.6" fill="#f3efe8" stroke="#d6cfc3" strokeWidth="0.8" />
      <ellipse cx="-4" cy="-19" rx="6" ry="3.4" fill="#e3ddd2" />
      <g className="cabeza">
        <path d="M11 -30.5 Q8 -38 3.4 -36.6" fill="none" stroke="#9b8f80" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M13.6 -31 Q11.6 -38.6 7 -38" fill="none" stroke="#8a7f71" strokeWidth="1.9" strokeLinecap="round" />
        <ellipse cx="9.4" cy="-27.6" rx="3.6" ry="1.5" fill="#ece7df" stroke="#d6cfc3" strokeWidth="0.6" transform="rotate(-20 9.4 -27.6)" />
        <ellipse cx="15" cy="-25" rx="5.4" ry="6.6" fill="#f3efe8" stroke="#d6cfc3" strokeWidth="0.8" transform="rotate(-22 15 -25)" />
        {/* La barbita, que es lo que la hace cabra y no oveja pelada. */}
        <path d="M17.4 -19.4 L16.6 -13.6 L19.4 -18.4 Z" fill="#cfc6b8" />
        <circle cx="19.6" cy="-21.6" r="0.8" fill="#8a7f71" />
        <Ojo x={15.8} y={-26.4} r={1.2} />
      </g>
    </>
  )
}

function Burro() {
  const pata = (x) => (
    <>
      <rect x={x} y="-13" width="3.5" height="13" rx="1.5" fill="#8b857d" />
      <rect x={x - 0.2} y="-2.4" width="3.9" height="2.4" rx="0.8" fill="#3d3832" />
    </>
  )
  return (
    <>
      <g className="pata a">{pata(-14)}{pata(7)}</g>
      <g className="pata b">{pata(-8)}{pata(12)}</g>
      <g className="cola">
        <path d="M-17 -22 Q-21 -17 -20 -11" fill="none" stroke="#8b857d" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="-20" cy="-10" rx="1.8" ry="2.8" fill="#4a443d" />
      </g>
      <ellipse cx="-1" cy="-20" rx="17" ry="9.2" fill="#9c968e" />
      <ellipse cx="0" cy="-14.6" rx="11" ry="3.6" fill="#cfc9bf" />
      <g className="cabeza">
        <path d="M9 -24 L16 -36 L22 -33 L17 -19 Z" fill="#9c968e" />
        <path d="M10 -25 Q12 -34 16.6 -37.6 L15.8 -33 Q13 -29 13 -23 Z" fill="#4a443d" />
        <g className="orejas">
          <ellipse cx="17" cy="-43" rx="2.1" ry="6.4" fill="#9c968e" transform="rotate(-10 17 -43)" />
          <ellipse cx="17" cy="-43" rx="1" ry="4.4" fill="#4a443d" transform="rotate(-10 17 -43)" />
          <ellipse cx="21" cy="-42" rx="2.1" ry="6.2" fill="#9c968e" transform="rotate(14 21 -42)" />
        </g>
        <ellipse cx="22" cy="-33" rx="7.8" ry="5" fill="#9c968e" transform="rotate(28 22 -33)" />
        <ellipse cx="26.2" cy="-29.8" rx="3.8" ry="3.1" fill="#d8d2c8" transform="rotate(28 26.2 -29.8)" />
        <circle cx="27.6" cy="-29.2" r="0.7" fill="#3d3832" />
        <Ojo x={20.4} y={-35.4} r={1.25} />
      </g>
    </>
  )
}

function Llama() {
  const pata = (x) => <rect x={x} y="-13" width="3" height="13" rx="1.3" fill="#e3d3b4" />
  return (
    <>
      <g className="pata a">{pata(-11)}{pata(5)}</g>
      <g className="pata b">{pata(-6)}{pata(9)}</g>
      <g className="cola"><ellipse cx="-15" cy="-23" rx="3" ry="2.4" fill="#efe2c8" /></g>
      <ellipse cx="-1" cy="-21" rx="14" ry="8.6" fill="#efe2c8" />
      <g fill="#f5ead6">
        <circle cx="-9" cy="-26" r="3.4" /><circle cx="-3" cy="-28" r="3.6" /><circle cx="3.4" cy="-27.4" r="3.4" />
      </g>
      {/* La manta de colores, como en el norte. */}
      <rect x="-7" y="-28.6" width="12" height="7" rx="1.6" fill="#d64545" />
      <path d="M-7 -26.4 H5 M-7 -23.8 H5" stroke="#f2c14e" strokeWidth="1.1" />
      <path d="M-7 -25.1 H5" stroke="#2f9e8f" strokeWidth="0.9" />
      <g className="cabeza">
        <rect x="7" y="-45" width="6.4" height="22" rx="3.2" fill="#efe2c8" />
        <ellipse cx="14.4" cy="-46" rx="5.6" ry="4.6" fill="#efe2c8" />
        <ellipse cx="18.6" cy="-44.6" rx="3" ry="2.6" fill="#e3d3b4" />
        <circle cx="20.4" cy="-45.4" r="0.6" fill="#7a6650" />
        <g className="orejas">
          <ellipse cx="11.2" cy="-53" rx="1.6" ry="4.2" fill="#efe2c8" transform="rotate(-14 11.2 -53)" />
          <ellipse cx="14.6" cy="-53.4" rx="1.6" ry="4.2" fill="#efe2c8" transform="rotate(10 14.6 -53.4)" />
          {/* Los pompones en las orejas. */}
          <circle cx="10.2" cy="-57.4" r="1.6" fill="#e84a8a" />
          <circle cx="15.4" cy="-57.8" r="1.6" fill="#f2c14e" />
        </g>
        <Ojo x={15.2} y={-47.4} r={1.15} />
        <Cachete x={13.6} y={-43.4} r={1.4} />
      </g>
    </>
  )
}

function Carpincho() {
  const pata = (x) => <rect x={x} y="-4.6" width="3.8" height="4.6" rx="1.4" fill="#8c6339" />
  return (
    <>
      <g className="pata a">{pata(-13)}{pata(6)}</g>
      <g className="pata b">{pata(-7)}{pata(11)}</g>
      <ellipse cx="-1" cy="-11" rx="17" ry="9.4" fill="#a3764a" />
      <ellipse cx="-3" cy="-15" rx="10" ry="3.4" fill="#ad8255" />
      {/* El pajarito en el lomo: un carpincho grande siempre tiene uno. */}
      <g className="pajarito">
        <ellipse cx="-3" cy="-21.6" rx="3.2" ry="2.6" fill="#f2c14e" />
        <circle cx="-0.8" cy="-23.4" r="1.9" fill="#f2c14e" />
        <path d="M0.9 -23.6 L3 -23 L0.9 -22.6 Z" fill="#e8962a" />
        <circle cx="-0.4" cy="-23.9" r="0.45" fill="#2a1c0c" />
        <path d="M-6 -21.6 L-8 -23 L-6.6 -20.6 Z" fill="#e2ac2e" />
      </g>
      <g className="cabeza">
        <circle cx="12.4" cy="-23" r="1.9" fill="#8c6339" />
        <rect x="10" y="-22.6" width="15" height="11.6" rx="5.2" fill="#a3764a" />
        <rect x="21" y="-20.4" width="5" height="8" rx="2.4" fill="#8c6339" />
        <circle cx="24.4" cy="-18" r="0.7" fill="#4b331d" />
        {/* Ojitos tranquilos: el carpincho no se inmuta por nada. */}
        <Ojo x={17.6} y={-18.6} r={1.05} />
        <Cachete x={16.4} y={-14.6} r={1.5} />
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
  perro: Perro,
  gato: Gato,
  cabra: Cabra,
  burro: Burro,
  llama: Llama,
  carpincho: Carpincho,
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

/*
 * Qué tan alto es cada uno (la punta de la cabeza) y dónde tiene la panza,
 * en las unidades del dibujo. Sirve para poner el globito del hambre arriba
 * de la cabeza y el barro sobre el cuerpo, y no en el aire.
 */
const ALTO = {
  gallina: 34, conejo: 42, chancho: 30, oveja: 28, pato: 30, vaca: 42, caballo: 55,
  perro: 30, gato: 31, cabra: 38, burro: 50, llama: 60, carpincho: 25,
}
const PANZA = {
  gallina: 14, conejo: 11, chancho: 13, oveja: 15, pato: 10, vaca: 20, caballo: 26,
  perro: 14, gato: 12, cabra: 17, burro: 20, llama: 21, carpincho: 11,
}

const corazon = 'M0 -2 C-2 -5.5 -6.5 -2.5 0 3 C6.5 -2.5 2 -5.5 0 -2 Z'

/* Pide comida: un globito con granos arriba de la cabeza. */
function Pide({ alto }) {
  return (
    <g className="pide" transform={`translate(13 ${-alto - 7})`}>
      <circle cx="-7" cy="8" r="1.2" className="pide-globo" />
      <circle cx="-4" cy="4.6" r="1.9" className="pide-globo" />
      <circle cx="0" cy="-3" r="7" className="pide-globo" />
      <ellipse cx="-2.6" cy="-2" rx="1.4" ry="2" className="pide-grano" />
      <ellipse cx="0.4" cy="-4.4" rx="1.4" ry="2" className="pide-grano" />
      <ellipse cx="2.8" cy="-1.4" rx="1.4" ry="2" className="pide-grano" />
    </g>
  )
}

/* Barro sobre el cuerpo del que hace días que no se baña. */
function Barro({ panza }) {
  return (
    <g className="barro" aria-hidden="true">
      <ellipse cx="-6" cy={-panza - 2} rx="3.4" ry="2.2" />
      <ellipse cx="4" cy={-panza + 2} rx="2.6" ry="1.8" />
      <ellipse cx="-1" cy={-panza + 5} rx="2" ry="1.3" />
      <circle cx="7" cy={-panza - 3} r="1.1" />
    </g>
  )
}

/*
 * Lo que se ve cuando lo cuidás. Va adentro del animal, así acompaña su
 * lugar; el animal está quieto mientras tanto (ver `.ocupado`), así que lo
 * que se dibuja no se va caminando.
 */
function Efecto({ tipo, alto, panza }) {
  if (tipo === 'comer') {
    return (
      <g className="efecto comer">
        {[[14, 0.4], [17, -0.8], [20, 0.6], [23, -0.4], [16, 1.2], [21, 1.4]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="1.4" ry="0.9" className="grano" />
        ))}
      </g>
    )
  }
  if (tipo === 'banar') {
    return (
      <g className="efecto banar">
        {[[-12, -panza, 3], [-4, -panza - 8, 4], [6, -panza - 4, 3.2], [12, -panza + 2, 2.4],
          [0, -panza + 4, 2.8], [-9, -panza + 4, 2], [9, -panza - 10, 2.2]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} className="burbuja" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>
    )
  }
  if (tipo === 'premio') {
    return (
      <g className="efecto premio" transform={`translate(4 ${-alto - 6})`}>
        <g className="regalo">
          <rect x="-5" y="-5" width="10" height="9" rx="1.4" fill="#e5484d" />
          <rect x="-1" y="-5" width="2" height="9" fill="#f2c14e" />
          <rect x="-6" y="-7" width="12" height="3" rx="1" fill="#ef6b6f" />
          <path d="M0 -7 C-4 -12 -7 -8 0 -7 C7 -8 4 -12 0 -7 Z" fill="#f2c14e" />
        </g>
      </g>
    )
  }
  if (tipo === 'mimar') {
    return (
      <g className="efecto mimar" transform={`translate(6 ${-alto})`}>
        {[[-6, 0, 1], [3, -3, 1.3], [10, 2, 0.9]].map(([x, y, s], i) => (
          <path key={i} d={corazon} transform={`translate(${x} ${y}) scale(${s})`}
                className="corazon" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </g>
    )
  }
  if (tipo === 'crecio') {
    // Un estallido de brillos alrededor: es el momento que se festeja.
    return (
      <g className="efecto crecio" transform={`translate(0 ${-panza})`}>
        {Array.from({ length: 10 }, (_, i) => {
          const ang = (i / 10) * Math.PI * 2
          return (
            <g key={i} transform={`rotate(${(ang * 180) / Math.PI})`}>
              <path d="M0 -2 L1 0 L0 2 L-1 0 Z" className="brillo" transform="translate(0 -14) scale(1.6)"
                    style={{ animationDelay: `${(i % 3) * 0.08}s` }} />
            </g>
          )
        })}
      </g>
    )
  }
  return null
}

function Animal({ a, zoom, saltando, durmiendo, seleccionado, efecto, onTocar }) {
  const Dibujo = DIBUJOS[a.especie]
  if (!Dibujo) return null
  const l = lugarDe(a.id)
  const escala = l.profundidad * TAMANO[a.etapa] * zoom
  const alto = ALTO[a.especie] || 34
  const panza = PANZA[a.especie] || 14
  // Mientras lo cuidás se queda quieto: si siguiera caminando, la comida
  // quedaría en el pasto y él en otro lado.
  const ocupado = seleccionado || Boolean(efecto)

  const clases = [
    'animal', a.especie, `etapa-${a.etapa}`, `ruta-${l.ruta}`,
    durmiendo ? 'durmiendo' : '',
    ocupado ? 'ocupado' : '',
    efecto ? `efecto-${efecto.tipo}` : '',
  ].filter(Boolean).join(' ')

  const estado = [a.hambre ? 'tiene hambre' : '', a.sucio ? 'tiene barro' : '', durmiendo ? 'durmiendo' : '']
    .filter(Boolean).join(', ')

  return (
    <g transform={`translate(${l.x} ${l.y}) scale(${escala})`}>
      <g
        className={clases}
        data-id={a.id}
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
        aria-pressed={seleccionado}
        aria-label={`${a.nombre}, ${a.etapaNombre}${estado ? ', ' + estado : ''}`}
        onClick={() => onTocar(a)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTocar(a) }
        }}
      >
        <title>{`${a.nombre}, ${a.etapaNombre}`}</title>
        {/* El elegido tiene un anillo: así se sabe a quién estás cuidando. */}
        {seleccionado && <ellipse className="anillo" cx="2" cy="0.5" rx="21" ry="4.6" />}
        {/* La sombra camina con el animal (adentro de .animal) pero no salta
            con él (afuera de .cuerpo). Afuera de los dos quedaba en el pasto
            sin nadie encima. */}
        <ellipse className="sombra" cx="0" cy="0.5" rx="15" ry="2.6" />
        {/* Un rectángulo invisible para que sea fácil de tocar con el dedo:
            sin él, hay que acertarle justo al dibujo. */}
        <rect x="-24" y={-alto - 6} width="52" height={alto + 8} fill="transparent" />
        <g className={`toque ${saltando ? 'saltando' : ''} ${efecto?.tipo === 'crecio' ? 'creciendo' : ''}`}>
          <g className="cuerpo">
            <Dibujo />
            {a.sucio && efecto?.tipo !== 'banar' && <Barro panza={panza} />}
          </g>
        </g>
        {a.hambre && !durmiendo && !ocupado && <Pide alto={alto} />}
        {efecto && <Efecto key={efecto.clave} tipo={efecto.tipo} alto={alto} panza={panza} />}
        {/* Las «z» de los que duermen. Un animal dormido no camina ni se da
            vuelta, así que el texto nunca queda espejado. */}
        {durmiendo && !efecto && (
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

function Escena({ animales, progresoProximo, saltando, seleccion, efecto, onTocar, clima }) {
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
                durmiendo={duerme(a)} seleccionado={seleccion === a.id}
                efecto={efecto && efecto.id === a.id ? efecto : null} onTocar={onTocar} />
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

const ACCIONES = [
  { k: 'comer', emoji: '🌾', dice: 'Darle de comer', item: 'alimento' },
  { k: 'banar', emoji: '🫧', dice: 'Bañarlo', item: 'jabon' },
  { k: 'premio', emoji: '🎁', dice: 'Darle un premio', item: 'premio' },
  { k: 'mimar', emoji: '❤️', dice: 'Mimarlo', item: null },
]

const HECHO = {
  comer: (n) => `${n} comió 🌾`,
  banar: (n) => `¡${n} se bañó! 🫧`,
  premio: (n) => `${n} está feliz con su premio 🎁`,
  mimar: (n) => `A ${n} le encantó ❤️`,
}

function enHoras(ms) {
  const h = Math.ceil(ms / (60 * 60 * 1000))
  return h <= 1 ? 'en un rato' : `en ${h} horas`
}

/*
 * Por qué no se puede, y qué hacer. Se calcula acá con lo que ya mandó el
 * server, sin preguntarle: tocar un botón gris tiene que contestar al toque.
 */
function porQueNo(a, accion, canasta, items) {
  const ac = ACCIONES.find((x) => x.k === accion)
  if (!a.puede[accion]) {
    const cuando = enHoras(a.vuelve[accion])
    if (accion === 'comer') return `${a.nombre} ya comió. Vuelve a tener hambre ${cuando}.`
    if (accion === 'banar') return `${a.nombre} ya se bañó. Se puede bañar de nuevo ${cuando}.`
    return `${a.nombre} ya recibió su premio. Puede recibir otro ${cuando}.`
  }
  if (ac.item && (canasta[ac.item] || 0) < 1) {
    const it = items[ac.item]
    return `No tenés ${it.uno}. Se gana ${it.seGana}.`
  }
  return null
}

/*
 * La ficha del animal que estás cuidando. Va abajo del corral y no flotando
 * arriba del animal: con los cuatro botones es grande, y en el celular un
 * globo así tapaba media granja o se salía de la pantalla.
 */
function Ficha({ a, canasta, items, mensaje, ocupado, onAccion, onRenombrar, onCerrar }) {
  const estado = []
  if (a.hambre) estado.push('🌾 tiene hambre')
  if (a.sucio) estado.push('tiene barro')

  return (
    <div className="granja-ficha" role="region" aria-label={`Cuidar a ${a.nombre}`}>
      <div className="granja-ficha-cabeza">
        <span className="granja-ficha-ico" aria-hidden="true">{a.emoji}</span>
        <div className="granja-ficha-quien">
          <button type="button" className="granja-bicho-nombre" onClick={() => onRenombrar(a)}
                  aria-label={`Cambiarle el nombre a ${a.nombre}`}>
            {a.nombre} <span className="granja-lapiz" aria-hidden="true">✎</span>
          </button>
          <span className="granja-bicho-meta">
            {a.etapaNombre}{estado.length ? ' · ' + estado.join(' · ') : ' · está feliz'}
          </span>
        </div>
        <button type="button" className="dialogo-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>

      {a.etapa < 2 ? (
        <div className="granja-ficha-crece">
          <div className="arbol-barra" role="img" aria-label={`${Math.round(a.crece)}% para crecer`}>
            <div style={{ width: `${a.crece}%` }} />
          </div>
          <span className="arbol-falta">
            le {a.faltaParaCrecer === 1 ? 'falta 1 cuidado' : `faltan ${a.faltaParaCrecer} cuidados`} para ser {a.proximaEtapa}
          </span>
        </div>
      ) : (
        <p className="arbol-falta granja-ficha-grande">Ya es grande. Igual le encanta que lo cuides.</p>
      )}

      <div className="granja-acciones">
        {ACCIONES.map((ac) => {
          const no = porQueNo(a, ac.k, canasta, items)
          return (
            <button
              key={ac.k}
              type="button"
              className={`granja-accion ${no ? 'no' : ''}`}
              disabled={ocupado}
              aria-describedby={no ? `granja-no-${ac.k}` : undefined}
              onClick={() => onAccion(a, ac.k, no)}
            >
              <span className="granja-accion-ico" aria-hidden="true">{ac.emoji}</span>
              <span className="granja-accion-dice">{ac.dice}</span>
              <span className="granja-accion-cuanto">
                {ac.item ? `te quedan ${canasta[ac.item] || 0}` : 'gratis'}
              </span>
            </button>
          )
        })}
      </div>

      {mensaje && <p className={`granja-ficha-msj ${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
    </div>
  )
}

/* La canasta: cuánto tenés de cada cosa, y cómo se gana. */
function Canasta({ canasta, items }) {
  return (
    <div className="granja-canasta">
      <div className="card-rotulo">TU CANASTA</div>
      {['alimento', 'jabon', 'premio'].map((k) => {
        const it = items[k]
        const n = canasta[k] || 0
        return (
          <div className="granja-canasta-item" key={k}>
            <span className="granja-canasta-ico" aria-hidden="true">{it.emoji}</span>
            <span className="granja-canasta-txt">
              <span><b>{n}</b> {n === 1 ? it.uno : it.varios}</span>
              <span className="granja-canasta-como">Se gana {it.seGana}.</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Granja({ progreso, onCambio, onError, onAviso }) {
  const { pedirTexto, pedirOpcion } = useDialogos()
  const corral = useRef(null)
  const [saltando, setSaltando] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const [efecto, setEfecto] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
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

  useEffect(() => {
    if (saltando == null) return
    const t = setTimeout(() => setSaltando(null), 700)
    return () => clearTimeout(t)
  }, [saltando])

  // El efecto de cuidar dura lo que dura la animación.
  useEffect(() => {
    if (!efecto) return
    const t = setTimeout(() => setEfecto(null), efecto.tipo === 'crecio' ? 1800 : 1600)
    return () => clearTimeout(t)
  }, [efecto])

  if (!progreso || !progreso.granja) return null
  const { animales, proximo, total, porLlegar = [], canasta = {}, items = {} } = progreso.granja
  const { racha, mejorRacha, rachaHoy } = progreso

  function tocar(a) {
    setSaltando(a.id)
    setSeleccion(a.id)
    setMensaje(null)
  }

  function elegirDeLaLista(a) {
    tocar(a)
    if (corral.current) corral.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /*
   * Cuidar: si no se puede, se dice por qué sin ir al server. Si se puede,
   * se festeja en el dibujo, y si con eso creció, el festejo es más grande y
   * se avisa arriba también.
   */
  async function hacer(a, accion, no) {
    if (no) {
      setMensaje({ texto: no, tipo: 'no' })
      return
    }
    setOcupado(true)
    try {
      const r = await api(`/granja/${a.id}/cuidar`, { method: 'POST', body: JSON.stringify({ accion }) })
      onCambio(r.progreso)
      const despues = r.resultado.animal
      if (r.resultado.crecio) {
        setEfecto({ id: a.id, tipo: 'crecio', clave: Date.now() })
        const txt = `🎉 ¡${despues.nombre} creció! Ya es ${despues.etapaNombre}.`
        setMensaje({ texto: txt, tipo: 'si' })
        if (onAviso) onAviso(txt)
      } else {
        setEfecto({ id: a.id, tipo: accion, clave: Date.now() })
        setMensaje({ texto: HECHO[accion](despues.nombre), tipo: 'si' })
      }
    } catch (err) {
      setMensaje({ texto: err.message, tipo: 'no' })
    } finally {
      setOcupado(false)
    }
  }

  async function cambiarNombre(a) {
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

  const elegido = seleccion != null ? animales.find((a) => a.id === seleccion) : null
  const conHambre = animales.filter((a) => a.hambre).length

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
            seleccion={seleccion}
            efecto={efecto}
            onTocar={tocar}
            clima={clima}
          />
          {elegido ? (
            <Ficha
              a={elegido}
              canasta={canasta}
              items={items}
              mensaje={mensaje}
              ocupado={ocupado}
              onAccion={hacer}
              onRenombrar={cambiarNombre}
              onCerrar={() => { setSeleccion(null); setMensaje(null) }}
            />
          ) : (
            total > 0 && (
              <p className="granja-pista granja-pista-fuerte">
                {conHambre > 0
                  ? `${conHambre === 1 ? 'Uno tiene' : `${conHambre} tienen`} hambre. Tocá un animal para cuidarlo.`
                  : 'Tocá un animal para cuidarlo.'}
              </p>
            )
          )}
          <Pronostico clima={clima} onCambiarCiudad={cambiarCiudad} />
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

          {items.alimento && <Canasta canasta={canasta} items={items} />}
        </div>
      </div>

      {/* La lista va abajo y a lo ancho, en columnas. Tocar uno lo elige en
          el corral, igual que tocarlo en el dibujo. */}
      {total === 0 ? (
        <p className="hint granja-vacia">
          Todavía no llegó nadie. Con cada cosa que anotás, cada mes que
          cerrás en verde y cada meta que cumplís juntás puntos, y con los
          puntos llegan animales. Después, a cuidarlos.
        </p>
      ) : (
        <div className="granja-lista">
          {animales.slice().reverse().slice(0, 12).map((a) => (
            <button
              type="button"
              className={`granja-bicho ${seleccion === a.id ? 'elegido' : ''}`}
              key={a.id}
              onClick={() => elegirDeLaLista(a)}
            >
              <span className="granja-bicho-ico" aria-hidden="true">{a.emoji}</span>
              <span className="granja-bicho-txt">
                <span className="granja-bicho-nombre-txt">{a.nombre}</span>
                <span className="granja-bicho-meta">
                  {a.etapaNombre}
                  {a.hambre ? ' · 🌾 hambre' : ''}
                  {a.sucio ? ' · con barro' : ''}
                  {a.etapa < 2 ? ` · le faltan ${a.faltaParaCrecer} cuidados` : ''}
                </span>
              </span>
              {a.etapa < 2 && (
                <span className="granja-bicho-crece" aria-hidden="true">
                  <span style={{ width: `${a.crece}%` }} />
                </span>
              )}
            </button>
          ))}
          {total > 12 && (
            <p className="hint">
              Y {total - 12} más{total > MAXIMO_EN_PANTALLA ? ' (en el corral se ven los últimos 14)' : ''}.
            </p>
          )}
        </div>
      )}

      {/* Los que faltan, a la vista desde el principio. Los últimos tardan
          mucho en llegar (el perro pide 10.500 puntos), y lo que no se ve
          no motiva. */}
      {porLlegar.length > 0 && (
        <div className="granja-album">
          <div className="card-rotulo">TODAVÍA NO LLEGARON</div>
          <div className="granja-album-lista">
            {porLlegar.map((x) => (
              <span className="granja-album-item" key={x.especie} title={`Llega a los ${x.llega.toLocaleString('es-AR')} puntos`}>
                <span className="granja-album-ico" aria-hidden="true">{x.emoji}</span>
                <span className="granja-album-txt">
                  <span className="granja-album-nombre">{x.nombre}</span>
                  <span className="granja-album-puntos">{x.llega.toLocaleString('es-AR')} pts</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
