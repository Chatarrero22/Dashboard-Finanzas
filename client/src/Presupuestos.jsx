import { useState } from 'react'
import { api, money, Empty, BudgetList } from './comunes.jsx'

export default function PresupuestosScreen({ budgets, categories, onReload, onError, onSaved }) {
  const [form, setForm] = useState({ category: '', monthly_limit: '' })
  const [sug, setSug] = useState(null)
  const [cargandoSug, setCargandoSug] = useState(false)

  async function pedirSugerencias() {
    setCargandoSug(true)
    try {
      setSug(await api('/budgets/suggest'))
    } catch (err) {
      onError(err.message)
    } finally {
      setCargandoSug(false)
    }
  }

  async function aplicar(lista) {
    try {
      await api('/budgets/suggest/apply', {
        method: 'POST',
        body: JSON.stringify({ propuestas: lista }),
      })
      setSug(null)
      onSaved(lista.length === 1 ? 'Presupuesto guardado' : `${lista.length} presupuestos guardados`)
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.category || !form.monthly_limit) return onError('Elegí la categoría y el monto')
    try {
      await api('/budgets', {
        method: 'POST',
        body: JSON.stringify({ category: form.category, monthly_limit: Number(form.monthly_limit) }),
      })
      setForm({ category: '', monthly_limit: '' })
      onSaved('Presupuesto guardado')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function borrar(b) {
    if (!confirm(`¿Sacar el presupuesto de ${b.category}?`)) return
    try {
      await api(`/budgets/${b.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  const totalTope = budgets.reduce((a, b) => a + b.monthly_limit, 0)
  const totalGastado = budgets.reduce((a, b) => a + b.spent, 0)

  return (
    <>
      {budgets.length > 0 && (
        <div className="hero">
          <div className="label">Llevás gastado</div>
          <div className="value">{money(totalGastado)}</div>
          <div className="caption">
            de {money(totalTope)} presupuestados · te quedan {money(totalTope - totalGastado)}
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-title-row">
          <h2>Tus topes</h2>
          {budgets.length > 0 && <span className="tag">{budgets.length}</span>}
        </div>
        {budgets.length === 0 ? (
          <Empty icon="◑" text="Sin topes todavía. Poné uno y te aviso cuando te acerques." />
        ) : (
          <>
            <BudgetList budgets={budgets} />
            <div className="chips" style={{ marginTop: 14 }}>
              {budgets.map((b) => (
                <button key={b.id} className="chip" onClick={() => borrar(b)}>✕ {b.category}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Que los arme Manguito</h2>
          <button className="chip" onClick={pedirSugerencias} disabled={cargandoSug}>
            {cargandoSug ? 'Mirando…' : 'Calcular'}
          </button>
        </div>
        <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Miro lo que gastaste los últimos meses y propongo un tope por categoría.
        </p>

        {sug && !sug.hayHistorial && <p className="hint">{sug.mensaje}</p>}

        {sug?.propuestas?.length > 0 && (
          <>
            <div style={{ marginTop: 14 }}>
              {sug.propuestas.map((p) => (
                <div className="sugerencia" key={p.category}>
                  <span className="cat">
                    {p.category}
                    {p.yaTiene && <span className="tag" style={{ marginLeft: 8 }}>ya tenés</span>}
                  </span>
                  <span className="num">
                    {money(p.sugerido)}
                    <small>promedio {money(p.promedio)}</small>
                  </span>
                  <button className="chip" onClick={() => aplicar([p])}>Usar</button>
                </div>
              ))}
            </div>
            <button className="primary" style={{ marginTop: 14 }} onClick={() => aplicar(sug.propuestas)}>
              Usar los {sug.propuestas.length}
            </button>
          </>
        )}
      </section>

      <form className="card" onSubmit={guardar}>
        <h2>Poner uno a mano</h2>
        <div className="row-2">
          <label className="field">
            <span className="field-label">Categoría</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Elegí…</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Máximo por mes</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={form.monthly_limit}
              onChange={(e) => setForm({ ...form, monthly_limit: e.target.value.replace(/[^\d.]/g, '') })}
            />
          </label>
        </div>
        <button className="primary" type="submit">Guardar tope</button>
      </form>
    </>
  )
}
