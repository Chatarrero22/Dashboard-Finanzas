/**
 * El armazón que envuelve a todas las pantallas: barra lateral, barra de
 * arriba y encabezado de página. Sale del diseño de Claude Design.
 */
import { money } from './comunes.jsx'

/* ------------------------------------------------------- barra lateral */

export function Lateral({ marca, grupos, tab, onGo, onNuevo, ahorro, usuario }) {
  // El porcentaje de ahorro solo tiene sentido si entró plata.
  const pct = ahorro && ahorro.ingresos > 0
    ? Math.round((ahorro.monto / ahorro.ingresos) * 100)
    : null
  const enRojo = ahorro && ahorro.monto < 0
  // Ajustes no va en la lista: en escritorio se entra por el bloque de abajo,
  // como en el diseño. En el celular sigue estando dentro de "Más".
  const navGrupos = grupos
    .map((g) => ({ ...g, items: g.items.filter((t) => t.id !== 'ajustes') }))
    .filter((g) => g.items.length > 0)
  const ancho = pct == null ? 100 : Math.min(Math.abs(pct), 100)

  return (
    <aside className="lateral">
      <div className="marca">
        <div className="marca-logo" />
        <div>
          <div className="marca-nombre">{marca}</div>
          <div className="marca-bajada">FINANZAS</div>
        </div>
      </div>

      <button className="btn-nuevo" onClick={onNuevo}>
        <span className="mas">+</span>Nuevo movimiento
      </button>

      {ahorro && (
        <div className={`ahorro-mini ${enRojo ? 'rojo' : 'bien'}`}>
          <div className="ahorro-mini-fila">
            <span className="ahorro-mini-label">Ahorro del mes</span>
            <span className="ahorro-mini-pct">{pct == null ? '—' : `${pct}%`}</span>
          </div>
          <div className="ahorro-mini-monto monto-sensible">{money(ahorro.monto)}</div>
          <div className="ahorro-mini-barra">
            <div style={{ width: `${ancho}%` }} />
          </div>
        </div>
      )}

      <nav className="lateral-nav nav nav-pc">
        {navGrupos.map((g, i) => (
          <div className="nav-grupo" key={g.titulo || `g${i}`}>
            {g.titulo && <div className="nav-titulo">{g.titulo}</div>}
            {g.items.map((t) => (
              <button
                key={t.id}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => onGo(t.id)}
              >
                <span className="icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <button className="lateral-user" onClick={() => onGo('ajustes')} title="Ajustes">
        <span className="lateral-avatar">{(usuario.nombre || '?').slice(0, 1).toUpperCase()}</span>
        <span className="lateral-user-txt">
          <span className="lateral-user-nombre">{usuario.nombre}</span>
          <span className="lateral-user-sub">{usuario.sub}</span>
        </span>
        <span className="lateral-user-ico">⚙</span>
      </button>
    </aside>
  )
}

/* -------------------------------------------------------- barra de arriba */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-08" → "agosto 2026" */
export function mesLargo(ym) {
  const [y, m] = String(ym).split('-')
  return `${MESES[Number(m) - 1] || ''} ${y}`
}

/** Corre un mes "2026-08" hacia adelante o atrás sin líos de zona horaria. */
export function correrMes(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Topbar({
  moneda, onMoneda, mes, onMes, mesTope, dolar,
  tema, onTema, oculto, onOculto,
}) {
  return (
    <header className="topbar">
      <div className="grupo-pill">
        <button className={moneda === 'ars' ? 'on' : ''} onClick={() => onMoneda('ars')}>$ ARS</button>
        <button
          className={moneda === 'usd' ? 'on' : ''}
          onClick={() => onMoneda('usd')}
          disabled={!dolar}
          title={dolar ? 'Ver todo en dólares' : 'No tengo la cotización del dólar ahora'}
        >US$</button>
      </div>

      <div className="grupo-pill">
        <button className="flecha" onClick={() => onMes(correrMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <span className="mes-actual">{mesLargo(mes)}</span>
        <button
          className="flecha"
          onClick={() => onMes(correrMes(mes, 1))}
          disabled={mes >= mesTope}
          aria-label="Mes siguiente"
        >›</button>
      </div>

      <div className="topbar-espacio" />

      {dolar > 0 && (
        <div className="chip-info dolar">
          <span className="punto-vivo" />
          Dólar blue <strong className="monto-sensible">{money(dolar)}</strong>
        </div>
      )}

      <button className="btn-topbar" onClick={onTema}>
        {tema === 'dark' ? '☀ Claro' : '☾ Oscuro'}
      </button>
      <button className="btn-topbar" onClick={onOculto}>
        {oculto ? 'Mostrar montos' : 'Ocultar montos'}
      </button>
    </header>
  )
}

/* --------------------------------------------------- encabezado de pantalla */

export function PaginaHead({ titulo, bajada, acciones }) {
  return (
    <div className="pagina-head">
      <div>
        <h1>{titulo}</h1>
        {bajada && <p className="bajada">{bajada}</p>}
      </div>
      {acciones && acciones.length > 0 && (
        <div className="pagina-acciones">
          {acciones.map((a) => (
            <button key={a.txt} onClick={a.go}>{a.txt}</button>
          ))}
        </div>
      )}
    </div>
  )
}
