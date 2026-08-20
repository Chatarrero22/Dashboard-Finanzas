/**
 * Presupuestos, con la estructura del diseño: la banda que explica sobre qué
 * se calculan los porcentajes y abajo las tarjetas de dos en dos.
 *
 * Los botones de arriba ("Sugerir topes" y "+ Nuevo presupuesto") viven en el
 * encabezado de la pantalla, así que App los dispara pasando `accion`.
 */
import { useEffect, useState } from 'react'
import { api, money, mesNombre, icono, Empty, montoDesde, soloPlata } from './comunes.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'

/** Una tarjeta de presupuesto. */
function Tarjeta({ b, onBorrar }) {
  const pct = Math.round(b.pct)
  const tono = b.status === 'pasado' ? 'mal' : b.status === 'cerca' ? 'ojo' : 'bien'

  return (
    <div className={`presu ${tono}`}>
      <div className="presu-head">
        <span className="presu-ico">{icono(b.category)}</span>
        <span className="presu-nombre">{b.category}</span>
        <span className="presu-pct">{pct}%</span>
        <button
          className="presu-borrar"
          onClick={() => onBorrar(b)}
          aria-label={`Sacar el presupuesto de ${b.category}`}
          title="Sacar este tope"
        >✕</button>
      </div>

      <div
        className="presu-track"
        role="img"
        aria-label={`${b.category}: gastaste ${money(b.spent)} de ${money(b.monthly_limit)}`}
      >
        <div className="presu-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>

      <div className="presu-pie">
        <span className="presu-cuanto monto-sensible">
          {money(b.spent)} de {money(b.monthly_limit)}
        </span>
        <span className="presu-estado monto-sensible">
          {b.status === 'pasado'
            ? `Te pasaste ${money(Math.abs(b.remaining))}`
            : `Quedan ${money(b.remaining)}`}
        </span>
      </div>
    </div>
  )
}

export default function PresupuestosScreen({
  budgets, categories, ingresoDelMes, mes, accion, onReload, onError, onSaved,
}) {
  const { confirmar } = useDialogos()
  const [form, setForm] = useState({ category: '', monthly_limit: '' })
  const [abierto, setAbierto] = useState(false)
  const [sug, setSug] = useState(null)
  const [cargandoSug, setCargandoSug] = useState(false)

  // Los botones del encabezado viven en App: llegan como `accion`, que cambia
  // de identidad en cada click para que este efecto se vuelva a disparar.
  useEffect(() => {
    if (!accion) return
    if (accion.tipo === 'nuevo') { setAbierto(true); setSug(null) }
    if (accion.tipo === 'sugerir') pedirSugerencias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion])

  async function pedirSugerencias() {
    setCargandoSug(true)
    setAbierto(false)
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
        body: JSON.stringify({ category: form.category, monthly_limit: montoDesde(form.monthly_limit) }),
      })
      setForm({ category: '', monthly_limit: '' })
      setAbierto(false)
      onSaved('Presupuesto guardado')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function borrar(b) {
    const ok = await confirmar({
      titulo: `¿Sacar el tope de ${b.category}?`,
      detalle: 'El presupuesto desaparece, pero los gastos quedan.',
      aceptar: 'Sacarlo', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/budgets/${b.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  const totalTope = budgets.reduce((a, b) => a + b.monthly_limit, 0)
  const totalGastado = budgets.reduce((a, b) => a + b.spent, 0)
  const hayIngreso = ingresoDelMes > 0

  return (
    <>
      {/* La banda del diseño: sobre qué se están midiendo los porcentajes */}
      <div className="banda">
        <span>Los porcentajes se calculan sobre</span>
        <span className="banda-chip">el ingreso de este mes</span>
        <strong className="banda-monto monto-sensible">{money(ingresoDelMes || 0)}</strong>
        <span className="banda-nota">
          {hayIngreso
            ? `— sobre ${money(totalTope)} en topes llevás ${money(totalGastado)}.`
            : `— sin ingresos en ${mesNombre(mes)}, los topes quedan en monto fijo.`}
        </span>
      </div>

      {/* El alta a mano abre un pop-up, no se despliega abajo */}
      {abierto && (
        <Modal
          titulo="Nuevo presupuesto"
          detalle={`Un tope de gasto por categoría para ${mesNombre(mes)}.`}
          onCerrar={() => setAbierto(false)}
        >
          <form onSubmit={guardar}>
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
                onChange={(e) => setForm({ ...form, monthly_limit: soloPlata(e.target.value) })}
              />
            </label>
            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => setAbierto(false)}>Cancelar</button>
              <button
                type="submit"
                className="dialogo-btn principal"
                disabled={!form.category || !form.monthly_limit}
              >Guardar tope</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sugerencias de Manguito */}
      {cargandoSug && <div className="card"><div className="spinner" /></div>}

      {sug && !sug.hayHistorial && (
        <div className="card"><p className="hint" style={{ margin: 0 }}>{sug.mensaje}</p></div>
      )}

      {sug?.propuestas?.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2>Lo que propone Manguito</h2>
            <button className="chip" onClick={() => setSug(null)}>Cerrar</button>
          </div>
          <p className="hint">Miré lo que gastaste los últimos meses.</p>
          <div style={{ marginTop: 12 }}>
            {sug.propuestas.map((p) => (
              <div className="sugerencia" key={p.category}>
                <span className="cat">
                  {p.category}
                  {p.yaTiene && <span className="tag" style={{ marginLeft: 8 }}>ya tenés</span>}
                </span>
                <span className="num monto-sensible">
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
        </section>
      )}

      {/* Las tarjetas, de a dos */}
      {budgets.length === 0 ? (
        <section className="card">
          <Empty
            icon="◑"
            text="Sin topes todavía. Poné uno con el botón de arriba y te aviso cuando te acerques."
          />
        </section>
      ) : (
        <div className="presu-grid">
          {budgets.map((b) => <Tarjeta key={b.id} b={b} onBorrar={borrar} />)}
        </div>
      )}
    </>
  )
}
