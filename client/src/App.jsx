import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Login from './Login.jsx'
import Setup from './Setup.jsx'
import Arbol from './Arbol.jsx'
import PnlScreen from './Pnl.jsx'
import PresupuestosScreen from './Presupuestos.jsx'
import PatrimonioScreen from './Patrimonio.jsx'
import AlertasScreen from './Alertas.jsx'
import GastosScreen from './Gastos.jsx'
import ResumenScreen from './Resumen.jsx'
import TarjetasScreen from './Tarjetas.jsx'
import { Lateral, Topbar, PaginaHead, mesLargo, correrMes } from './Shell.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'
import { icono } from './comunes.jsx'
import { configurar as configurarMoneda } from './moneda.js'
import { formatear } from './moneda.js'

/* ------------------------------------------------------------------ utils */

const API = '/api'

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  // Si la sesión venció, volvemos al login recargando: /me va a decir que no
  // hay sesión y se muestra la pantalla de entrada.
  if (res.status === 401) {
    window.location.reload()
    throw new Error('Se cerró la sesión')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Algo salió mal')
  return data
}

// Una sola implementación para toda la app: la de moneda.js, que sabe si
// hay que mostrar pesos o dólares.
function money(n, opciones) {
  return formatear(n, opciones)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function monthLabel(ym) {
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m] = String(ym).split('-')
  return `${names[Number(m) - 1] || ''} ${String(y).slice(2)}`
}

function dayLabel(iso) {
  const d = String(iso).split('-')
  return `${d[2]}/${d[1]}`
}

/* --------------------------------------------------------------- componentes */

function Hero({ label, value, caption }) {
  const cls = value > 0 ? 'positive' : value < 0 ? 'negative' : ''
  return (
    <div className="hero">
      <div className="label">{label}</div>
      <div className={`value ${cls}`}>{money(value)}</div>
      {caption ? <div className="caption">{caption}</div> : null}
    </div>
  )
}

function StatPair({ income, expense }) {
  return (
    <div className="stat-row">
      <div className="stat">
        <div className="label"><span className="dot in" />Entró</div>
        <div className="value">{money(income)}</div>
      </div>
      <div className="stat">
        <div className="label"><span className="dot out" />Salió</div>
        <div className="value">{money(expense)}</div>
      </div>
    </div>
  )
}

/* Barras horizontales, una sola serie: el color no codifica nada,
   cada barra lleva su nombre y su monto escritos al lado. */
function CategoryBars({ data }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-row" key={d.category}>
          <div className="bar-head">
            <span className="bar-name">{d.category}</span>
            <span className="bar-value">{money(d.total)}</span>
          </div>
          <div
            className="bar-track"
            role="img"
            aria-label={`${d.category}: ${money(d.total)}`}
          >
            <div className="bar-fill" style={{ width: `${(d.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MonthBars({ data }) {
  const max = Math.max(...data.map((d) => d.expense), 1)
  return (
    <div className="months">
      {data.map((d) => (
        <div className="month-col" key={d.month}>
          <div
            className="month-bar"
            style={{ height: `${Math.max((d.expense / max) * 100, 2)}%` }}
            role="img"
            aria-label={`${monthLabel(d.month)}: gastaste ${money(d.expense)}`}
            title={money(d.expense)}
          />
          <div className="month-label">{monthLabel(d.month)}</div>
        </div>
      ))}
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div className="empty">
      <span className="big">{icon}</span>
      {text}
    </div>
  )
}

function GoalList({ goals, onAdd, onRemove, celebrating }) {
  return (
    <div>
      {goals.map((g) => (
        <div className={`goal ${celebrating === g.id ? 'celebrate' : ''}`} key={g.id}>
          <div className="goal-head">
            <span className="goal-name">{g.done ? '🏆 ' : ''}{g.name}</span>
            <span className="goal-pct">{Math.round(g.pct)}%</span>
          </div>
          <div
            className="goal-track"
            role="img"
            aria-label={`${g.name}: juntaste ${money(g.saved)} de ${money(g.target)}`}
          >
            <div className={`goal-fill ${g.done ? 'done' : ''}`} style={{ width: `${g.pct}%` }} />
          </div>
          <div className="goal-meta">
            <span>{money(g.saved)} juntados</span>
            <span>{g.done ? '¡Listo!' : `faltan ${money(g.remaining)}`}</span>
          </div>
          {onAdd && (
            <div className="goal-actions">
              <button className="ghost" onClick={() => onAdd(g, 1)}>+ Sumar</button>
              <button className="ghost" onClick={() => onAdd(g, -1)}>− Sacar</button>
              <button className="danger" aria-label={`Borrar ${g.name}`} onClick={() => onRemove(g)}>✕</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Upcoming({ items }) {
  return (
    <div>
      {items.map((s) => (
        <div className="upcoming" key={s.id}>
          <div className="upcoming-day">
            <span className="num">{s.billing_day}</span>
            <span className="txt">día</span>
          </div>
          <div className="item-main">
            <div className="item-desc">{s.name}</div>
            <div className="item-meta"><span>{s.category}</span></div>
          </div>
          <div className="item-amount">{money(s.amount)}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ agregar gasto */

function AddForm({ categories, monedaPorDefecto, dolar, onSaved, onError, onCerrar }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('gasto')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayISO())
  const [enCuotas, setEnCuotas] = useState('1')
  // Arranca en la moneda que estás mirando arriba: si tenés puesto US$,
  // probablemente estés pensando en dólares.
  const [moneda, setMoneda] = useState(monedaPorDefecto || 'ars')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const value = Number(String(amount).replace(',', '.'))
    if (!value || !description.trim()) {
      onError('Escribí un monto y en qué lo gastaste')
      return
    }

    setSaving(true)
    try {
      const r = await api('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          transactions: [{
            date,
            description: description.trim(),
            amount: kind === 'ingreso' ? Math.abs(value) : -Math.abs(value),
          }],
          category: category || undefined,
          moneda: moneda,
          cuotas: Number(enCuotas) > 1 ? Number(enCuotas) : undefined,
          platform: 'Web',
        }),
      })
      setAmount('')
      setDescription('')
      setCategory('')
      setEnCuotas('1')
      setDate(todayISO())
      var extra = ''
      if (r?.premio?.subioDeEtapa) extra = ` · 🌱 ¡Tu árbol creció! Ahora es ${r.premio.etapa.nombre}`
      else if (r?.premio?.logros?.length) extra = ` · ${r.premio.logros[0].emoji} Logro: ${r.premio.logros[0].nombre}`
      onSaved((kind === 'ingreso' ? 'Ingreso guardado' : 'Gasto guardado') + extra)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="segmented">
        <button type="button" aria-pressed={kind === 'gasto'} onClick={() => setKind('gasto')}>
          Gasto
        </button>
        <button type="button" aria-pressed={kind === 'ingreso'} onClick={() => setKind('ingreso')}>
          Ingreso
        </button>
      </div>

      <label className="field">
        <span className="field-label">¿Cuánto?</span>
        <div className="monto-fila">
          <input
            className="amount-input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <div className="grupo-pill monto-moneda">
            <button
              type="button"
              className={moneda === 'ars' ? 'on' : ''}
              onClick={() => setMoneda('ars')}
            >$</button>
            <button
              type="button"
              className={moneda === 'usd' ? 'on' : ''}
              onClick={() => setMoneda('usd')}
              disabled={!dolar}
              title={dolar ? 'Cargarlo en dólares' : 'No tengo la cotización del dólar ahora'}
            >US$</button>
          </div>
        </div>
        {moneda === 'usd' && dolar > 0 && (
          <span className="hint" style={{ marginTop: 6 }}>
            {Number(amount) > 0
              ? `Son ${money(Number(String(amount).replace(',', '.')) * dolar)} al dólar de hoy (${money(dolar)}). Se guarda ese valor.`
              : `Se pasa a pesos al dólar de hoy (${money(dolar)}) y queda fijo.`}
          </span>
        )}
      </label>

      <label className="field">
        <span className="field-label">¿En qué?</span>
        <input
          type="text"
          placeholder="Ej: Supermercado Disco"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="row-2">
        <label className="field">
          <span className="field-label">Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Automática</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {/* Cuotas: solo tiene sentido en un gasto. Un sueldo en 6 cuotas no
          existe, y ofrecerlo confunde. */}
      {kind === 'gasto' && (
        <label className="field">
          <span className="field-label">¿En cuántas cuotas?</span>
          <select value={enCuotas} onChange={(e) => setEnCuotas(e.target.value)}>
            <option value="1">Un solo pago</option>
            {[2, 3, 6, 9, 12, 18, 24].map((n) => (
              <option key={n} value={n}>{n} cuotas</option>
            ))}
          </select>
          {Number(enCuotas) > 1 && Number(amount) > 0 && (
            <span className="hint" style={{ marginTop: 6 }}>
              Te queda {money(Number(amount) / Number(enCuotas))} por mes durante
              {' '}{enCuotas} meses.
            </span>
          )}
        </label>
      )}

      {!category && (
        <p className="hint">Si dejás la categoría en automática, la elige sola.</p>
      )}

      <div className="dialogo-botones">
        <button type="button" className="dialogo-btn" onClick={onCerrar}>Cancelar</button>
        <button
          type="submit"
          className="dialogo-btn principal"
          disabled={saving || !amount || !description.trim()}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------- pantallas */

/** El alta de un movimiento, en un pop-up. */
function NuevoMovimiento({ config, categories, monedaPorDefecto, dolar, onSaved, onError, onCerrar }) {
  return (
    <Modal
      titulo="Nuevo movimiento"
      detalle={config.telegram
        ? 'También podés escribirle al bot: «Disco 15400», o mandarle la foto de un ticket.'
        : 'Anotá un gasto o un ingreso.'}
      onCerrar={onCerrar}
    >
      <AddForm
        categories={categories}
        monedaPorDefecto={monedaPorDefecto}
        dolar={dolar}
        onSaved={onSaved}
        onError={onError}
        onCerrar={onCerrar}
      />
    </Modal>
  )
}


function MovementsScreen({ transactions, categories, cards, onDelete, onRecategorizar, onAsignarTarjeta, loading }) {
  const [query, setQuery] = useState('')
  // El movimiento al que le estamos cambiando la categoría, si hay alguno.
  const [editando, setEditando] = useState(null)
  // El movimiento al que le estamos poniendo tarjeta, si hay alguno.
  const [tarjetaDe, setTarjetaDe] = useState(null)
  const hoy = todayISO()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        String(t.category).toLowerCase().includes(q),
    )
  }, [transactions, query])

  if (loading) return <div className="spinner" />

  return (
    <>
      <input
        type="search"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <section className="card">
        {filtered.length === 0 ? (
          <Empty icon="🧾" text={query ? 'No encontré nada con eso.' : 'Todavía no hay movimientos.'} />
        ) : (
          <div className="list">
            {filtered.map((t) => (
              <div className={`item ${t.date > hoy ? 'futuro' : ''}`} key={t.id}>
                <div className="item-main">
                  <div className="item-desc">{t.description}</div>
                  <div className="item-meta">
                    <span>{dayLabel(t.date)}</span>
                    {/* Una cuota de un mes que todavia no llego no es un gasto
                        que ya hiciste: se avisa para no confundir. */}
                    {t.date > hoy && <span className="tag">se viene</span>}
                    {/* La categoría es un botón: si Manguito se equivocó,
                        se toca y se corrige ahí mismo. */}
                    <button
                      className="tag tag-editable"
                      onClick={() => setEditando(t)}
                      title="Cambiar la categoría"
                    >
                      {icono(t.category)} {t.category} ▾
                    </button>
                    {/* Con qué tarjeta se pagó. Solo aparece si cargaste
                        alguna: si no, es ruido. */}
                    {cards && cards.length > 0 && (
                      <button
                        className="tag tag-editable"
                        onClick={() => setTarjetaDe(t)}
                        title="Con qué tarjeta se pagó"
                      >
                        {(() => {
                          const c = cards.find((x) => x.id === t.card_id)
                          return c
                            ? <><span className="punto-tarjeta" style={{ background: c.color }} />{c.name}</>
                            : '▭ Sin tarjeta'
                        })()} ▾
                      </button>
                    )}
                    {/* Si lo cargaste en dolares, se ve: el monto en pesos
                        quedo congelado al cambio de ese dia. */}
                    {t.amount_usd ? (
                      <span className="tag" title={`Al dólar de ${money(t.usd_rate)}`}>
                        US${Math.abs(t.amount_usd).toLocaleString('es-AR')}
                      </span>
                    ) : null}
                    {t.items?.length > 0 && <span>{t.items.length} productos</span>}
                  </div>
                </div>
                <div className={`item-amount ${t.amount > 0 ? 'positive' : ''}`}>
                  {money(t.amount, { sign: true })}
                </div>
                <button
                  className="danger"
                  aria-label={`Borrar ${t.description}`}
                  onClick={() => onDelete(t)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {tarjetaDe && (
        <Modal
          titulo="¿Con qué tarjeta?"
          detalle={`${tarjetaDe.description} · ${money(tarjetaDe.amount)}`}
          onCerrar={() => setTarjetaDe(null)}
        >
          <div className="cats-grid">
            <button
              className={`cat-opcion ${!tarjetaDe.card_id ? 'elegida' : ''}`}
              onClick={async () => {
                const tx = tarjetaDe
                setTarjetaDe(null)
                if (tx.card_id) await onAsignarTarjeta(tx, null)
              }}
            >
              <span className="cat-opcion-ico">◈</span>
              Ninguna
            </button>
            {cards.map((c) => (
              <button
                key={c.id}
                className={`cat-opcion ${c.id === tarjetaDe.card_id ? 'elegida' : ''}`}
                onClick={async () => {
                  const tx = tarjetaDe
                  setTarjetaDe(null)
                  if (c.id !== tx.card_id) await onAsignarTarjeta(tx, c.id)
                }}
              >
                <span className="punto-tarjeta" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {editando && (
        <Modal
          titulo="Cambiar la categoría"
          detalle={`${editando.description} · ${money(editando.amount)}`}
          onCerrar={() => setEditando(null)}
        >
          <div className="cats-grid">
            {categories.map((c) => (
              <button
                key={c}
                className={`cat-opcion ${c === editando.category ? 'elegida' : ''}`}
                onClick={async () => {
                  const tx = editando
                  setEditando(null)
                  if (c !== tx.category) await onRecategorizar(tx, c)
                }}
              >
                <span className="cat-opcion-ico">{icono(c)}</span>
                {c}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function SubsScreen({ subs, accion, onReload, onError, onSaved }) {
  const { confirmar } = useDialogos()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', billing_day: '1' })

  // El boton "+ Nuevo gasto fijo" vive en el encabezado, que es de App.
  useEffect(() => { if (accion) setShowForm(true) }, [accion])

  const total = subs.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0)

  async function add(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.amount) return onError('Falta el nombre o el monto')
    try {
      await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          amount: Number(form.amount),
          billing_day: Number(form.billing_day) || 1,
        }),
      })
      setForm({ name: '', amount: '', billing_day: '1' })
      setShowForm(false)
      onSaved('Suscripción agregada')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function remove(sub) {
    const ok = await confirmar({
      titulo: `¿Borrar ${sub.name}?`,
      detalle: 'Deja de cargarse sola todos los meses. Lo ya cargado queda.',
      aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/subscriptions/${sub.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <Hero label="Suscripciones por mes" value={total} />

      {showForm && (
        <Modal
          titulo="Nuevo gasto fijo"
          detalle="Se carga solo el día que se cobra, todos los meses."
          onCerrar={() => setShowForm(false)}
        >
          <form onSubmit={add}>
            <label className="field">
              <span className="field-label">Nombre</span>
              <input
                value={form.name}
                placeholder="Netflix"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="row-2">
              <label className="field">
                <span className="field-label">Monto</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })}
                />
              </label>
              <label className="field">
                <span className="field-label">Día de cobro</span>
                <input
                  inputMode="numeric"
                  value={form.billing_day}
                  onChange={(e) => setForm({ ...form, billing_day: e.target.value.replace(/\D/g, '') })}
                />
              </label>
            </div>
            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button
                type="submit"
                className="dialogo-btn principal"
                disabled={!form.name.trim() || !form.amount}
              >Agregar</button>
            </div>
          </form>
        </Modal>
      )}

      <section className="card">
        {subs.length === 0 ? (
          <Empty icon="🔁" text="No hay suscripciones cargadas." />
        ) : (
          <div className="list">
            {subs.map((s) => (
              <div className="item" key={s.id}>
                <div className="item-main">
                  <div className="item-desc">{s.name}</div>
                  <div className="item-meta">
                    <span>Día {s.billing_day}</span>
                    {s.promo_active && (
                      <span className="tag">promo hasta {dayLabel(s.promo_end)} → {money(s.normal_price)}</span>
                    )}
                  </div>
                </div>
                <div className="item-amount">{money(s.amount)}</div>
                <button className="danger" aria-label={`Borrar ${s.name}`} onClick={() => remove(s)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function ArbolScreen({ progreso, onReload }) {
  if (!progreso) return <div className="spinner" />

  const { etapa, xp, racha, mejorRacha, rachaHoy, logros, pendientes, total } = progreso

  return (
    <>
      <section className="card arbol-card">
        <Arbol stage={etapa.stage} />
        <div className="arbol-etapa">{etapa.emoji} {etapa.nombre}</div>
        <p className="arbol-dice">{etapa.dice}</p>

        <div className="arbol-barra" role="img"
             aria-label={`Vas ${Math.round(etapa.progreso)}% hacia la próxima etapa`}>
          <div style={{ width: `${etapa.progreso}%` }} />
        </div>
        <div className="arbol-falta">
          {xp} puntos
          {etapa.siguiente
            ? ` · faltan ${etapa.siguiente.desde - xp} para ${etapa.siguiente.nombre}`
            : ' · llegaste al máximo'}
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
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Logros</h2>
          <span className="tag">{logros.length} de {total}</span>
        </div>
        <div className="logros">
          {logros.map((l) => (
            <div className="logro" key={l.code} title={l.dice}>
              <div className="cara">{l.emoji}</div>
              <div className="nom">{l.nombre}</div>
            </div>
          ))}
          {pendientes.map((l) => (
            <div className="logro bloqueado" key={l.code} title={l.dice}>
              <div className="cara">{l.emoji}</div>
              <div className="nom">{l.nombre}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Cómo crece</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          Anotar gastos suma poco y tiene tope diario: la idea no es premiar
          que cargues por cargar. Lo que de verdad hace crecer el árbol es
          <strong> gastar mejor</strong> — cerrar el mes sin pasarte de los
          presupuestos, terminar en verde, juntar para una meta e invertir.
        </p>
      </section>
    </>
  )
}

function MenuScreen({ grupos, actual, onGo }) {
  return (
    <>
      {grupos.map((g, i) => (
        <section className="card" key={g.titulo || `g${i}`}>
          {g.titulo && <h2>{g.titulo}</h2>}
          <div className="menu-lista">
            {g.items.map((t) => (
              <button
                key={t.id}
                className={`menu-item ${actual === t.id ? 'activo' : ''}`}
                onClick={() => onGo(t.id)}
              >
                <span className="menu-ico">{t.icon}</span>
                <span className="menu-txt">{t.label}</span>
                <span className="menu-flecha">›</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function MetasScreen({ goals, accion, onReload, onError, onSaved }) {
  const { confirmar, pedirTexto } = useDialogos()
  const [goalForm, setGoalForm] = useState({ name: '', target: '' })
  const [abierto, setAbierto] = useState(false)
  const [celebrating, setCelebrating] = useState(null)

  // El boton "+ Nueva meta" vive en el encabezado, que es de App.
  useEffect(() => { if (accion) setAbierto(true) }, [accion])

  async function addGoal(e) {
    e.preventDefault()
    if (!goalForm.name.trim() || !goalForm.target) return onError('Falta el nombre o el objetivo')
    try {
      await api('/goals', {
        method: 'POST',
        body: JSON.stringify({ name: goalForm.name.trim(), target: Number(goalForm.target) }),
      })
      setGoalForm({ name: '', target: '' })
      setAbierto(false)
      onSaved('Meta creada')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function addToGoal(goal, signo) {
    const texto = await pedirTexto({
      titulo: `${signo > 0 ? 'Sumar a' : 'Sacar de'} "${goal.name}"`,
      detalle: signo > 0 ? '¿Cuánto le ponés?' : '¿Cuánto le sacás?',
      placeholder: '0', inputMode: 'decimal', soloNumeros: true,
      aceptar: signo > 0 ? 'Sumar' : 'Sacar',
    })
    if (!texto) return
    const monto = Number(String(texto).replace(/[^\d.]/g, ''))
    if (!monto) return
    try {
      const actualizada = await api(`/goals/${goal.id}/add`, {
        method: 'POST',
        body: JSON.stringify({ amount: monto * signo }),
      })
      if (actualizada.justCompleted) {
        setCelebrating(goal.id)
        onSaved(`🏆 ¡Llegaste a "${goal.name}"!`)
        setTimeout(() => setCelebrating(null), 900)
      }
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function removeGoal(goal) {
    const ok = await confirmar({
      titulo: `¿Borrar la meta "${goal.name}"?`,
      detalle: 'Se pierde lo que llevabas juntado en esta meta.',
      aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-title-row">
          <h2>Metas de ahorro</h2>
          {goals.length > 0 && <span className="tag">{goals.length}</span>}
        </div>
        {goals.length === 0 ? (
          <Empty icon="🎯" text="Poné una meta con el botón de arriba y mirá cómo sube." />
        ) : (
          <GoalList goals={goals} onAdd={addToGoal} onRemove={removeGoal} celebrating={celebrating} />
        )}
      </section>

      {/* El alta abre un pop-up, no se despliega abajo */}
      {abierto && (
        <Modal
          titulo="Nueva meta"
          detalle="Un objetivo para juntar de a poco."
          onCerrar={() => setAbierto(false)}
        >
          <form onSubmit={addGoal}>
            <label className="field">
              <span className="field-label">¿Para qué juntás?</span>
              <input
                placeholder="Viaje, notebook, fondo de emergencia…"
                value={goalForm.name}
                onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">¿Cuánto necesitás?</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={goalForm.target}
                onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value.replace(/[^\d.]/g, '') })}
              />
            </label>
            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => setAbierto(false)}>Cancelar</button>
              <button
                type="submit"
                className="dialogo-btn principal"
                disabled={!goalForm.name.trim() || !goalForm.target}
              >Crear meta</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

function AjustesScreen({ config, onError, onSaved, onLogout, onDatosCambiados }) {
  const { confirmar } = useDialogos()
  const [orden, setOrden] = useState(null)
  const [ordenando, setOrdenando] = useState(false)
  const [reglas, setReglas] = useState(null)
  const [saldo, setSaldo] = useState(null)
  const [saldoReal, setSaldoReal] = useState('')

  useEffect(() => { api('/saldo').then((r) => setSaldo(r.saldo)).catch(() => {}) }, [])

  async function ajustarSaldo(e) {
    e.preventDefault()
    const real = Number(saldoReal)
    if (!saldoReal || isNaN(real)) return onError('Escribí cuánta plata tenés de verdad')

    const dif = real - (saldo || 0)
    const ok = await confirmar({
      titulo: dif < 0 ? `¿Descontar ${money(Math.abs(dif))}?` : `¿Sumar ${money(dif)}?`,
      detalle: `La app cree que tenés ${money(saldo || 0)} y vos decís que tenés ${money(real)}. ` +
        'Anoto un solo movimiento por la diferencia, con categoría Ajuste. ' +
        'No cuenta como gasto en ninguna categoría.',
      aceptar: 'Ajustar',
    })
    if (!ok) return

    try {
      const r = await api('/saldo', { method: 'POST', body: JSON.stringify({ saldoReal: real }) })
      setSaldo(r.saldo)
      setSaldoReal('')
      onSaved(r.ajustado ? 'Saldo ajustado' : r.mensaje)
      if (onDatosCambiados) onDatosCambiados()
    } catch (err) {
      onError(err.message)
    }
  }

  const cargarReglas = useCallback(() => {
    api('/aprendido').then((r) => setReglas(r.reglas)).catch(() => {})
  }, [])
  useEffect(() => { cargarReglas() }, [cargarReglas])

  async function olvidar(r) {
    const ok = await confirmar({
      titulo: `¿Olvidar «${r.clave}»?`,
      detalle: `Manguito deja de ponerlo en ${r.category} solo. Los movimientos ya cargados no se tocan.`,
      aceptar: 'Olvidar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/aprendido/${r.id}`, { method: 'DELETE' })
      cargarReglas()
    } catch (err) {
      onError(err.message)
    }
  }

  // Primero mira, despues aplica: nunca tocamos datos viejos sin permiso.
  async function revisarOrden() {
    setOrdenando(true)
    try {
      setOrden(await api('/mantenimiento/ordenar', { method: 'POST', body: JSON.stringify({}) }))
    } catch (err) {
      onError(err.message)
    } finally {
      setOrdenando(false)
    }
  }

  async function aplicarOrden() {
    const ok = await confirmar({
      titulo: `¿Ordenar ${orden.cambios.length} movimientos?`,
      detalle: 'Se cambian los textos y las categorías que quedaron en Otros. Los montos y las fechas no se tocan.',
      aceptar: 'Ordenar',
    })
    if (!ok) return
    try {
      const r = await api('/mantenimiento/ordenar', { method: 'POST', body: JSON.stringify({ aplicar: true }) })
      setOrden(r)
      onSaved(`${r.cambios.length} movimientos ordenados`)
      if (onDatosCambiados) onDatosCambiados()
    } catch (err) {
      onError(err.message)
    }
  }

  const [code, setCode] = useState(null)
  const [pass, setPass] = useState('')
  const [users, setUsers] = useState(null)
  const [nuevo, setNuevo] = useState({ username: '', display_name: '', password: '' })

  const cargarUsuarios = useCallback(() => {
    if (!config.isAdmin) return
    api('/users').then(setUsers).catch(() => {})
  }, [config.isAdmin])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  async function pedirCodigo() {
    try {
      const r = await api('/telegram/code', { method: 'POST' })
      setCode(r.code)
    } catch (err) { onError(err.message) }
  }

  async function cambiarPass(e) {
    e.preventDefault()
    if (pass.length < 6) return onError('La contraseña tiene que tener al menos 6 caracteres')
    try {
      await api('/password', { method: 'POST', body: JSON.stringify({ password: pass }) })
      setPass('')
      onSaved('Contraseña cambiada. Vas a tener que entrar de nuevo.')
      setTimeout(onLogout, 1500)
    } catch (err) { onError(err.message) }
  }

  /** Baja todo a un archivo .json que el navegador guarda. */
  async function descargar() {
    try {
      const datos = await api('/export')
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finanzas-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onSaved('Archivo descargado')
    } catch (err) {
      onError(err.message)
    }
  }

  async function importar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // permite volver a elegir el mismo archivo
    try {
      const texto = await file.text()
      const datos = JSON.parse(texto)
      const r = await api('/import', { method: 'POST', body: JSON.stringify(datos) })
      const s = r.resumen
      onSaved(
        `Listo: ${s.movimientos} movimientos` +
        (s.repetidos ? ` (${s.repetidos} ya estaban)` : '') +
        (s.suscripciones ? `, ${s.suscripciones} suscripciones` : '') +
        (s.cripto ? `, ${s.cripto} activos` : '')
      )
      setTimeout(() => window.location.reload(), 1800)
    } catch (err) {
      onError(err.message.slice(0, 120))
    }
  }

  async function crearUsuario(e) {
    e.preventDefault()
    if (!nuevo.username.trim() || nuevo.password.length < 6) {
      return onError('Falta el usuario o la contraseña (mínimo 6 caracteres)')
    }
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(nuevo) })
      setNuevo({ username: '', display_name: '', password: '' })
      onSaved('Usuario creado')
      cargarUsuarios()
    } catch (err) { onError(err.message) }
  }

  async function borrarUsuario(u) {
    const ok = await confirmar({
      titulo: `¿Borrar a ${u.display_name}?`,
      detalle: 'Se van también todos sus movimientos, metas y presupuestos. No se puede deshacer.',
      aceptar: 'Borrar todo', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' })
      cargarUsuarios()
    } catch (err) { onError(err.message) }
  }

  return (
    <>
      <section className="card">
        <h2>Tu cuenta</h2>
        <div className="item">
          <div className="item-main">
            <div className="item-desc">{config.displayName}</div>
            <div className="item-meta"><span>{config.username}</span>{config.isAdmin && <span className="tag">admin</span>}</div>
          </div>
        </div>
        <button className="ghost" style={{ width: '100%', marginTop: 12 }} onClick={onLogout}>
          Salir
        </button>
      </section>

      {config.telegram && (
        <section className="card">
          <h2>Conectar Telegram</h2>
          <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Pedí un código y mandale al bot <strong>/vincular</strong> seguido del número.
            Así sabe que los gastos son tuyos.
          </p>
          {code && <div className="code-box">{code}</div>}
          <button className="primary" onClick={pedirCodigo}>
            {code ? 'Pedir otro código' : 'Pedir código'}
          </button>
        </section>
      )}

      <section className="card">
        <h2>Respaldo de tus datos</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Bajate todo en un archivo. Sirve de copia de seguridad y para pasar tus
          datos a otra instalación (por ejemplo, de la PC al servidor).
        </p>
        <button className="ghost" style={{ width: '100%' }} onClick={descargar}>
          ⬇ Descargar mis datos
        </button>

        <div className="divider" style={{ margin: '16px 0' }} />

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Traer datos de un respaldo</span>
          <input type="file" accept=".json,application/json" onChange={importar} />
        </label>
        <p className="hint">
          No duplica nada: si un movimiento ya está cargado, lo saltea.
        </p>
      </section>

      {reglas && reglas.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2>Lo que aprendió Manguito</h2>
            <span className="tag">{reglas.length}</span>
          </div>
          <p className="hint">
            Cada vez que corregís una categoría, se la anota para la próxima.
            Si alguna quedó mal, sacala de acá.
          </p>
          <div className="reglas">
            {reglas.map((r) => (
              <div className="regla" key={r.id}>
                <span className="regla-clave">{r.clave}</span>
                <span className="regla-flecha">→</span>
                <span className="regla-cat">{icono(r.category)} {r.category}</span>
                {r.veces > 1 && <span className="tag">{r.veces} veces</span>}
                <button
                  className="danger"
                  aria-label={`Olvidar ${r.clave}`}
                  onClick={() => olvidar(r)}
                >✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <form className="card" onSubmit={ajustarSaldo}>
        <h2>Poner el saldo real</h2>
        <p className="hint">
          La app solo sabe de lo que cargaste. Si pagaste el resumen de un mes
          que nunca cargaste, cree que tenés esa plata y no la tenés. Decime
          cuánto tenés de verdad y anoto un solo movimiento por la diferencia.
        </p>
        <p className="hint">
          Según lo cargado tenés <strong className="monto-sensible">{money(saldo || 0)}</strong>.
        </p>
        <label className="field">
          <span className="field-label">¿Cuánto tenés de verdad?</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={saldoReal}
            onChange={(e) => setSaldoReal(e.target.value.replace(/[^\d.-]/g, ''))}
          />
        </label>
        <button className="primary" type="submit" disabled={!saldoReal}>Ajustar</button>
      </form>

      <section className="card">
        <div className="card-title-row">
          <h2>Ordenar lo ya cargado</h2>
          <button className="chip" onClick={revisarOrden} disabled={ordenando}>
            {ordenando ? 'Mirando…' : 'Revisar'}
          </button>
        </div>
        <p className="hint">
          Los movimientos viejos quedaron como los escribiste: «uade matricula»,
          «NETFLIX». Puedo emprolijarlos y volver a categorizar los que quedaron
          en Otros. Primero te muestro qué cambiaría; no toco nada sin que digas.
        </p>

        {orden && orden.cambios.length === 0 && (
          <p className="hint">Está todo prolijo, no hay nada para cambiar.</p>
        )}

        {orden && orden.cambios.length > 0 && (
          <>
            <div className="cambios">
              {orden.cambios.slice(0, 12).map((c) => (
                <div className="cambio" key={c.id}>
                  <span className="cambio-antes">{c.antes}</span>
                  <span className="cambio-flecha">→</span>
                  <span className="cambio-despues">{c.despues}</span>
                  {c.categoriaAntes !== c.categoriaDespues && (
                    <span className="tag">{c.categoriaAntes} → {c.categoriaDespues}</span>
                  )}
                </div>
              ))}
            </div>
            {orden.cambios.length > 12 && (
              <p className="hint">y {orden.cambios.length - 12} más…</p>
            )}
            {!orden.aplicado && (
              <button className="primary" style={{ marginTop: 14 }} onClick={aplicarOrden}>
                Aplicar los {orden.cambios.length} cambios
              </button>
            )}
          </>
        )}
      </section>

      <form className="card" onSubmit={cambiarPass}>
        <h2>Cambiar contraseña</h2>
        <label className="field">
          <span className="field-label">Contraseña nueva</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        <button className="primary" type="submit">Cambiar</button>
      </form>

      {config.isAdmin && (
        <>
          <section className="card">
            <h2>Personas</h2>
            {!users ? <div className="spinner" /> : (
              <div>
                {users.map((u) => (
                  <div className="user-row" key={u.id}>
                    <div className="item-main">
                      <div className="item-desc">{u.display_name}</div>
                      <div className="item-meta">
                        <span>{u.username}</span>
                        {u.is_admin ? <span className="tag">admin</span> : null}
                        {u.telegram_linked ? <span className="tag">Telegram</span> : null}
                      </div>
                    </div>
                    {u.id !== 1 && (
                      <button className="danger" aria-label={`Borrar ${u.display_name}`} onClick={() => borrarUsuario(u)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <form className="card" onSubmit={crearUsuario}>
            <h2>Sumar una persona</h2>
            <div className="row-2">
              <label className="field">
                <span className="field-label">Usuario</span>
                <input
                  autoCapitalize="none"
                  value={nuevo.username}
                  onChange={(e) => setNuevo({ ...nuevo, username: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Nombre</span>
                <input
                  value={nuevo.display_name}
                  onChange={(e) => setNuevo({ ...nuevo, display_name: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Contraseña</span>
              <input
                value={nuevo.password}
                onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              />
            </label>
            <p className="hint">
              Cada persona ve la app completa y sus propios datos. Nadie ve los
              movimientos de otro.
            </p>
            <button className="primary" type="submit">Crear</button>
          </form>
        </>
      )}
    </>
  )
}

function InvestScreen({ portfolio, accion, onError, onReload }) {
  const { confirmar } = useDialogos()
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ symbol: '', quantity: '', buy_price: '' })

  // El boton "+ Agregar activo" vive en el encabezado, que es de App.
  useEffect(() => { if (accion) setAbierto(true) }, [accion])

  async function agregar(e) {
    e.preventDefault()
    if (!form.symbol.trim() || !form.quantity) return onError('Falta el simbolo o la cantidad')
    try {
      await api('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          quantity: Number(form.quantity),
          buy_price: form.buy_price ? Number(form.buy_price) : null,
        }),
      })
      setForm({ symbol: '', quantity: '', buy_price: '' })
      setAbierto(false)
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  if (!portfolio) return <div className="spinner" />

  const { assets, totalValue, totalPnl, totalPnlPct, pricesAvailable } = portfolio

  async function remove(asset) {
    const ok = await confirmar({
      titulo: `¿Sacar ${asset.symbol} del portfolio?`,
      detalle: 'Deja de contar en tu patrimonio.',
      aceptar: 'Sacarlo', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/portfolio/${asset.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <Hero
        label="Portfolio (USD)"
        value={totalValue}
        caption={
          pricesAvailable
            ? `${totalPnl >= 0 ? '▲' : '▼'} ${money(Math.abs(totalPnl))} (${totalPnlPct.toFixed(1)}%)`
            : 'Sin cotizaciones — falta la clave de precios'
        }
      />
      <section className="card">
        {assets.length === 0 ? (
          <Empty icon="📈" text="No hay activos cargados." />
        ) : (
          <div className="list">
            {assets.map((a) => (
              <div className="item" key={a.id}>
                <div className="item-main">
                  <div className="item-desc">{a.symbol}</div>
                  <div className="item-meta">
                    <span>{a.quantity}</span>
                    {a.price != null && <span>a ${a.price.toFixed(2)}</span>}
                  </div>
                </div>
                <div className={`item-amount ${a.pnl > 0 ? 'positive' : ''}`}>
                  {a.value != null ? money(a.value) : '—'}
                </div>
                <button className="danger" aria-label={`Borrar ${a.symbol}`} onClick={() => remove(a)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {abierto && (
        <Modal
          titulo="Agregar activo"
          detalle="El precio lo traemos solo; el de compra es opcional y sirve para ver la ganancia."
          onCerrar={() => setAbierto(false)}
        >
          <form onSubmit={agregar}>
            <div className="row-2">
              <label className="field">
                <span className="field-label">Símbolo</span>
                <input
                  placeholder="BTC"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="field">
                <span className="field-label">Cantidad</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/[^\d.]/g, '') })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Precio de compra en US$ (opcional)</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={form.buy_price}
                onChange={(e) => setForm({ ...form, buy_price: e.target.value.replace(/[^\d.]/g, '') })}
              />
            </label>
            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => setAbierto(false)}>Cancelar</button>
              <button
                type="submit"
                className="dialogo-btn principal"
                disabled={!form.symbol.trim() || !form.quantity}
              >Agregar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/* -------------------------------------------------------------------- app */

export default function App() {
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('home')
  const [dashboard, setDashboard] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [subs, setSubs] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [goals, setGoals] = useState([])
  const [budgets, setBudgets] = useState([])
  const [networth, setNetworth] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [progreso, setProgreso] = useState(null)
  const [pnl, setPnl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [toast, setToast] = useState(null)
  const { confirmar } = useDialogos()
  const [alertas, setAlertas] = useState(null)
  const [cards, setCards] = useState([])
  const [proximasCuotas, setProximasCuotas] = useState([])
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  // Los botones del encabezado viven acá (el encabezado es de App), pero los
  // formularios viven en cada pantalla. Guardamos la última acción pedida;
  // cambia de identidad en cada click para que la pantalla la note.
  const [accion, setAccion] = useState(null)
  const pedir = (pantalla, tipo) => () => setAccion({ pantalla, tipo, n: Date.now() })
  // Cada pantalla solo mira las suyas.
  const accionDe = (pantalla) => (accion && accion.pantalla === pantalla ? accion : null)

  /*
   * Cambiar de pantalla limpia la acción pendiente.
   *
   * Sin esto, la acción quedaba guardada para siempre: entrabas a Gastos
   * fijos, abrías el formulario, lo cerrabas, y la próxima vez que volvías a
   * la pantalla el modal se abría solo, porque al montarse veía la acción
   * vieja. Hay que limpiarla ANTES de cambiar de pestaña, no en un efecto:
   * los efectos de los hijos corren antes que los del padre, así que la
   * pantalla alcanzaría a ver el valor viejo igual.
   */
  const irA = (destino) => {
    setAccion(null)
    setTab(destino)
  }

  // Controles de la barra de arriba, como en el diseño.
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [moneda, setMoneda] = useState('ars')
  const [oculto, setOculto] = useState(false)
  // El tema arranca siguiendo al sistema; si lo tocás, queda guardado.
  const [tema, setTema] = useState(() => {
    const guardado = localStorage.getItem('tema')
    if (guardado) return guardado
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // No se puede navegar al futuro: el mes de hoy es el tope.
  const mesTope = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem('tema', tema)
  }, [tema])

  const notify = useCallback((message, type = 'ok') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2600)
  }, [])

  // El mes vive en una referencia además del estado: así loadCore no cambia
  // de identidad al cambiar de mes y no se vuelve a pedir /me al pedo.
  const mesRef = useRef(mes)
  useEffect(() => { mesRef.current = mes }, [mes])

  // El mes elegido en la barra de arriba manda: el dashboard se pide por mes.
  const loadCore = useCallback(async () => {
    const [d, t, u] = await Promise.all([
      api(`/dashboard?month=${mesRef.current}`),
      api('/transactions'),
      api('/fixed/upcoming').catch(() => []),
    ])
    setDashboard(d)
    setTransactions(t)
    setUpcoming(u)
    // El patrimonio depende de cotizaciones, asi que no bloquea el resto.
    api('/networth').then(setNetworth).catch(() => {})
    api('/progreso').then(setProgreso).catch(() => {})
  }, [])

  const loadMetas = useCallback(async () => {
    const [g, b] = await Promise.all([api('/goals'), api('/budgets')])
    setGoals(g)
    setBudgets(b)
  }, [])

  /** Arma el objeto de configuración a partir de la respuesta de /me. */
  const aplicarSesion = useCallback((me) => {
    setConfig({
      displayName: me.user.displayName,
      username: me.user.username,
      isAdmin: me.user.isAdmin,
      categories: me.categories,
      appName: me.appName,
      ai: me.ai,
      prices: me.prices,
      telegram: me.telegram,
    })
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const me = await api('/me')
        if (!alive) return
        if (!me.authenticated) {
          setConfig(null)
          setNeedsSetup(Boolean(me.needsSetup))
          return
        }
        setNeedsSetup(false)
        aplicarSesion(me)
        await loadCore()
      } catch (err) {
        notify(err.message, 'error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [loadCore, notify, aplicarSesion])

  const handleLogged = useCallback(async () => {
    setLoading(true)
    try {
      const me = await api('/me')
      aplicarSesion(me)
      await loadCore()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [aplicarSesion, loadCore, notify])

  const handleLogout = useCallback(async () => {
    try { await api('/logout', { method: 'POST' }) } catch { /* igual salimos */ }
    setConfig(null)
    setDashboard(null)
    setTransactions([])
    setGoals([])
    setBudgets([])
    setNetworth(null)
    setUpcoming([])
    setTab('home')
  }, [])

  useEffect(() => {
    if (!config) return
    if (tab === 'metas') loadMetas().catch(() => {})
    if (tab === 'arbol') api('/progreso').then(setProgreso).catch(() => {})
    if (tab === 'pnl') api('/pnl').then(setPnl).catch(() => {})
    if (tab === 'presu') loadMetas().catch(() => {})
    if (tab === 'subs') api('/subscriptions').then(setSubs).catch(() => {})
    if (tab === 'invest') api('/portfolio').then(setPortfolio).catch(() => {})
    if (tab === 'alertas') api('/alertas').then((r) => setAlertas(r.alertas)).catch(() => {})
    if (tab === 'tarjetas' || tab === 'movs') api('/cards').then(setCards).catch(() => {})
    if (tab === 'tarjetas') api('/cuotas').then((r) => setProximasCuotas(r.meses)).catch(() => {})
  }, [tab, config, loadMetas])

  // Cambiar de mes en la barra de arriba vuelve a pedir los datos del mes.
  useEffect(() => {
    if (!config) return
    loadCore().catch(() => {})
  }, [mes, config, loadCore])

  /*
   * Refrescar cuando volvés a la pestaña.
   *
   * Los datos también cambian por fuera del navegador: si le pedís a Manguito
   * por Telegram que borre las últimas transacciones, se borran de la base al
   * instante, pero esta pantalla ya cargada no se entera y las sigue
   * mostrando. Parecía que el bot no había hecho nada.
   *
   * Cada vez que la pestaña vuelve a estar visible volvemos a pedir los datos.
   */
  useEffect(() => {
    if (!config) return

    function alVolver() {
      if (document.visibilityState !== 'visible') return
      loadCore().catch(() => {})
      // Lo que se carga por pantalla también puede haber cambiado.
      if (tab === 'metas' || tab === 'presu') loadMetas().catch(() => {})
      if (tab === 'arbol') api('/progreso').then(setProgreso).catch(() => {})
      if (tab === 'alertas') api('/alertas').then((r) => setAlertas(r.alertas)).catch(() => {})
      if (tab === 'pnl') api('/pnl').then(setPnl).catch(() => {})
      if (tab === 'tarjetas') api('/cards').then(setCards).catch(() => {})
    }

    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [config, tab, loadCore, loadMetas])

  const reloadSubs = useCallback(() => { api('/subscriptions').then(setSubs).catch(() => {}) }, [])
  const reloadPortfolio = useCallback(() => { api('/portfolio').then(setPortfolio).catch(() => {}) }, [])

  async function handleSaved(message) {
    notify(message)
    setNuevoAbierto(false)
    await loadCore()
    // Nos quedamos donde estábamos: antes te tiraba al Resumen aunque
    // estuvieras cargando varios seguidos.
    api('/cards').then(setCards).catch(() => {})
  }

  // Corregir la categoria de un movimiento ya cargado. Manguito adivina bien
  // casi siempre, pero cuando no, hay que poder arreglarlo sin borrar y cargar
  // de nuevo.
  async function handleRecategorizar(tx, categoria) {
    try {
      await api(`/transactions/${tx.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ category: categoria }),
      })
      notify(`Ahora va en ${categoria}. La próxima me lo acuerdo.`)
      await loadCore()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  // Con qué tarjeta se pagó un movimiento. null = ninguna.
  async function handleAsignarTarjeta(tx, cardId) {
    try {
      await api(`/transactions/${tx.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ card_id: cardId }),
      })
      const c = cards.find((x) => x.id === cardId)
      notify(c ? `Va con ${c.name}` : 'Sin tarjeta')
      await loadCore()
      api('/cards').then(setCards).catch(() => {})
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  async function handleDelete(tx) {
    // Si es una cuota, borrar solo esa dejaría el plan cojo: preguntamos.
    const esCuota = tx.installment_total > 1
    const ok = await confirmar({
      titulo: esCuota ? '¿Borrar todo el plan de cuotas?' : '¿Borrar este movimiento?',
      detalle: esCuota
        ? `${tx.description} · se borran las ${tx.installment_total} cuotas, no solo esta.`
        : `${tx.description} · ${money(tx.amount)}`,
      aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/transactions/${tx.id}${tx.installment_total > 1 ? '?plan=1' : ''}`, { method: 'DELETE' })
      notify('Borrado')
      await loadCore()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  if (loading) {
    return <div className="app"><div className="spinner" /></div>
  }

  // Primer arranque: no hay ningún usuario todavía.
  if (!config && needsSetup) return <Setup onReady={handleLogged} />

  // Sin sesión no se ve nada más que el login.
  if (!config) return <Login onLogged={handleLogged} />


  // Los grupos y el orden son los del diseño: primero el panorama, después
  // el día a día, y al final lo de crecer.
  //
  // Antes había un "modo simple" con menos secciones. Se saco: terminaba
  // escondiendo cosas que la persona necesitaba (Tarjetas, sin ir mas lejos)
  // y no habia forma de darse cuenta de por que no aparecian. Todos ven todo.
  const grupos = [
    { titulo: null, items: [
      { id: 'home', label: 'Resumen', icon: '◉' },
      { id: 'patrimonio', label: 'Patrimonio', icon: '▦' },
      { id: 'alertas', label: 'Alertas', icon: '◊' },
    ] },
    { titulo: 'Día a día', items: [
      { id: 'movs', label: 'Movimientos', icon: '⇄' },
      { id: 'gastos', label: 'Gastos', icon: '◔' },
      { id: 'subs', label: 'Gastos fijos', icon: '⟲' },
      { id: 'tarjetas', label: 'Tarjetas', icon: '▭' },
      { id: 'presu', label: 'Presupuestos', icon: '◑' },
      { id: 'pnl', label: 'P&L', icon: '⌁' },
    ] },
    { titulo: 'Crecer', items: [
      { id: 'metas', label: 'Metas', icon: '◎' },
      { id: 'invest', label: 'Inversiones', icon: '↗' },
      { id: 'arbol', label: 'Árbol', icon: '🌳' },
    ] },
    { titulo: null, items: [{ id: 'ajustes', label: 'Ajustes', icon: '⚙' }] },
  ]

  // En el celular no entran todas las secciones abajo: van las cinco de
  // siempre y el resto vive en "Más".
  const principales = [
    { id: 'home', label: 'Resumen', icon: '◉' },
    { id: 'nuevo', label: 'Agregar', icon: '＋' },
    { id: 'movs', label: 'Movimientos', icon: '⇄' },
    { id: 'arbol', label: 'Árbol', icon: '🌳' },
    { id: 'mas', label: 'Más', icon: '☰' },
  ]

  // Antes de dibujar nada, dejamos configurado en qué moneda se muestran los
  // montos. Va acá y no en un efecto: si esperáramos al efecto, el primer
  // dibujo saldría en la moneda anterior y se vería el salto.
  configurarMoneda(moneda, networth ? networth.dolar : 0)

  const exportar = () => { window.location.href = '/api/export' }

  // Compartir usa el menú nativo del celular; en escritorio no existe, así que
  // copiamos un resumen al portapapeles y avisamos.
  const compartir = async () => {
    if (!dashboard) return
    const texto = `Mi ${mesLargo(mes)}: entró ${money(dashboard.income)}, ` +
      `salió ${money(dashboard.expense)}, quedan ${money(dashboard.income - dashboard.expense)}.`
    try {
      if (navigator.share) await navigator.share({ text: texto })
      else { await navigator.clipboard.writeText(texto); notify('Copiado al portapapeles') }
    } catch { /* si lo cancela, no pasa nada */ }
  }

  // Título, bajada y botones de cada pantalla, igual que en el diseño.
  const META = {
    home: ['Resumen', 'Cómo venís este mes, de un vistazo', [{ txt: 'Exportar', go: exportar }, { txt: 'Compartir', go: compartir }]],
    patrimonio: ['Patrimonio', 'Pesos e inversiones, todo junto', []],
    alertas: ['Alertas', 'Lo que conviene que mires ahora', []],
    movs: ['Movimientos', `${transactions.length} anotados en total`, [{ txt: 'Exportar', go: exportar }]],
    gastos: ['Gastos', 'En qué se te va la plata', []],
    subs: ['Gastos fijos', 'Lo que se repite todos los meses', [
      { txt: '+ Nuevo gasto fijo', tono: 'acento', go: pedir('subs', 'nuevo') },
    ]],
    tarjetas: ['Tarjetas', 'Cierres, vencimientos y consumo del resumen', [
      { txt: '+ Nueva tarjeta', tono: 'acento', go: pedir('tarjetas', 'nuevo') },
    ]],
    presu: ['Presupuestos', 'Un tope por categoría y cuánto llevás', [
      { txt: 'Sugerir topes', go: pedir('presu', 'sugerir') },
      { txt: '+ Nuevo presupuesto', tono: 'acento', go: pedir('presu', 'nuevo') },
    ]],
    pnl: ['P&L', 'Ingresos, egresos y ahorro mes por mes', [{ txt: 'Exportar', go: exportar }]],
    metas: ['Metas', 'Repartí tu ahorro hacia lo que querés', [
      { txt: '+ Nueva meta', tono: 'acento', go: pedir('metas', 'nuevo') },
    ]],
    invest: ['Inversiones', 'Tu portfolio a precio de mercado', [
      { txt: '+ Agregar activo', tono: 'acento', go: pedir('invest', 'nuevo') },
    ]],
    arbol: ['Tu árbol', 'Crece cuando anotás y cumplís tus metas', []],
    ajustes: ['Ajustes', 'Tu cuenta, Telegram y respaldo', []],
    mas: ['Más', 'Todas las secciones', []],
  }
  const meta = META[tab] || ['', '', []]

  // Lo que muestra la tarjeta de ahorro de la barra lateral.
  const ahorro = dashboard
    ? { monto: dashboard.income - dashboard.expense, ingresos: dashboard.income }
    : null

  return (
    <div className={`layout ${oculto ? 'oculto' : ''}`}>
      <Lateral
        marca={config.appName || 'Manguito'}
        grupos={grupos}
        tab={tab}
        onGo={irA}
        onNuevo={() => setNuevoAbierto(true)}
        ahorro={ahorro}
        usuario={{ nombre: config.displayName, sub: `@${config.username}` }}
      />

      <div className="columna">
        <Topbar
          moneda={moneda}
          onMoneda={setMoneda}
          mes={mes}
          onMes={setMes}
          mesTope={mesTope}
          dolar={networth ? networth.dolar : 0}
          dolarNombre={networth ? networth.dolarNombre : ''}
          tema={tema}
          onTema={() => setTema(tema === 'dark' ? 'light' : 'dark')}
          oculto={oculto}
          onOculto={() => setOculto(!oculto)}
        />

        <main className="contenido" key={tab}>
          <PaginaHead titulo={meta[0]} bajada={meta[1]} acciones={meta[2]} />

          {tab === 'home' && (
            <ResumenScreen
              dashboard={dashboard}
              transactions={transactions}
              mes={mes}
              onGo={irA}
              config={config}
            />
          )}
          {tab === 'patrimonio' && <PatrimonioScreen networth={networth} />}
          {tab === 'alertas' && <AlertasScreen alertas={alertas} />}
          {tab === 'gastos' && <GastosScreen dashboard={dashboard} />}
          {tab === 'tarjetas' && (
            <TarjetasScreen
              cards={cards}
              proximas={proximasCuotas}
              accion={accionDe('tarjetas')}
              onReload={() => {
                api('/cards').then(setCards).catch(() => {})
                api('/cuotas').then((r) => setProximasCuotas(r.meses)).catch(() => {})
                loadCore().catch(() => {})
              }}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'metas' && (
            <MetasScreen
              goals={goals}
              accion={accionDe('metas')}
              onReload={() => { loadMetas().catch(() => {}); loadCore().catch(() => {}) }}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'movs' && (
            <MovementsScreen
              transactions={transactions}
              categories={config.categories}
              cards={cards}
              onDelete={handleDelete}
              onRecategorizar={handleRecategorizar}
              onAsignarTarjeta={handleAsignarTarjeta}
              loading={false}
            />
          )}
          {tab === 'subs' && (
            <SubsScreen
              subs={subs}
              accion={accionDe('subs')}
              onReload={reloadSubs}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'mas' && <MenuScreen grupos={grupos} actual={tab} onGo={irA} />}
          {tab === 'pnl' && <PnlScreen pnl={pnl} />}
          {tab === 'presu' && (
            <PresupuestosScreen
              budgets={budgets}
              categories={config.categories}
              ingresoDelMes={dashboard ? dashboard.income : 0}
              mes={mes}
              accion={accionDe('presu')}
              onReload={() => { loadMetas().catch(() => {}); loadCore().catch(() => {}) }}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'arbol' && (
            <ArbolScreen progreso={progreso} onReload={() => api('/progreso').then(setProgreso).catch(() => {})} />
          )}
          {tab === 'ajustes' && (
            <AjustesScreen
              config={config}
              onDatosCambiados={() => loadCore().catch(() => {})}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
              onLogout={handleLogout}
            />
          )}
          {tab === 'invest' && (
            <InvestScreen
              portfolio={portfolio}
              accion={accionDe('invest')}
              onReload={reloadPortfolio}
              onError={(m) => notify(m, 'error')}
            />
          )}
        </main>
      </div>

      <nav className="nav nav-cel">
        {principales.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id || (t.id === 'mas' && !principales.some((x) => x.id === tab)) ? 'page' : undefined}
            onClick={() => (t.id === 'nuevo' ? setNuevoAbierto(true) : irA(t.id))}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {nuevoAbierto && (
        <NuevoMovimiento
          config={config}
          categories={config.categories}
          monedaPorDefecto={moneda}
          dolar={networth ? networth.dolar : 0}
          onSaved={handleSaved}
          onError={(m) => notify(m, 'error')}
          onCerrar={() => setNuevoAbierto(false)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
