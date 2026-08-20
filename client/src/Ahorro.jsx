/**
 * Ahorro: dónde está tu plata y cómo moverla de un lugar a otro.
 *
 * La app sabía cuánta plata tenías, pero no dónde. Acá se ve repartida entre
 * lo que está para gastar, lo apartado y lo puesto a rendir.
 *
 * Mover plata entre cuentas NO es un gasto: no ganaste ni gastaste nada,
 * cambiaste la plata de lugar. Por eso no aparece en tus gastos del mes.
 */
import { useEffect, useState } from 'react'
import { api, money, Empty, montoDesde, soloPlata } from './comunes.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'
import Numero from './Numero.jsx'

const TIPOS = [
  { id: 'gasto', nombre: 'Para gastar', ayuda: 'De acá sale el día a día', icono: '👛' },
  { id: 'ahorro', nombre: 'Ahorro', ayuda: 'Apartada, no la tocás', icono: '🏦' },
  { id: 'inversion', nombre: 'Invertido', ayuda: 'Puesta a rendir', icono: '📈' },
]

const COLORES = ['#EE8A17', '#3B5AA8', '#0E8A51', '#7A5AC9', '#C1372F', '#6B5634']
const VACIA = { name: '', tipo: 'ahorro', color: COLORES[1] }

function tipoDe(id) {
  return TIPOS.find((t) => t.id === id) || TIPOS[0]
}

export default function AhorroScreen({ cuentas, accion, onReload, onError, onSaved }) {
  const { confirmar } = useDialogos()
  const [form, setForm] = useState(VACIA)
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [moviendo, setMoviendo] = useState(null)

  useEffect(() => {
    if (!accion) return
    setEditando(null)
    setForm(VACIA)
    setAbierto(true)
  }, [accion])

  const lista = cuentas || []
  const total = lista.reduce((a, c) => a + c.saldo, 0)
  const porTipo = (id) => lista.filter((c) => c.tipo === id).reduce((a, c) => a + c.saldo, 0)

  async function guardar(e) {
    e.preventDefault()
    if (!form.name.trim()) return onError('Ponele un nombre a la cuenta')
    try {
      if (editando) await api(`/cuentas/${editando.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      else await api('/cuentas', { method: 'POST', body: JSON.stringify(form) })
      setAbierto(false)
      setEditando(null)
      setForm(VACIA)
      onSaved(editando ? 'Cuenta actualizada' : 'Cuenta creada')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  async function borrar(c) {
    const ok = await confirmar({
      titulo: `¿Borrar ${c.name}?`,
      detalle: 'Los movimientos que tenía pasan a tu cuenta principal. No se borra nada.',
      aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api(`/cuentas/${c.id}`, { method: 'DELETE' })
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <div className="hero">
        <div className="label">Toda tu plata</div>
        <Numero className="value monto-sensible" valor={total} />
        <div className="caption">
          repartida en {lista.length} {lista.length === 1 ? 'cuenta' : 'cuentas'}
        </div>
      </div>

      <div className="kpis kpis-3">
        {TIPOS.map((t) => (
          <div className="kpi" key={t.id}>
            <div className="kpi-label">{t.icono} {t.nombre}</div>
            <Numero className="kpi-valor monto-sensible" valor={porTipo(t.id)} />
            <span className="kpi-sub">{t.ayuda}</span>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-title-row">
          <h2>Tus cuentas</h2>
          {lista.length > 1 && (
            <button className="chip" onClick={() => setMoviendo({ desde: '', hasta: '', monto: '' })}>
              Mover plata
            </button>
          )}
        </div>

        {lista.length === 0 ? (
          <Empty icon="👛" text="Cargando…" />
        ) : (
          <div className="cuentas">
            {lista.map((c) => (
              <div className="cuenta" key={c.id}>
                <span className="cuenta-punto" style={{ background: c.color }} />
                <div className="cuenta-txt">
                  <div className="cuenta-nombre">
                    {c.name}
                    {c.es_default && <span className="tag" style={{ marginLeft: 8 }}>principal</span>}
                  </div>
                  <div className="cuenta-tipo">{tipoDe(c.tipo).icono} {tipoDe(c.tipo).nombre}</div>
                </div>
                <div className={`cuenta-saldo monto-sensible ${c.saldo < 0 ? 'negativo' : ''}`}>
                  {money(c.saldo)}
                </div>
                <button
                  className="chip"
                  onClick={() => {
                    setEditando(c)
                    setForm({ name: c.name, tipo: c.tipo, color: c.color })
                    setAbierto(true)
                  }}
                >Editar</button>
                {!c.es_default && (
                  <button className="danger" aria-label={`Borrar ${c.name}`} onClick={() => borrar(c)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="hint" style={{ marginTop: 14 }}>
          Mover plata entre cuentas no cuenta como gasto: no gastaste nada,
          la cambiaste de lugar.
        </p>
      </section>

      {moviendo && (
        <MoverPlata
          cuentas={lista}
          onCerrar={() => setMoviendo(null)}
          onHecho={(msg) => { setMoviendo(null); onSaved(msg); onReload() }}
          onError={onError}
        />
      )}

      {abierto && (
        <Modal
          titulo={editando ? 'Editar cuenta' : 'Nueva cuenta'}
          detalle="Un lugar donde está tu plata: una caja de ahorro, un plazo fijo, la cuenta de alguien."
          onCerrar={() => { setAbierto(false); setEditando(null) }}
        >
          <form onSubmit={guardar}>
            <label className="field">
              <span className="field-label">Nombre</span>
              <input
                placeholder="Ej: Plazo fijo, La cuenta de Cami"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <div className="field">
              <span className="field-label">¿Qué es?</span>
              <div className="tipos">
                {TIPOS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={`tipo ${form.tipo === t.id ? 'elegido' : ''}`}
                    onClick={() => setForm({ ...form, tipo: t.id })}
                  >
                    <span className="tipo-ico">{t.icono}</span>
                    <span className="tipo-txt">
                      <span className="tipo-nombre">{t.nombre}</span>
                      <small>{t.ayuda}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Color</span>
              <div className="colores">
                {COLORES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color ${form.color === c ? 'elegido' : ''}`}
                    style={{ background: c }}
                    onClick={() => setForm({ ...form, color: c })}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="dialogo-botones">
              <button type="button" className="dialogo-btn" onClick={() => { setAbierto(false); setEditando(null) }}>
                Cancelar
              </button>
              <button type="submit" className="dialogo-btn principal" disabled={!form.name.trim()}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/** El pop-up para pasar plata de una cuenta a otra. */
function MoverPlata({ cuentas, onCerrar, onHecho, onError }) {
  const [desde, setDesde] = useState(cuentas[0]?.id || '')
  const [hasta, setHasta] = useState(cuentas[1]?.id || '')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')

  const origen = cuentas.find((c) => String(c.id) === String(desde))
  const importe = montoDesde(monto)
  // Avisamos, pero no lo impedimos: puede que la cuenta esté en rojo a
  // propósito y el traspaso sea justamente para cubrirla.
  const noAlcanza = origen && importe > origen.saldo

  async function mover(e) {
    e.preventDefault()
    try {
      const r = await api('/cuentas/traspaso', {
        method: 'POST',
        body: JSON.stringify({ desde, hasta, monto: importe, nota }),
      })
      onHecho(`${money(r.traspaso.monto)} de ${r.traspaso.desde} a ${r.traspaso.hasta}`)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <Modal
      titulo="Mover plata"
      detalle="No cuenta como gasto: la plata sigue siendo tuya, cambia de lugar."
      onCerrar={onCerrar}
    >
      <form onSubmit={mover}>
        <div className="row-2">
          <label className="field">
            <span className="field-label">Desde</span>
            <select value={desde} onChange={(e) => setDesde(e.target.value)}>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Hacia</span>
            <select value={hasta} onChange={(e) => setHasta(e.target.value)}>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">¿Cuánto?</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={monto}
            onChange={(e) => setMonto(soloPlata(e.target.value))}
          />
          {origen && (
            <span className="hint" style={{ marginTop: 6 }}>
              En {origen.name} hay <span className="monto-sensible">{money(origen.saldo)}</span>.
              {noAlcanza && ' Vas a dejarla en rojo.'}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field-label">Nota (opcional)</span>
          <input
            placeholder="Ej: plazo fijo a 30 días"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>

        <div className="dialogo-botones">
          <button type="button" className="dialogo-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="submit"
            className="dialogo-btn principal"
            disabled={!importe || String(desde) === String(hasta)}
          >Mover</button>
        </div>
      </form>
    </Modal>
  )
}
