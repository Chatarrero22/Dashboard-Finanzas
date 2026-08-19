/**
 * Inversiones: la cartera a precio de mercado.
 *
 * Antes solo entendía cripto. Ahora entra todo lo que se opera en la Bolsa de
 * Buenos Aires: acciones argentinas, CEDEARs, bonos, letras y ONs. Los
 * precios llegan en vivo y se refrescan solos mientras tenés la pantalla
 * abierta.
 *
 * Dos cosas que se ven raras hasta que sabés por qué:
 *
 * - Cada activo muestra su precio EN LA MONEDA EN LA QUE COTIZA (un CEDEAR de
 *   Apple vale $18.500, no US$11), pero el valor de la tenencia va en pesos,
 *   como todo el resto de la app. Así el botón ARS/US$ de arriba sigue
 *   funcionando sin convertir dos veces.
 *
 * - De los bonos, letras y ONs se cargan NOMINALES, no unidades, porque
 *   cotizan por cada 100 nominales. Está explicado en el formulario.
 */
import { useEffect, useRef, useState } from 'react'
import { api, money, Empty } from './comunes.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'
import Numero from './Numero.jsx'

const TIPOS = [
  { id: 'accion', nombre: 'Acciones', icono: '🏭', unidad: 'acciones', ayuda: 'GGAL, YPFD, PAMP…' },
  { id: 'cedear', nombre: 'CEDEARs', icono: '🌎', unidad: 'CEDEARs', ayuda: 'AAPL, TSLA, SPY…' },
  { id: 'bono', nombre: 'Bonos', icono: '📜', unidad: 'nominales', ayuda: 'AL30, GD30, AE38…' },
  { id: 'letra', nombre: 'Letras', icono: '🧾', unidad: 'nominales', ayuda: 'Deuda a corto plazo' },
  { id: 'on', nombre: 'ONs', icono: '🏢', unidad: 'nominales', ayuda: 'Deuda de empresas' },
  { id: 'crypto', nombre: 'Cripto', icono: '₿', unidad: 'unidades', ayuda: 'BTC, ETH, SOL…' },
]

// Los que cotizan por cada 100 nominales.
const POR_LAMINA = ['bono', 'letra', 'on']

function tipoDe(id) {
  return TIPOS.find((t) => t.id === id) || TIPOS[0]
}

// "1 acciones" queda mal. Son cinco casos, no hace falta nada mas grande.
const SINGULAR = {
  acciones: 'acción', CEDEARs: 'CEDEAR', nominales: 'nominal', unidades: 'unidad',
}

function unidades(cantidad, unidad) {
  const txt = cantidad.toLocaleString('es-AR')
  if (cantidad === 1 && SINGULAR[unidad]) return `${txt} ${SINGULAR[unidad]}`
  return `${txt} ${unidad}`
}

/**
 * Cuanto pesa un tipo en la cartera. Redondear a cero hace que una tenencia
 * chica parezca que no vale nada, asi que abajo del 1% lo decimos con letras.
 */
function pctCartera(monto, total) {
  const pct = (monto / (total || 1)) * 100
  if (pct > 0 && pct < 1) return 'menos del 1% de la cartera'
  return `${Math.round(pct)}% de la cartera`
}

/**
 * El precio pelado, sin signo de moneda.
 *
 * Va así en el buscador a propósito: ahí todavía no sabemos en qué moneda
 * está la especie (AAPL cotiza $24.960 y AAPLD cotiza US$16,36), y ponerle un
 * "$" a la de dólares sería mentir. El número solo alcanza para darte cuenta
 * de cuál es cuál.
 */
function soloNumero(n) {
  if (n == null) return '—'
  return Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  })
}

/** Un precio en la moneda en la que cotiza esa especie. */
function precio(n, moneda) {
  if (n == null) return '—'
  const txt = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  })
  return moneda === 'USD' ? `US$${txt}` : `$${txt}`
}

function Variacion({ pct }) {
  if (pct == null) return null
  const signo = pct >= 0 ? '▲' : '▼'
  return (
    <span className={`var-chip ${pct >= 0 ? 'sube' : 'baja'}`}>
      {signo} {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

export default function InversionesScreen({ portfolio, accion, onError, onReload }) {
  const { confirmar } = useDialogos()
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { if (accion) setAbierto(true) }, [accion])

  // Los precios se mueven durante la rueda: refrescamos solos cada minuto
  // mientras estás mirando la pantalla. Al salir se corta.
  useEffect(() => {
    const id = setInterval(() => { onReload() }, 60000)
    return () => clearInterval(id)
  }, [onReload])

  if (!portfolio) return <div className="spinner" />

  const { assets, totalValue, totalPnl, totalPnlPct, porTipo, sinPrecio, minutos } = portfolio

  async function borrar(a) {
    const ok = await confirmar({
      titulo: `¿Sacar ${a.symbol} de la cartera?`,
      detalle: 'Deja de contar en tu patrimonio. No se borra ningún movimiento.',
      aceptar: 'Sacarlo', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/portfolio/${a.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  // Agrupamos por tipo, en el orden de TIPOS, mostrando solo los que tienen algo.
  const grupos = TIPOS
    .map((t) => ({ tipo: t, items: assets.filter((a) => a.asset_type === t.id) }))
    .filter((g) => g.items.length > 0)

  const conPlata = TIPOS.filter((t) => (porTipo || {})[t.id])

  return (
    <>
      <div className="hero">
        <div className="label">Tu cartera</div>
        <Numero className="value monto-sensible" valor={totalValue} />
        <div className="caption">
          {totalPnl
            ? `${totalPnl >= 0 ? '▲' : '▼'} ${money(Math.abs(totalPnl))} (${totalPnlPct.toFixed(1)}%) desde que compraste`
            : 'Cargá el precio de compra para ver la ganancia'}
        </div>
      </div>

      {conPlata.length > 1 && (
        <div className="kpis kpis-3">
          {conPlata.map((t) => (
            <div className="kpi" key={t.id}>
              <div className="kpi-label">{t.icono} {t.nombre}</div>
              <Numero className="kpi-valor monto-sensible" valor={porTipo[t.id]} />
              <span className="kpi-sub">{pctCartera(porTipo[t.id], totalValue)}</span>
            </div>
          ))}
        </div>
      )}

      {grupos.length === 0 ? (
        <section className="card">
          <Empty icon="📈" text="Todavía no cargaste nada. Agregá una acción, un CEDEAR o un bono." />
        </section>
      ) : (
        grupos.map((g) => (
          <section className="card" key={g.tipo.id}>
            <div className="card-title-row">
              <h2>{g.tipo.icono} {g.tipo.nombre}</h2>
            </div>
            <div className="list">
              {g.items.map((a) => (
                <div className="item" key={a.id}>
                  <div className="item-main">
                    <div className="item-desc">
                      {a.symbol}
                      {a.currency === 'USD' && a.asset_type !== 'crypto' && (
                        <span className="tag" style={{ marginLeft: 8 }}>en US$</span>
                      )}
                    </div>
                    <div className="item-meta">
                      <span>{unidades(a.quantity, a.unidad)}</span>
                      <span>a {precio(a.price, a.currency)}</span>
                      <Variacion pct={a.change24h} />
                    </div>
                  </div>
                  <div className="item-lado">
                    <div className="item-amount monto-sensible">
                      {a.value != null ? money(a.value) : 'sin precio'}
                    </div>
                    {a.pnl != null && a.pnl_pct != null && (
                      <div className={`item-pnl ${a.pnl >= 0 ? 'positive' : 'negative'}`}>
                        {a.pnl >= 0 ? '+' : '−'}{a.pnl_pct.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <button className="danger" aria-label={`Sacar ${a.symbol}`} onClick={() => borrar(a)}>✕</button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {sinPrecio && sinPrecio.length > 0 && (
        <p className="hint">
          No conseguí precio de {sinPrecio.join(', ')}. No {sinPrecio.length === 1 ? 'suma' : 'suman'} al
          total: prefiero que falte antes que mostrar un número inventado.
        </p>
      )}

      <p className="hint">
        Los precios son del mercado en vivo
        {minutos != null && minutos > 3 ? ` (de hace ${minutos} minutos)` : ''} y se
        actualizan solos cada minuto. Fuera del horario de rueda ves el último
        cierre.
      </p>

      {abierto && (
        <AgregarActivo
          onCerrar={() => setAbierto(false)}
          onHecho={() => { setAbierto(false); onReload() }}
          onError={onError}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------- alta de un activo */

function AgregarActivo({ onCerrar, onHecho, onError }) {
  const [tipo, setTipo] = useState('cedear')
  const [texto, setTexto] = useState('')
  const [elegido, setElegido] = useState(null)
  const [opciones, setOpciones] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [cantidad, setCantidad] = useState('')
  const [compra, setCompra] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const debounce = useRef(null)

  const esCripto = tipo === 'crypto'
  const t = tipoDe(tipo)

  // Buscamos en el mercado mientras escribís, pero sin disparar una request
  // por tecla: esperamos a que pares un cuarto de segundo.
  useEffect(() => {
    if (esCripto) { setOpciones([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      try {
        setOpciones(await api(`/mercado/buscar?tipo=${tipo}&q=${encodeURIComponent(texto)}`))
      } catch {
        setOpciones([])
      } finally {
        setBuscando(false)
      }
    }, 250)
    return () => clearTimeout(debounce.current)
  }, [texto, tipo, esCripto])

  const simbolo = esCripto ? texto.trim().toUpperCase() : (elegido ? elegido.symbol : '')

  async function guardar(e) {
    e.preventDefault()
    if (!simbolo) return onError('Elegí qué compraste')
    if (!Number(cantidad)) return onError(`Poné cuántos ${t.unidad} tenés`)
    try {
      await api('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          symbol: simbolo,
          asset_type: tipo,
          quantity: Number(cantidad),
          avg_price: compra ? Number(compra) : 0,
          currency: esCripto ? 'USD' : moneda,
        }),
      })
      onHecho()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <Modal
      titulo="Agregar a la cartera"
      detalle="El precio lo traemos del mercado. El de compra es opcional y sirve para ver si ganás o perdés."
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar}>
        <div className="field">
          <span className="field-label">¿Qué compraste?</span>
          <div className="tipos tipos-chicos">
            {TIPOS.map((op) => (
              <button
                type="button"
                key={op.id}
                className={`tipo ${tipo === op.id ? 'elegido' : ''}`}
                onClick={() => {
                  setTipo(op.id)
                  setElegido(null)
                  setTexto('')
                  setMoneda('ARS')
                }}
              >
                <span className="tipo-ico">{op.icono}</span>
                <span className="tipo-txt">
                  <span className="tipo-nombre">{op.nombre}</span>
                  <small>{op.ayuda}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field-label">{esCripto ? 'Símbolo' : 'Especie'}</span>
          <input
            placeholder={esCripto ? 'BTC' : `Buscá: ${t.ayuda}`}
            value={elegido ? elegido.symbol : texto}
            onChange={(e) => {
              setElegido(null)
              setTexto(e.target.value.toUpperCase())
            }}
          />
          {!esCripto && !elegido && (
            <div className="buscador">
              {buscando && <div className="buscador-vacio">Buscando…</div>}
              {!buscando && opciones.length === 0 && (
                <div className="buscador-vacio">
                  {texto ? 'No encontré esa especie' : 'Escribí para buscar'}
                </div>
              )}
              {opciones.map((o) => (
                <button
                  type="button"
                  className="buscador-op"
                  key={o.symbol}
                  onClick={() => { setElegido(o); setTexto(o.symbol) }}
                >
                  <span className="buscador-sim">{o.symbol}</span>
                  <span className="buscador-precio">{soloNumero(o.price)}</span>
                  <Variacion pct={o.change24h} />
                </button>
              ))}
            </div>
          )}
        </label>

        {!esCripto && (
          <div className="field">
            <span className="field-label">¿En qué moneda la compraste?</span>
            <div className="segmentado">
              <button
                type="button"
                className={moneda === 'ARS' ? 'elegido' : ''}
                onClick={() => setMoneda('ARS')}
              >Pesos</button>
              <button
                type="button"
                className={moneda === 'USD' ? 'elegido' : ''}
                onClick={() => setMoneda('USD')}
              >Dólares</button>
            </div>
            <span className="hint" style={{ marginTop: 6 }}>
              Casi siempre es pesos. Si compraste la especie en dólares (las que
              terminan en D o C, tipo AL30D) elegí dólares. No lo adivinamos
              por el nombre: YPFD cotiza en pesos y hay CEDEARs que se llaman
              AMD o HD.
            </span>
          </div>
        )}

        <div className="row-2">
          <label className="field">
            <span className="field-label">¿Cuántos {t.unidad}?</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </label>
          <label className="field">
            <span className="field-label">Precio de compra (opcional)</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={compra}
              onChange={(e) => setCompra(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </label>
        </div>

        {POR_LAMINA.includes(tipo) && (
          <p className="hint">
            Los bonos, las letras y las ONs se cargan por <b>valor nominal</b>,
            que es lo que dice tu broker: si tenés 100.000 nominales de AL30,
            poné 100.000. Cotizan cada 100 nominales y esa cuenta la hacemos
            nosotros.
          </p>
        )}

        <div className="dialogo-botones">
          <button type="button" className="dialogo-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="submit"
            className="dialogo-btn principal"
            disabled={!simbolo || !Number(cantidad)}
          >Agregar</button>
        </div>
      </form>
    </Modal>
  )
}
