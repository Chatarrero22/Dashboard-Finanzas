/**
 * El armazón que envuelve a todas las pantallas: barra lateral, barra de
 * arriba y encabezado de página. Sale del diseño de Claude Design.
 */
import { money } from './comunes.jsx'

/* ------------------------------------------------------- barra lateral */

export function Lateral({ marca, grupos, tab, onGo, onNuevo, potes, usuario }) {
  /*
   * Arriba de todo va la plata QUE TENÉS, no cómo te fue en el mes.
   *
   * Antes decía «Ahorro del mes» y era ingresos menos gastos: un flujo. Ese
   * número no coincide nunca con lo que hay en el banco, y no tiene por qué
   * —son cosas distintas— pero puesto ahí arriba parece que sí. Emanuel lo
   * dijo derecho: ese número tiene que coincidir con lo que tenés.
   *
   * Ahora son los dos potes: lo que podés usar y lo que apartaste. Cuando
   * mandás plata al ahorro, el de arriba baja. Eso se entiende solo.
   */
  const liquidez = potes ? potes.liquidez : 0
  const guardado = potes ? potes.ahorro : 0
  const enRojo = liquidez < 0
  // Cuánto de tu plata en cuentas está disponible. Si no hay nada, no hay
  // barra que dibujar: un 0% lleno se lee como un error.
  const enCuentas = liquidez + guardado
  const pct = enCuentas > 0 ? Math.round((liquidez / enCuentas) * 100) : null
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

      {potes && (
        <div className={`ahorro-mini ${enRojo ? 'rojo' : 'bien'}`}>
          {/* El segundo pote va en el encabezado y no en una fila propia: la
              tarjeta tiene que seguir entrando sin empujar el menú. Cuando le
              agregué una línea abajo, «Árbol» se salió de la barra lateral. */}
          <div className="ahorro-mini-fila">
            <span className="ahorro-mini-label">Disponible</span>
            <span className="ahorro-mini-otro">
              Ahorro <b className="monto-sensible">{money(guardado)}</b>
            </span>
          </div>
          <div className="ahorro-mini-monto monto-sensible">{money(liquidez)}</div>
          <div className="ahorro-mini-barra" title={pct == null ? '' : `${pct}% de tu plata está disponible`}>
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
  const nombre = MESES[Number(m) - 1] || ''
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${y}`
}

/** Corre un mes "2026-08" hacia adelante o atrás sin líos de zona horaria. */
export function correrMes(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Topbar({
  moneda, onMoneda, mes, onMes, mesTope, dolar, dolarNombre,
  tema, onTema, oculto, onOculto, onRefrescar, refrescando,
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
          Dólar {dolarNombre || 'MEP'} <strong className="monto-sensible">{money(dolar)}</strong>
        </div>
      )}

      {/* Los datos cambian por fuera del navegador: si le pedís algo al bot
          por Telegram, esta pantalla no se entera hasta que vuelve a pedirlos.
          Se refresca sola al volver a la pestaña, pero si estás mirando la
          pantalla no pasa nada y no había forma de pedirlo a mano. */}
      {onRefrescar && (
        <button
          className={`btn-topbar btn-refrescar ${refrescando ? 'girando' : ''}`}
          onClick={onRefrescar}
          disabled={refrescando}
          title="Volver a pedir los datos"
          aria-label="Refrescar"
        >
          <span className="refrescar-ico" aria-hidden="true">↻</span>
          <span className="refrescar-txt">{refrescando ? 'Actualizando…' : 'Actualizar'}</span>
        </button>
      )}

      <button className="btn-topbar" onClick={onTema}>
        {tema === 'dark' ? 'Modo día' : 'Modo noche'}
      </button>
      <button className="btn-topbar" onClick={onOculto}>
        {oculto ? 'Mostrar saldos' : 'Ocultar saldos'}
      </button>
    </header>
  )
}

/* --------------------------------------------------- encabezado de pantalla */

export function PaginaHead({ titulo, bajada, acciones, ayuda }) {
  return (
    <div className="pagina-head">
      <div className="pagina-titulo">
        <h1>{titulo}</h1>
        {/* El signo de pregunta va pegado al titulo, no perdido entre los
            botones de accion: es ayuda sobre ESTA seccion. */}
        {ayuda && (
          <button
            className="ayuda-btn"
            onClick={ayuda}
            title="Cómo se usa esta sección"
            aria-label="Cómo se usa esta sección"
          >?</button>
        )}
        {bajada && <p className="bajada">{bajada}</p>}
      </div>
      {acciones && acciones.length > 0 && (
        <div className="pagina-acciones">
          {acciones.map((a) => (
            <button key={a.txt} className={a.tono || ''} onClick={a.go}>{a.txt}</button>
          ))}
        </div>
      )}
    </div>
  )
}
