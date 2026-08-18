/**
 * El árbol de Manguito, dibujado en SVG.
 *
 * Va cambiando con la etapa (0 = semilla, 7 = mangal). No es una imagen por
 * etapa: es el mismo dibujo que suma partes a medida que crece, así la
 * transición se siente continua.
 */

function Tronco({ alto, ancho }) {
  return (
    <path
      d={`M ${100 - ancho / 2} 190 Q 100 ${190 - alto / 2} ${100 - ancho / 3} ${190 - alto}
          L ${100 + ancho / 3} ${190 - alto} Q 100 ${190 - alto / 2} ${100 + ancho / 2} 190 Z`}
      fill="var(--tronco)"
    />
  )
}

function Hoja({ x, y, r, delay }) {
  return (
    <circle cx={x} cy={y} r={r} fill="var(--follaje)" style={{ animationDelay: `${delay}s` }} className="hoja" />
  )
}

function Mango({ x, y, delay }) {
  return (
    <ellipse cx={x} cy={y} rx="5.5" ry="7" fill="var(--fruta)" className="hoja" style={{ animationDelay: `${delay}s` }} />
  )
}

export default function Arbol({ stage = 0, className = '' }) {
  const s = Math.max(0, Math.min(7, stage))

  // La tierra y la maceta están siempre
  const base = (
    <>
      <ellipse cx="100" cy="192" rx="52" ry="9" fill="var(--tierra)" />
      <ellipse cx="100" cy="189" rx="44" ry="6" fill="var(--tierra-clara)" />
    </>
  )

  // El árbol crece hacia arriba, así que en las primeras etapas la mitad de
  // arriba del dibujo queda vacía. Recortamos el encuadre según la etapa para
  // que la planta siempre llene el cuadro.
  const encuadre =
    s === 0 ? '10 138 180 68'
      : s === 1 ? '5 122 190 88'
        : s === 2 ? '10 106 180 100'
        : s === 3 ? '5 82 190 124'
          : '0 46 200 160'

  return (
    <svg viewBox={encuadre} className={`arbol ${className}`} role="img"
         aria-label={`Tu árbol está en la etapa ${s} de 7`}>
      {base}

      {/* semilla */}
      {s === 0 && (
        <ellipse cx="100" cy="182" rx="9" ry="11" fill="var(--tronco)" className="hoja" />
      )}

      {/* brote: un tallito con dos hojas.
          Ojo: la rotación va en un <g> y la animación en el hijo. Si se ponen
          las dos en el mismo elemento, el transform del CSS pisa al del SVG
          y las hojas se van volando. */}
      {s === 1 && (
        <>
          <path d="M 100 189 L 100 160" stroke="var(--follaje)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <g transform="rotate(-22 88 166)">
            <ellipse cx="88" cy="166" rx="12" ry="6.5" fill="var(--follaje)" className="hoja" />
          </g>
          <g transform="rotate(22 112 172)">
            <ellipse cx="112" cy="172" rx="11" ry="6" fill="var(--follaje)" className="hoja"
                     style={{ animationDelay: '.12s' }} />
          </g>
        </>
      )}

      {/* plantín */}
      {s === 2 && (
        <>
          <Tronco alto={45} ancho={10} />
          <Hoja x={100} y={138} r={22} delay={0} />
          <Hoja x={80} y={150} r={14} delay={0.1} />
          <Hoja x={120} y={150} r={14} delay={0.15} />
        </>
      )}

      {/* arbolito */}
      {s === 3 && (
        <>
          <Tronco alto={62} ancho={13} />
          <Hoja x={100} y={118} r={28} delay={0} />
          <Hoja x={74} y={134} r={19} delay={0.1} />
          <Hoja x={126} y={134} r={19} delay={0.15} />
        </>
      )}

      {/* árbol */}
      {s >= 4 && (
        <>
          <Tronco alto={78} ancho={17} />
          <path d="M 100 140 L 74 118 M 100 132 L 128 112" stroke="var(--tronco)" strokeWidth="5" strokeLinecap="round" />
          <Hoja x={100} y={96} r={34} delay={0} />
          <Hoja x={66} y={116} r={24} delay={0.08} />
          <Hoja x={134} y={114} r={25} delay={0.14} />
          <Hoja x={84} y={88} r={20} delay={0.2} />
          <Hoja x={118} y={86} r={21} delay={0.26} />
        </>
      )}

      {/* en flor */}
      {s === 5 && (
        <>
          <circle cx="76" cy="98" r="4" fill="var(--flor)" className="hoja" style={{ animationDelay: '.3s' }} />
          <circle cx="122" cy="104" r="4" fill="var(--flor)" className="hoja" style={{ animationDelay: '.35s' }} />
          <circle cx="100" cy="74" r="4" fill="var(--flor)" className="hoja" style={{ animationDelay: '.4s' }} />
          <circle cx="92" cy="112" r="3.5" fill="var(--flor)" className="hoja" style={{ animationDelay: '.45s' }} />
        </>
      )}

      {/* con mangos */}
      {s >= 6 && (
        <>
          <Mango x={78} y={104} delay={0.3} />
          <Mango x={120} y={98} delay={0.36} />
          <Mango x={100} y={78} delay={0.42} />
          {s === 7 && (
            <>
              <Mango x={64} y={124} delay={0.48} />
              <Mango x={136} y={122} delay={0.54} />
              <Mango x={108} y={118} delay={0.6} />
              {/* un segundo arbolito al costado: el mangal */}
              <g transform="translate(48,26) scale(.55)" opacity=".75">
                <Tronco alto={70} ancho={15} />
                <Hoja x={100} y={104} r={30} delay={0.6} />
                <Hoja x={72} y={122} r={20} delay={0.66} />
                <Hoja x={128} y={120} r={21} delay={0.72} />
              </g>
            </>
          )}
        </>
      )}
    </svg>
  )
}
