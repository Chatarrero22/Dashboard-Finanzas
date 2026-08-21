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
import { api, money, Empty, montoDesde, soloPlata } from './comunes.jsx'
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

// Colores de las barras del reparto. Salen de los tokens de los dos temas.
const COLORES = [
  'var(--accent)', 'var(--good)', 'var(--blue)',
  'var(--yellow)', 'var(--hoja)', 'var(--critical)',
]

/**
 * Cuanto pesa un tipo en la cartera. Redondear a cero hace que una tenencia
 * chica parezca que no vale nada, asi que abajo del 1% lo decimos aparte.
 */
function pctCartera(monto, total) {
  const pct = (monto / (total || 1)) * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
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

export default function InversionesScreen({ portfolio, accion, cuentas, onError, onReload }) {
  const { confirmar } = useDialogos()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [sacando, setSacando] = useState(null)

  useEffect(() => { if (accion) setAbierto(true) }, [accion])

  // Los precios se mueven durante la rueda: refrescamos solos cada minuto
  // mientras estás mirando la pantalla. Al salir se corta.
  useEffect(() => {
    const id = setInterval(() => { onReload() }, 60000)
    return () => clearInterval(id)
  }, [onReload])

  if (!portfolio) return <div className="spinner" />

  const {
    assets, totalValue, totalCost, totalPnl, totalPnlPct, valorConCosto,
    porTipo, sinPrecio, sinCosto, cambio24h, cambio24hPct, minutos,
  } = portfolio

  /**
   * Sacar un activo son dos cosas muy distintas y no se pueden adivinar:
   * o lo vendiste (y la plata volvió a una cuenta) o te equivocaste al
   * cargarlo (y esa compra nunca existió). Preguntamos.
   */
  async function borrar(a) {
    let compra = null
    try {
      const r = await api(`/portfolio/${a.id}/compra`)
      compra = r.compra
    } catch {
      /* si no se puede saber, seguimos como antes */
    }

    // Si nunca se descontó de una cuenta, no hay nada que devolver.
    if (!compra) {
      const ok = await confirmar({
        titulo: `¿Sacar ${a.symbol} de la cartera?`,
        detalle: 'Deja de contar en tu patrimonio. No toca ninguna cuenta, porque esta compra no se descontó de ninguna.',
        aceptar: 'Sacarlo', peligro: true,
      })
      if (!ok) return
      try {
        await api(`/portfolio/${a.id}`, { method: 'DELETE' })
        onReload()
      } catch (err) { onError(err.message) }
      return
    }

    setSacando({ activo: a, compra })
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
          {cambio24h
            ? <>hoy {money(cambio24h, { sign: true })} <Variacion pct={cambio24hPct} /></>
            : 'Sin movimiento hoy'}
        </div>
      </div>

      {/* Lo que pediste ver: la ganancia de verdad. Cuánto pusiste, cuánto
          vale hoy y la diferencia — igual que en CoinMarketCap. */}
      <div className="kpis kpis-3">
        <div className="kpi">
          <div className="kpi-label">Lo que pusiste</div>
          <Numero className="kpi-valor monto-sensible" valor={totalCost} />
          <span className="kpi-sub">
            {sinCosto && sinCosto.length
              ? `sin contar ${sinCosto.length} sin precio de compra`
              : 'precio de compra de toda la cartera'}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Lo que vale hoy</div>
          <Numero className="kpi-valor monto-sensible" valor={valorConCosto} />
          <span className="kpi-sub">a precio de mercado</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ganancia</div>
          <Numero
            className={`kpi-valor monto-sensible ${totalCost ? (totalPnl >= 0 ? 'positivo' : 'negativo') : ''}`}
            valor={totalPnl}
            opciones={{ sign: true }}
          />
          <span className="kpi-sub">
            {totalCost
              ? `${totalPnl >= 0 ? '▲' : '▼'} ${Math.abs(totalPnlPct).toFixed(2)}% desde que compraste`
              : 'cargá el precio de compra para verla'}
          </span>
        </div>
      </div>

      {/* El aviso importante: si falta el precio de compra de algo, la
          ganancia de arriba habla de una parte de la cartera, no de toda. */}
      {sinCosto && sinCosto.length > 0 && totalCost > 0 && (
        <p className="hint">
          La ganancia es sobre {money(valorConCosto)} de los {money(totalValue)} que
          tenés: de {sinCosto.join(', ')} no sé a cuánto {sinCosto.length === 1 ? 'lo compraste' : 'los compraste'}.
          Tocá <b>Editar</b> y ponele el precio de compra para que entre en la cuenta.
        </p>
      )}

      {conPlata.length > 1 && (
        <section className="card">
          <div className="card-rotulo">CÓMO ESTÁ REPARTIDA</div>
          <div className="reparto">
            {conPlata.map((t, i) => (
              <div className="reparto-fila" key={t.id}>
                <span className="reparto-nombre">{t.icono} {t.nombre}</span>
                <div className="reparto-barra">
                  <span
                    style={{
                      width: `${Math.max((porTipo[t.id] / (totalValue || 1)) * 100, 1.5)}%`,
                      background: COLORES[i % COLORES.length],
                    }}
                  />
                </div>
                <span className="reparto-pct">{pctCartera(porTipo[t.id], totalValue)}</span>
                <span className="reparto-monto monto-sensible">{money(porTipo[t.id])}</span>
              </div>
            ))}
          </div>
        </section>
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
                <div className="activo" key={a.id}>
                  <div className="activo-nombre">
                    <span className="activo-sim">{a.symbol}</span>
                    {a.currency === 'USD' && a.asset_type !== 'crypto' && (
                      <span className="tag">en US$</span>
                    )}
                    <span className="activo-cant">{unidades(a.quantity, a.unidad)}</span>
                  </div>

                  <div className="activo-dato">
                    <span className="activo-rotulo">Precio</span>
                    <span className="activo-valor monto-sensible">{precio(a.price, a.currency)}</span>
                    <Variacion pct={a.change24h} />
                  </div>

                  <div className="activo-dato">
                    <span className="activo-rotulo">Compra</span>
                    {a.avg_price ? (
                      <span className="activo-valor monto-sensible">{precio(a.avg_price, a.currency)}</span>
                    ) : (
                      <button className="activo-falta" onClick={() => setEditando(a)}>
                        ponelo
                      </button>
                    )}
                  </div>

                  <div className="activo-dato">
                    <span className="activo-rotulo">Ganancia</span>
                    {a.pnl != null && a.pnl_pct != null ? (
                      <>
                        <span className={`activo-valor monto-sensible ${a.pnl >= 0 ? 'positive' : 'negative'}`}>
                          {money(a.pnl, { sign: true })}
                        </span>
                        <span className={`var-chip ${a.pnl >= 0 ? 'sube' : 'baja'}`}>
                          {a.pnl >= 0 ? '▲' : '▼'} {Math.abs(a.pnl_pct).toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="activo-valor apagado">—</span>
                    )}
                  </div>

                  <div className="activo-total">
                    <span className="activo-rotulo">Vale</span>
                    <span className="activo-valor fuerte monto-sensible">
                      {a.value != null ? money(a.value) : 'sin precio'}
                    </span>
                  </div>

                  <div className="activo-acciones">
                    <button className="chip" onClick={() => setEditando(a)}>Editar</button>
                    <button className="danger" aria-label={`Sacar ${a.symbol}`} onClick={() => borrar(a)}>✕</button>
                  </div>
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
          cuentas={cuentas}
          onCerrar={() => setAbierto(false)}
          onHecho={() => { setAbierto(false); onReload() }}
          onError={onError}
        />
      )}

      {sacando && (
        <SacarActivo
          {...sacando}
          cuentas={cuentas}
          onCerrar={() => setSacando(null)}
          onHecho={() => { setSacando(null); onReload() }}
          onError={onError}
        />
      )}

      {editando && (
        <EditarActivo
          activo={editando}
          onCerrar={() => setEditando(null)}
          onHecho={() => { setEditando(null); onReload() }}
          onError={onError}
        />
      )}
    </>
  )
}

/* ---------------------------------------------------- editar una tenencia */

/**
 * Corregir la cantidad y, sobre todo, poner el precio de compra.
 *
 * Faltaba: el precio de compra solo se podia cargar al dar de alta el activo,
 * asi que si te lo salteabas no habia forma de arreglarlo despues y la
 * ganancia quedaba en "—" para siempre.
 */
function EditarActivo({ activo, onCerrar, onHecho, onError }) {
  const [cantidad, setCantidad] = useState(String(activo.quantity || ''))
  const [compra, setCompra] = useState(activo.avg_price ? String(activo.avg_price) : '')
  const [moneda, setMoneda] = useState(activo.currency || 'ARS')

  const esCripto = activo.asset_type === 'crypto'
  const cant = montoDesde(cantidad)
  const precioCompra = montoDesde(compra)

  // Lo que va a mostrar la pantalla cuando guardes, calculado acá para que lo
  // veas antes de guardar y no despues.
  const valorHoy = activo.price != null ? (cant * activo.price) / (activo.lamina || 1) : null
  const costo = (cant * precioCompra) / (activo.lamina || 1)
  const gananciaPct = valorHoy != null && costo ? ((valorHoy - costo) / costo) * 100 : null

  async function guardar(e) {
    e.preventDefault()
    if (!cant) return onError(`Poné cuántos ${activo.unidad} tenés`)
    try {
      await api(`/portfolio/${activo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: cant, avg_price: precioCompra, currency: moneda }),
      })
      onHecho()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <Modal
      titulo={activo.symbol}
      detalle="Corregí la cantidad o ponele el precio de compra para ver cuánto ganaste."
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar}>
        <div className="row-2">
          <label className="field">
            <span className="field-label">¿Cuántos {activo.unidad}?</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(soloPlata(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">¿A cuánto {activo.unidad === 'nominales' ? 'cada 100' : 'cada uno'}?</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={compra}
              onChange={(e) => setCompra(soloPlata(e.target.value))}
            />
          </label>
        </div>

        {!esCripto && (
          <div className="field">
            <span className="field-label">Moneda</span>
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
          </div>
        )}

        <div className="cuenta-previa">
          <div>
            <span className="activo-rotulo">Hoy vale</span>
            <span className="activo-valor fuerte">
              {valorHoy != null ? precio(valorHoy, moneda) : 'sin precio'}
            </span>
          </div>
          <div>
            <span className="activo-rotulo">Pusiste</span>
            <span className="activo-valor">{costo ? precio(costo, moneda) : '—'}</span>
          </div>
          <div>
            <span className="activo-rotulo">Ganancia</span>
            <span className={`activo-valor ${gananciaPct == null ? '' : gananciaPct >= 0 ? 'positive' : 'negative'}`}>
              {gananciaPct == null ? '—' : `${gananciaPct >= 0 ? '▲' : '▼'} ${Math.abs(gananciaPct).toFixed(2)}%`}
            </span>
          </div>
        </div>

        {activo.unidad === 'nominales' && (
          <p className="hint">
            El precio va como lo dice tu broker: <b>cada 100 nominales</b>. Si AL30
            figura a 84.350, poné 84.350.
          </p>
        )}

        <div className="dialogo-botones">
          <button type="button" className="dialogo-btn" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="dialogo-btn principal" disabled={!cant}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------- alta de un activo */

function AgregarActivo({ cuentas, onCerrar, onHecho, onError }) {
  const [tipo, setTipo] = useState('cedear')
  const [texto, setTexto] = useState('')
  const [elegido, setElegido] = useState(null)
  const [opciones, setOpciones] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [cantidad, setCantidad] = useState('')
  const [compra, setCompra] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  // De qué cuenta salió la plata. Vacío = no descontar de ninguna.
  const [desdeCuenta, setDesdeCuenta] = useState('')
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
    if (!montoDesde(cantidad)) return onError(`Poné cuántos ${t.unidad} tenés`)
    try {
      await api('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          symbol: simbolo,
          asset_type: tipo,
          quantity: montoDesde(cantidad),
          avg_price: montoDesde(compra),
          currency: esCripto ? 'USD' : moneda,
          account_id: desdeCuenta || null,
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
              onChange={(e) => setCantidad(soloPlata(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">Precio de compra (opcional)</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={compra}
              onChange={(e) => setCompra(soloPlata(e.target.value))}
            />
          </label>
        </div>

        {/* De dónde salió la plata.
            Sin esto la misma plata se contaba dos veces: como pesos en tu
            cuenta Y como título. Comprar no es gastar, así que el movimiento
            que genera no aparece en tus gastos del mes: solo baja el saldo de
            la cuenta, porque esos pesos ahora son otra cosa. */}
        {(cuentas || []).length > 0 && (
          <label className="field">
            <span className="field-label">¿De qué cuenta salió la plata?</span>
            <select value={desdeCuenta} onChange={(e) => setDesdeCuenta(e.target.value)}>
              <option value="">No descontar de ninguna cuenta</option>
              {(cuentas || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {money(c.saldo)}</option>
              ))}
            </select>
            <span className="hint" style={{ marginTop: 6 }}>
              {desdeCuenta
                ? 'Se descuenta de esa cuenta. No cuenta como gasto: cambiaste pesos por un título, no gastaste nada.'
                : 'Si no elegís ninguna, la plata sigue figurando en tus cuentas Y el título en tu cartera, o sea contada dos veces.'}
            </span>
          </label>
        )}

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
            disabled={!simbolo || !montoDesde(cantidad)}
          >Agregar</button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------- sacar una tenencia --- */

/**
 * Sacar un activo que se pagó desde una cuenta.
 *
 * Son dos cosas distintas y la app no las puede adivinar:
 *
 *   Lo vendiste     -> la plata vuelve a una cuenta, al precio de HOY. Ahí es
 *                      donde se hace real la ganancia o la pérdida.
 *   Me equivoqué    -> deshacemos la compra: la cuenta vuelve a como estaba,
 *                      como si nunca hubieras sacado esa plata.
 */
function SacarActivo({ activo, compra, cuentas, onCerrar, onHecho, onError }) {
  const [vendido, setVendido] = useState(true)
  const [cuenta, setCuenta] = useState(() => {
    // Por defecto, la misma cuenta de la que salió.
    if (compra && compra.account_id) return String(compra.account_id)
    return String((cuentas || [])[0]?.id || '')
  })
  const [guardando, setGuardando] = useState(false)

  const loQuePagaste = Math.abs(compra?.amount || 0)
  const valeHoy = activo.value != null ? activo.value : null
  const ganancia = valeHoy != null ? valeHoy - loQuePagaste : null

  async function sacar() {
    if (guardando) return
    setGuardando(true)
    try {
      const q = vendido && valeHoy != null
        ? `?vendido=1&account_id=${cuenta}&monto=${valeHoy}`
        : ''
      await api(`/portfolio/${activo.id}${q}`, { method: 'DELETE' })
      onHecho()
    } catch (err) {
      onError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={`Sacar ${activo.symbol}`}
      detalle={`Lo pagaste desde ${compra.cuenta || 'una cuenta'}. ¿Qué pasó con esa plata?`}
      onCerrar={onCerrar}
    >
      <div className="field">
        <div className="tipos">
          <button
            type="button"
            className={`tipo ${vendido ? 'elegido' : ''}`}
            onClick={() => setVendido(true)}
          >
            <span className="tipo-ico">💵</span>
            <span className="tipo-txt">
              <span className="tipo-nombre">Lo vendí</span>
              <small>
                {valeHoy != null
                  ? `Vuelven ${money(valeHoy)} a la cuenta que elijas`
                  : 'Sin precio de mercado no puedo calcular cuánto vuelve'}
              </small>
            </span>
          </button>
          <button
            type="button"
            className={`tipo ${!vendido ? 'elegido' : ''}`}
            onClick={() => setVendido(false)}
          >
            <span className="tipo-ico">↩</span>
            <span className="tipo-txt">
              <span className="tipo-nombre">Me equivoqué al cargarlo</span>
              <small>Deshace la compra: la cuenta vuelve como estaba</small>
            </span>
          </button>
        </div>
      </div>

      {vendido && valeHoy != null && (
        <>
          <label className="field">
            <span className="field-label">¿A qué cuenta vuelve la plata?</span>
            <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              {(cuentas || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {money(c.saldo)}</option>
              ))}
            </select>
          </label>

          <div className="cuenta-previa">
            <div>
              <span className="activo-rotulo">Pagaste</span>
              <span className="activo-valor monto-sensible">{money(loQuePagaste)}</span>
            </div>
            <div>
              <span className="activo-rotulo">Vuelven</span>
              <span className="activo-valor fuerte monto-sensible">{money(valeHoy)}</span>
            </div>
            <div>
              <span className="activo-rotulo">Ganancia</span>
              <span className={`activo-valor ${ganancia >= 0 ? 'positive' : 'negative'}`}>
                {money(ganancia, { sign: true })}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="dialogo-botones">
        <button type="button" className="dialogo-btn" onClick={onCerrar}>Cancelar</button>
        <button
          type="button"
          className="dialogo-btn principal"
          onClick={sacar}
          disabled={guardando || (vendido && valeHoy != null && !cuenta)}
        >{guardando ? 'Sacando…' : 'Sacar'}</button>
      </div>
    </Modal>
  )
}
