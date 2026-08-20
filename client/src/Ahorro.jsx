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
          {/* Este botón antes aparecía solo si tenías DOS cuentas o más. Con
              una sola —que es como empezás— no había ninguna forma visible de
              mover plata: solo veías tu saldo total. Y el texto de abajo te
              hablaba de mover plata entre cuentas igual. Ahora está siempre y
              la cuenta de destino se puede crear desde el mismo pop-up. */}
          {lista.length > 0 && (
            <button className="chip" onClick={() => setMoviendo({ desde: '' })}>
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
                {/* «Mover» al lado de cada cuenta: es donde lo buscás, no en
                    un chip chiquito arriba del todo. */}
                <button className="chip" onClick={() => setMoviendo({ desde: c.id })}>
                  Mover
                </button>
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
          desdeInicial={moviendo.desde}
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
/**
 * El pop-up para pasar plata de una cuenta a otra.
 *
 * Podés mover LA PARTE QUE QUIERAS: escribís el monto y listo. No hay ninguna
 * opción de "mover todo" porque mover todo es simplemente escribir el saldo.
 *
 * Lo importante: la cuenta de destino se puede crear acá mismo. Antes había
 * que adivinar que primero tenías que ir a «+ Nueva cuenta», crearla, y recién
 * ahí aparecía el botón de mover. Si tenías una sola cuenta, no había ningún
 * botón y parecía que la app no dejaba mover nada.
 */
function MoverPlata({ cuentas, desdeInicial, onCerrar, onHecho, onError }) {
  const NUEVA = '__nueva__'

  const [desde, setDesde] = useState(desdeInicial || cuentas[0]?.id || '')
  // Si hay una sola cuenta, el destino arranca en «crear una nueva», que es
  // lo único que se puede hacer.
  const otra = cuentas.find((c) => String(c.id) !== String(desdeInicial || cuentas[0]?.id))
  const [hasta, setHasta] = useState(otra ? otra.id : NUEVA)
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [nueva, setNueva] = useState({ name: '', tipo: 'ahorro' })
  const [guardando, setGuardando] = useState(false)

  const origen = cuentas.find((c) => String(c.id) === String(desde))
  const importe = montoDesde(monto)
  const creando = String(hasta) === NUEVA

  // Avisamos, pero no lo impedimos: puede que la cuenta esté en rojo a
  // propósito y el traspaso sea justamente para cubrirla.
  const noAlcanza = origen && importe > origen.saldo

  const puedeMover = Boolean(
    importe &&
    desde &&
    (creando ? nueva.name.trim() : String(desde) !== String(hasta))
  )

  async function mover(e) {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    try {
      let destino = hasta

      // Crear la cuenta de destino sobre la marcha.
      if (creando) {
        const c = await api('/cuentas', {
          method: 'POST',
          body: JSON.stringify({ name: nueva.name.trim(), tipo: nueva.tipo, color: COLORES[2] }),
        })
        destino = c.id
      }

      const r = await api('/cuentas/traspaso', {
        method: 'POST',
        body: JSON.stringify({ desde, hasta: destino, monto: importe, nota }),
      })
      onHecho(`${money(r.traspaso.monto)} de ${r.traspaso.desde} a ${r.traspaso.hasta}`)
    } catch (err) {
      onError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo="Mover plata"
      detalle="Movés la parte que quieras, no hace falta que sea todo. No cuenta como gasto: la plata sigue siendo tuya, cambia de lugar."
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
              {cuentas
                .filter((c) => String(c.id) !== String(desde))
                .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NUEVA}>＋ Una cuenta nueva…</option>
            </select>
          </label>
        </div>

        {creando && (
          <>
            <label className="field">
              <span className="field-label">¿Cómo se llama la cuenta nueva?</span>
              <input
                placeholder="Ej: Plazo fijo, Inversiones, La cuenta de Cami"
                value={nueva.name}
                onChange={(e) => setNueva({ ...nueva, name: e.target.value })}
              />
            </label>
            <div className="field">
              <span className="field-label">¿Qué es?</span>
              <div className="tipos tipos-chicos">
                {TIPOS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={`tipo ${nueva.tipo === t.id ? 'elegido' : ''}`}
                    onClick={() => setNueva({ ...nueva, tipo: t.id })}
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
          </>
        )}

        <label className="field">
          <span className="field-label">¿Cuánto querés mover?</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={monto}
            onChange={(e) => setMonto(soloPlata(e.target.value))}
          />
          {origen && (
            <span className="hint" style={{ marginTop: 6 }}>
              En {origen.name} hay <span className="monto-sensible">{money(origen.saldo)}</span>.
              Podés mover una parte: escribí cuánto.
              {noAlcanza && ' Ojo, con eso la dejás en rojo.'}
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
          <button type="submit" className="dialogo-btn principal" disabled={!puedeMover || guardando}>
            {guardando ? 'Moviendo…' : 'Mover'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
