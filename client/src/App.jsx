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
import { Lateral, Topbar, PaginaHead, mesLargo, correrMes } from './Shell.jsx'
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

function BudgetList({ budgets }) {
  return (
    <div>
      {budgets.map((b) => (
        <div className="budget" key={b.id}>
          <div className="budget-head">
            <span className="budget-name">{b.category}</span>
            <span className="budget-nums">{money(b.spent)} / {money(b.monthly_limit)}</span>
          </div>
          <div
            className="budget-track"
            role="img"
            aria-label={`${b.category}: gastaste ${money(b.spent)} de ${money(b.monthly_limit)}`}
          >
            <div
              className={`budget-fill ${b.status}`}
              style={{ width: `${Math.min(b.pct, 100)}%` }}
            />
          </div>
          <div className={`budget-left ${b.status}`}>
            {b.status === 'pasado'
              ? `Te pasaste por ${money(Math.abs(b.remaining))}`
              : `Te quedan ${money(b.remaining)}`}
          </div>
        </div>
      ))}
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

function AddForm({ categories, onSaved, onError }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('gasto')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayISO())
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
          platform: 'Web',
        }),
      })
      setAmount('')
      setDescription('')
      setCategory('')
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
    <form className="card" onSubmit={submit}>
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
        <input
          className="amount-input"
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
        />
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

      <button className="primary" type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {!category && (
        <p className="hint">Si dejás la categoría en automática, la elige sola.</p>
      )}
    </form>
  )
}

/* -------------------------------------------------------------- pantallas */

function AddScreen({ config, categories, onSaved, onError }) {
  return (
    <>
      <AddForm categories={categories} onSaved={onSaved} onError={onError} />
      {config.telegram && (
        <div className="card">
          <h2>Desde el celular</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            También podés escribirle al bot de Telegram “Disco 15400” o mandarle
            la foto de un ticket, y se carga solo.
          </p>
        </div>
      )}
    </>
  )
}

function MovementsScreen({ transactions, onDelete, loading }) {
  const [query, setQuery] = useState('')

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
              <div className="item" key={t.id}>
                <div className="item-main">
                  <div className="item-desc">{t.description}</div>
                  <div className="item-meta">
                    <span>{dayLabel(t.date)}</span>
                    <span className="tag">{t.category}</span>
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
    </>
  )
}

function SubsScreen({ subs, onReload, onError, onSaved }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', billing_day: '1' })

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
    if (!confirm(`¿Borrar ${sub.name}?`)) return
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

      {showForm ? (
        <form className="card" onSubmit={add}>
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
          <button className="primary" type="submit">Agregar</button>
          <button className="ghost" type="button" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowForm(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button className="primary" onClick={() => setShowForm(true)}>+ Agregar suscripción</button>
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

function MetasScreen({ goals, budgets, categories, onReload, onError, onSaved }) {
  const [goalForm, setGoalForm] = useState({ name: '', target: '' })
  const [budgetForm, setBudgetForm] = useState({ category: '', monthly_limit: '' })
  const [celebrating, setCelebrating] = useState(null)

  async function addGoal(e) {
    e.preventDefault()
    if (!goalForm.name.trim() || !goalForm.target) return onError('Falta el nombre o el objetivo')
    try {
      await api('/goals', {
        method: 'POST',
        body: JSON.stringify({ name: goalForm.name.trim(), target: Number(goalForm.target) }),
      })
      setGoalForm({ name: '', target: '' })
      onSaved('Meta creada')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function addToGoal(goal, signo) {
    const texto = prompt(`¿Cuánto querés ${signo > 0 ? 'sumar a' : 'sacar de'} "${goal.name}"?`)
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
    if (!confirm(`¿Borrar la meta "${goal.name}"?`)) return
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function addBudget(e) {
    e.preventDefault()
    if (!budgetForm.category || !budgetForm.monthly_limit) return onError('Elegí la categoría y el monto')
    try {
      await api('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          category: budgetForm.category,
          monthly_limit: Number(budgetForm.monthly_limit),
        }),
      })
      setBudgetForm({ category: '', monthly_limit: '' })
      onSaved('Presupuesto guardado')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function removeBudget(b) {
    if (!confirm(`¿Sacar el presupuesto de ${b.category}?`)) return
    try {
      await api(`/budgets/${b.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <section className="card">
        <h2>Metas de ahorro</h2>
        {goals.length === 0 ? (
          <Empty icon="🎯" text="Poné una meta y mirá cómo sube." />
        ) : (
          <GoalList goals={goals} onAdd={addToGoal} onRemove={removeGoal} celebrating={celebrating} />
        )}
      </section>

      <form className="card" onSubmit={addGoal}>
        <h2>Nueva meta</h2>
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
        <button className="primary" type="submit">Crear meta</button>
      </form>

      <section className="card">
        <h2>Presupuestos del mes</h2>
        {budgets.length === 0 ? (
          <Empty icon="🎛️" text="Poné un tope por categoría y te aviso cuando te acerques." />
        ) : (
          <>
            <BudgetList budgets={budgets} />
            <div className="chips" style={{ marginTop: 14 }}>
              {budgets.map((b) => (
                <button key={b.id} className="chip" onClick={() => removeBudget(b)}>
                  ✕ {b.category}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <form className="card" onSubmit={addBudget}>
        <h2>Poner un tope</h2>
        <div className="row-2">
          <label className="field">
            <span className="field-label">Categoría</span>
            <select
              value={budgetForm.category}
              onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
            >
              <option value="">Elegí…</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Máximo por mes</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={budgetForm.monthly_limit}
              onChange={(e) =>
                setBudgetForm({ ...budgetForm, monthly_limit: e.target.value.replace(/[^\d.]/g, '') })
              }
            />
          </label>
        </div>
        <button className="primary" type="submit">Guardar tope</button>
      </form>
    </>
  )
}

function AjustesScreen({ config, onError, onSaved, onLogout }) {
  const [code, setCode] = useState(null)
  const [pass, setPass] = useState('')
  const [users, setUsers] = useState(null)
  const [nuevo, setNuevo] = useState({ username: '', display_name: '', password: '', simple_ui: true })

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
      setNuevo({ username: '', display_name: '', password: '', simple_ui: true })
      onSaved('Usuario creado')
      cargarUsuarios()
    } catch (err) { onError(err.message) }
  }

  async function borrarUsuario(u) {
    if (!confirm(`¿Borrar a ${u.display_name} y todos sus datos?`)) return
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
            <label className="field">
              <span className="field-label">¿Versión simple?</span>
              <select
                value={nuevo.simple_ui ? 'si' : 'no'}
                onChange={(e) => setNuevo({ ...nuevo, simple_ui: e.target.value === 'si' })}
              >
                <option value="si">Sí — pantallas justas (recomendado)</option>
                <option value="no">No — todo, con cripto y suscripciones</option>
              </select>
            </label>
            <button className="primary" type="submit">Crear</button>
          </form>
        </>
      )}
    </>
  )
}

function InvestScreen({ portfolio, onError, onReload }) {
  if (!portfolio) return <div className="spinner" />

  const { assets, totalValue, totalPnl, totalPnlPct, pricesAvailable } = portfolio

  async function remove(asset) {
    if (!confirm(`¿Sacar ${asset.symbol} del portfolio?`)) return
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
  const [alertas, setAlertas] = useState(null)

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
      simple: me.user.simpleUi,
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
    if (tab === 'subs' && !config.simple) api('/subscriptions').then(setSubs).catch(() => {})
    if (tab === 'invest' && !config.simple) api('/portfolio').then(setPortfolio).catch(() => {})
    if (tab === 'alertas') api('/alertas').then((r) => setAlertas(r.alertas)).catch(() => {})
  }, [tab, config, loadMetas])

  // Cambiar de mes en la barra de arriba vuelve a pedir los datos del mes.
  useEffect(() => {
    if (!config) return
    loadCore().catch(() => {})
  }, [mes, config, loadCore])

  const reloadSubs = useCallback(() => { api('/subscriptions').then(setSubs).catch(() => {}) }, [])
  const reloadPortfolio = useCallback(() => { api('/portfolio').then(setPortfolio).catch(() => {}) }, [])

  async function handleSaved(message) {
    notify(message)
    await loadCore()
    setTab('home')
  }

  async function handleDelete(tx) {
    if (!confirm(`¿Borrar "${tx.description}"?`)) return
    try {
      await api(`/transactions/${tx.id}`, { method: 'DELETE' })
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
  const grupos = config.simple
    ? [
        { titulo: null, items: [
          { id: 'home', label: 'Resumen', icon: '◉' },
          { id: 'alertas', label: 'Alertas', icon: '◊' },
        ] },
        { titulo: 'Día a día', items: [
          { id: 'movs', label: 'Movimientos', icon: '⇄' },
          { id: 'gastos', label: 'Gastos', icon: '◔' },
          { id: 'presu', label: 'Presupuestos', icon: '◑' },
        ] },
        { titulo: 'Crecer', items: [
          { id: 'metas', label: 'Metas', icon: '◎' },
          { id: 'arbol', label: 'Árbol', icon: '🌳' },
        ] },
        { titulo: null, items: [{ id: 'ajustes', label: 'Ajustes', icon: '⚙' }] },
      ]
    : [
        { titulo: null, items: [
          { id: 'home', label: 'Resumen', icon: '◉' },
          { id: 'patrimonio', label: 'Patrimonio', icon: '▦' },
          { id: 'alertas', label: 'Alertas', icon: '◊' },
        ] },
        { titulo: 'Día a día', items: [
          { id: 'movs', label: 'Movimientos', icon: '⇄' },
          { id: 'gastos', label: 'Gastos', icon: '◔' },
          { id: 'subs', label: 'Gastos fijos', icon: '⟲' },
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
    { id: 'add', label: 'Agregar', icon: '＋' },
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
    subs: ['Gastos fijos', 'Lo que se repite todos los meses', []],
    presu: ['Presupuestos', 'Un tope por categoría y cuánto llevás', []],
    pnl: ['P&L', 'Ingresos, egresos y ahorro mes por mes', [{ txt: 'Exportar', go: exportar }]],
    metas: ['Metas', 'Repartí tu ahorro hacia lo que querés', []],
    invest: ['Inversiones', 'Tu portfolio a precio de mercado', []],
    arbol: ['Tu árbol', 'Crece cuando anotás y cumplís tus metas', []],
    ajustes: ['Ajustes', 'Tu cuenta, Telegram y respaldo', []],
    add: ['Nuevo movimiento', 'Anotá un gasto o un ingreso', []],
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
        onGo={setTab}
        onNuevo={() => setTab('add')}
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
              onGo={setTab}
              config={config}
            />
          )}
          {tab === 'patrimonio' && <PatrimonioScreen networth={networth} />}
          {tab === 'alertas' && <AlertasScreen alertas={alertas} />}
          {tab === 'gastos' && <GastosScreen dashboard={dashboard} />}
          {tab === 'metas' && (
            <MetasScreen
              goals={goals}
              budgets={budgets}
              categories={config.categories}
              onReload={() => { loadMetas().catch(() => {}); loadCore().catch(() => {}) }}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'add' && (
            <AddScreen
              config={config}
              categories={config.categories}
              onSaved={handleSaved}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'movs' && (
            <MovementsScreen transactions={transactions} onDelete={handleDelete} loading={false} />
          )}
          {tab === 'subs' && (
            <SubsScreen
              subs={subs}
              onReload={reloadSubs}
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
            />
          )}
          {tab === 'mas' && <MenuScreen grupos={grupos} actual={tab} onGo={setTab} />}
          {tab === 'pnl' && <PnlScreen pnl={pnl} />}
          {tab === 'presu' && (
            <PresupuestosScreen
              budgets={budgets}
              categories={config.categories}
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
              onSaved={notify}
              onError={(m) => notify(m, 'error')}
              onLogout={handleLogout}
            />
          )}
          {tab === 'invest' && (
            <InvestScreen
              portfolio={portfolio}
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
            onClick={() => setTab(t.id)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
