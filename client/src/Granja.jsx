import { useEffect, useState } from 'react'

/**
 * La granja, dibujada en SVG y animada con CSS.
 *
 * Existe porque el árbol tiene tope (en 9.000 puntos es «Mangal» y no pasa
 * nada más). La granja no: van llegando animales, cada uno crece, y después
 * de que llegan todas las especies nacen crías para siempre. Qué animal hay
 * y en qué etapa lo decide el server (`granja.js`); acá solo se dibuja.
 *
 * CÓMO SE MUEVEN. Cada animal son tres grupos anidados, y no es capricho:
 *
 *   <g transform="translate scale">   dónde está y qué tan grande es.
 *     <g class="animal">               camina de un lado al otro (CSS).
 *       <g class="rebote">             sube y baja al caminar (CSS).
 *
 * Una animación CSS que usa `transform` le gana al atributo `transform` del
 * mismo elemento, y el dibujo sale volando (ya nos pasó con el árbol). Por
 * eso la posición va en un grupo y cada movimiento en un hijo distinto.
 *
 * Patas, cabeza y caminata usan la MISMA duración y el mismo retardo (las
 * variables --t y --retardo, que heredan los hijos): así el animal mueve las
 * patas solo mientras avanza, y baja la cabeza a comer cuando se para.
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

/* ----------------------------------------------------------- el corral */

// Cría, joven, grande. La cría además tiene la cabeza más grande (en el CSS),
// que es lo que hace que se vea bebé y no un animal grande mirado de lejos.
const TAMANO = [0.58, 0.8, 1]

// Cuántos se dibujan como mucho. Más que esto no entra en un celular sin que
// se pisen; los demás se cuentan abajo, en la lista.
const MAXIMO_EN_PANTALLA = 14

/*
 * Dónde para cada uno. Sale del número de animal, no del azar: si fuera al
 * azar, cada vez que entrás la granja se reordenaría y Pocha nunca estaría
 * en el mismo lugar.
 */
function lugarDe(id) {
  // Saltos de «número de oro»: cada uno cae lo más lejos posible de los que
  // ya están. Con saltos fijos (id * 97 % 210) dos conejos quedaban en la
  // misma fila a 50 de distancia y se chocaban al caminar.
  const fraccion = (n) => n - Math.floor(n)
  const x = 112 + Math.round(fraccion(id * 0.618034) * 230)
  const y = 152 + Math.round(fraccion(id * 0.381966 + 0.2) * 52)
  const recorre = 22 + ((id * 13) % 30)
  return {
    x,
    y,
    // Que no se salga del corral al caminar.
    recorre: Math.min(recorre, 388 - x),
    // Lo de atrás se ve más chico: así parece un campo y no una fila.
    profundidad: 0.78 + ((y - 152) / 52) * 0.34,
    // Cada uno a su ritmo: si todos caminaran juntos parecería un desfile.
    duracion: 15 + ((id * 7) % 9),
    retardo: -((id * 5.3) % 15),
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

function Animal({ a, zoom }) {
  const Dibujo = DIBUJOS[a.especie]
  if (!Dibujo) return null
  const l = lugarDe(a.id)
  const escala = l.profundidad * TAMANO[a.etapa] * zoom

  return (
    <g transform={`translate(${l.x} ${l.y}) scale(${escala})`}>
      <g
        className={`animal ${a.especie} etapa-${a.etapa}`}
        style={{
          '--d': `${l.recorre / escala}px`,
          '--t': `${l.duracion}s`,
          '--retardo': `${l.retardo}s`,
        }}
      >
        <title>{`${a.nombre}, ${a.etapaNombre}`}</title>
        {/* La sombra camina con el animal (adentro de .animal) pero no salta
            con él (afuera de .rebote). Afuera de los dos quedaba en el pasto
            sin nadie encima. */}
        <ellipse className="sombra" cx="0" cy="0.5" rx="15" ry="2.6" />
        <g className="rebote">
          <Dibujo />
        </g>
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

function Escena({ animales, progresoProximo }) {
  const zoom = useAngosta() ? 1.4 : 1
  // Se dibujan de atrás para adelante: el que está más abajo tapa al de atrás.
  const visibles = animales.slice(-MAXIMO_EN_PANTALLA)
    .slice()
    .sort((x, y) => lugarDe(x.id).y - lugarDe(y.id).y)

  return (
    <svg className="granja-escena" viewBox="0 0 400 220" role="img"
         aria-label={`Tu granja: ${animales.length} ${animales.length === 1 ? 'animal' : 'animales'}`}>
      <defs>
        <linearGradient id="granja-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cielo-arriba)' }} />
          <stop offset="1" style={{ stopColor: 'var(--cielo-abajo)' }} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="140" fill="url(#granja-cielo)" />

      {/* De noche, estrellas; de día, nubes. Las dos están siempre y el tema
          decide cuál se ve, así no hay que preguntarle al JS qué tema es. */}
      <g className="estrellas">
        {[[40, 22], [92, 14], [150, 30], [205, 12], [262, 26], [300, 10], [372, 30], [128, 52], [232, 48]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.3 : 0.9} style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </g>
      <circle className="astro" cx="338" cy="38" r="17" />
      <g className="nubes">
        <g className="nube" style={{ animationDuration: '70s', animationDelay: '-20s' }}>
          <ellipse cx="60" cy="40" rx="20" ry="7" /><ellipse cx="72" cy="35" rx="12" ry="8" /><ellipse cx="50" cy="37" rx="10" ry="6" />
        </g>
        <g className="nube" style={{ animationDuration: '95s', animationDelay: '-60s' }}>
          <ellipse cx="220" cy="28" rx="24" ry="7" /><ellipse cx="234" cy="23" rx="13" ry="8" /><ellipse cx="208" cy="25" rx="11" ry="6" />
        </g>
      </g>

      <path className="loma" d="M0 128 Q60 96 130 118 T260 112 T400 116 V150 H0 Z" />
      <rect className="pasto" x="0" y="134" width="400" height="86" />
      <path className="pasto-frente" d="M0 186 Q100 176 200 184 T400 180 V220 H0 Z" />

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

      {visibles.map((a) => <Animal key={a.id} a={a} zoom={zoom} />)}

      <Huevo progreso={progresoProximo} />
    </svg>
  )
}

/* ============================================================ la pantalla */

export default function Granja({ granja }) {
  if (!granja) return null
  const { animales, proximo, total } = granja
  const escondidos = Math.max(total - MAXIMO_EN_PANTALLA, 0)

  return (
    <section className="card granja-card">
      <div className="card-title-row">
        <h2>Tu granja</h2>
        <span className="tag">
          {total === 0 ? 'vacía' : `${total} ${total === 1 ? 'animal' : 'animales'}`}
        </span>
      </div>

      <Escena animales={animales} progresoProximo={proximo.progreso} />

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
          <div className="arbol-falta">
            faltan {proximo.faltan} puntos
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="hint granja-vacia">
          Todavía no llegó nadie. Con los mismos puntos que hacen crecer el
          árbol van llegando animales, y cada uno crece mientras seguís sumando.
        </p>
      ) : (
        <div className="granja-lista">
          {animales.slice().reverse().slice(0, 12).map((a) => (
            <div className="granja-bicho" key={a.id}>
              <span className="granja-bicho-ico" aria-hidden="true">{a.emoji}</span>
              <span className="granja-bicho-txt">
                <span className="granja-bicho-nombre">{a.nombre}</span>
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
              Y {total - 12} más{escondidos > 0 ? ' (en el corral se ven los últimos 14)' : ''}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
