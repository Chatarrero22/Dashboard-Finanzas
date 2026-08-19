/**
 * Tarjetas de crédito: cuánto llevás gastado en el resumen que está abierto,
 * cuándo cierra y cuándo vence.
 *
 * El consumo no es "lo del mes calendario": va de un cierre al siguiente, que
 * es como funciona una tarjeta de verdad. El cálculo está en server/tarjetas.js.
 */
import { useEffect, useState } from 'react'
import { api, money, Empty } from './comunes.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'
import Numero from './Numero.jsx'

const COLORES = [
  { nombre: 'Naranja', valor: '#EE8A17' },
  { nombre: 'Azul', valor: '#3B5AA8' },
  { nombre: 'Verde', valor: '#0E8A51' },
  { nombre: 'Rojo', valor: '#C1372F' },
  { nombre: 'Violeta', valor: '#7A5AC9' },
  { nombre: 'Gris', valor: '#6B5634' },
]

const VACIA = { name: '', last4: '', color: COLORES[0].valor, limit_amount: '', close_day: '1', due_day: '10' }

function Tarjeta({ t, onEditar, onBorrar }) {
  const pct = t.pct == null ? null : Math.min(t.pct, 100)

  return (
    <div className="tarjeta">
      <div className="tarjeta-brillo" style={{ background: `radial-gradient(circle at 50% 50%, ${t.color}, transparent 65%)` }} />
      <div className="tarjeta-cuerpo">
        <div className="tarjeta-head">
          <div>
            <div className="tarjeta-nombre">{t.name}</div>
            {t.last4 && <div className="tarjeta-num">•••• {t.last4}</div>}
          </div>
          <div className="tarjeta-acciones">
            <button className="chip" onClick={() => onEditar(t)}>Editar</button>
            <span className="tarjeta-chip" style={{ background: t.color }} />
          </div>
        </div>

        <div>
          <div className="tarjeta-label">Consumo del resumen</div>
          <Numero className="tarjeta-consumo monto-sensible" valor={t.consumo} />

          <div className="tarjeta-track">
            <div
              className="tarjeta-fill"
              style={{ width: `${pct == null ? 0 : pct}%`, background: t.color }}
            />
          </div>
          <div className="tarjeta-pie">
            <span>
              {pct == null ? 'Sin límite cargado' : `${Math.round(t.pct)}% del límite`}
            </span>
            {t.limit_amount > 0 && (
              <span className="monto-sensible">Límite {money(t.limit_amount)}</span>
            )}
          </div>
        </div>

        <div className="tarjeta-fechas">
          <div className="tarjeta-fecha">
            <div className="tarjeta-fecha-label">CIERRE</div>
            <div className="tarjeta-fecha-valor">{t.cierraTexto}</div>
            <div className="tarjeta-fecha-sub">
              {t.diasParaCerrar === 0 ? 'es hoy' : `en ${t.diasParaCerrar} ${t.diasParaCerrar === 1 ? 'día' : 'días'}`}
            </div>
          </div>
          <div className="tarjeta-fecha">
            <div className="tarjeta-fecha-label">VENCE</div>
            <div className="tarjeta-fecha-valor">{t.venceTexto}</div>
            <div className="tarjeta-fecha-sub">
              {t.movimientos} {t.movimientos === 1 ? 'movimiento' : 'movimientos'}
            </div>
          </div>
        </div>

        <button className="tarjeta-borrar" onClick={() => onBorrar(t)}>Borrar tarjeta</button>
      </div>
    </div>
  )
}

export default function TarjetasScreen({ cards, accion, onReload, onError, onSaved }) {
  const { confirmar } = useDialogos()
  const [form, setForm] = useState(VACIA)
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)

  // El botón "+ Nueva tarjeta" vive en el encabezado, que es de App. App
  // limpia la acción al navegar, así que llegar acá siempre es un click.
  useEffect(() => {
    if (!accion) return
    setEditando(null)
    setForm(VACIA)
    setAbierto(true)
  }, [accion])

  function abrirEditar(t) {
    setEditando(t)
    setForm({
      name: t.name,
      last4: t.last4 || '',
      color: t.color,
      limit_amount: String(t.limit_amount || ''),
      close_day: String(t.close_day),
      due_day: String(t.due_day),
    })
    setAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.name.trim()) return onError('Ponele un nombre a la tarjeta')
    const cuerpo = {
      name: form.name.trim(),
      last4: form.last4,
      color: form.color,
      limit_amount: Number(form.limit_amount) || 0,
      close_day: Number(form.close_day) || 1,
      due_day: Number(form.due_day) || 10,
    }
    try {
      if (editando) await api(`/cards/${editando.id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) })
      else await api('/cards', { method: 'POST', body: JSON.stringify(cuerpo) })
      setAbierto(false)
      setForm(VACIA)
      onSaved(editando ? 'Tarjeta actualizada' : 'Tarjeta agregada')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function borrar(t) {
    const ok = await confirmar({
      titulo: `¿Borrar ${t.name}?`,
      detalle: 'Los movimientos que le habías asignado quedan, solo dejan de estar en esta tarjeta.',
      aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/cards/${t.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      {(!cards || cards.length === 0) ? (
        <section className="card">
          <Empty
            icon="▭"
            text="Todavía no cargaste ninguna tarjeta. Poné una con el botón de arriba y te muestro cuánto llevás gastado en el resumen que está abierto."
          />
        </section>
      ) : (
        <div className="tarjetas-grid">
          {cards.map((t) => (
            <Tarjeta key={t.id} t={t} onEditar={abrirEditar} onBorrar={borrar} />
          ))}
        </div>
      )}

      {abierto && (
        <Modal
          titulo={editando ? 'Editar tarjeta' : 'Nueva tarjeta'}
          detalle="El consumo se calcula de un cierre al siguiente, como en el resumen."
          onCerrar={() => { setAbierto(false); setEditando(null) }}
        >
          <form onSubmit={guardar}>
            <div className="row-2">
              <label className="field">
                <span className="field-label">Nombre</span>
                <input
                  placeholder="Visa Galicia"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Últimos 4 números</span>
                <input
                  inputMode="numeric"
                  placeholder="4417"
                  maxLength={4}
                  value={form.last4}
                  onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '') })}
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">Límite (opcional)</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={form.limit_amount}
                onChange={(e) => setForm({ ...form, limit_amount: e.target.value.replace(/[^\d.]/g, '') })}
              />
            </label>

            <div className="row-2">
              <label className="field">
                <span className="field-label">Día de cierre</span>
                <input
                  inputMode="numeric"
                  value={form.close_day}
                  onChange={(e) => setForm({ ...form, close_day: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </label>
              <label className="field">
                <span className="field-label">Día de vencimiento</span>
                <input
                  inputMode="numeric"
                  value={form.due_day}
                  onChange={(e) => setForm({ ...form, due_day: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </label>
            </div>

            <div className="field">
              <span className="field-label">Color</span>
              <div className="colores">
                {COLORES.map((c) => (
                  <button
                    type="button"
                    key={c.valor}
                    className={`color ${form.color === c.valor ? 'elegido' : ''}`}
                    style={{ background: c.valor }}
                    onClick={() => setForm({ ...form, color: c.valor })}
                    aria-label={c.nombre}
                    title={c.nombre}
                  />
                ))}
              </div>
            </div>

            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => { setAbierto(false); setEditando(null) }}>
                Cancelar
              </button>
              <button type="submit" className="dialogo-btn principal" disabled={!form.name.trim()}>
                {editando ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
