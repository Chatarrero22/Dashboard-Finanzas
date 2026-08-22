/**
 * Tarjetas de crédito: cuánto llevás gastado en el resumen que está abierto,
 * cuándo cierra y cuándo vence.
 *
 * El consumo no es "lo del mes calendario": va de un cierre al siguiente, que
 * es como funciona una tarjeta de verdad. El cálculo está en server/tarjetas.js.
 */
import { useEffect, useState } from 'react'
import { api, money, Empty, montoDesde, soloPlata } from './comunes.jsx'
import { mesLargo } from './Shell.jsx'
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

const VACIA = { name: '', last4: '', color: COLORES[0].valor, limit_amount: '', close_day: '1', due_day: '10', es_default: false }

function Tarjeta({ t, onEditar, onBorrar, onPagar, onOrdenar }) {
  const pct = t.pct == null ? null : Math.min(t.pct, 100)

  return (
    <div className="tarjeta">
      <div className="tarjeta-brillo" style={{ background: `radial-gradient(circle at 50% 50%, ${t.color}, transparent 65%)` }} />
      <div className="tarjeta-cuerpo">
        <div className="tarjeta-head">
          <div>
            <div className="tarjeta-nombre">
              {t.name}
              {t.es_default && <span className="tag" style={{ marginLeft: 8 }}>por defecto</span>}
            </div>
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

        {/* Lo que ya cerro y falta pagar: esta es la plata que de verdad
            te sale de la cuenta este mes. */}
        {t.aPagar && (
          <div className={`a-pagar ${t.vencido ? 'vencido' : ''}`}>
            <div className="a-pagar-txt">
              <div className="a-pagar-label">
                {t.vencido ? 'VENCIÓ Y NO LO PAGASTE' : 'A PAGAR'}
              </div>
              <div className="a-pagar-monto monto-sensible">{money(t.aPagar.monto)}</div>
              <div className="a-pagar-sub">
                cerró el {t.aPagar.cierreTexto} · vence el {t.aPagar.venceTexto}
                {t.pendientes.length > 1 && ` · y ${t.pendientes.length - 1} resumen más atrasado`}
              </div>
            </div>
            <button className="chip" onClick={() => onPagar(t)}>Ya lo pagué</button>
          </div>
        )}

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

        <div className="tarjeta-pie-acciones">
          <button className="tarjeta-link" onClick={() => onOrdenar(t)}>
            Poner esta tarjeta a los gastos sueltos
          </button>
          <button className="tarjeta-borrar" onClick={() => onBorrar(t)}>Borrar tarjeta</button>
        </div>
      </div>
    </div>
  )
}

export default function TarjetasScreen({ cards, proximas, accion, onReload, onError, onSaved }) {
  const { confirmar } = useDialogos()
  const [form, setForm] = useState(VACIA)
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)

  async function elegirMedio(cardId) {
    try {
      await api('/cards/default', { method: 'POST', body: JSON.stringify({ card_id: cardId }) })
      onSaved(cardId ? 'Listo, tus gastos van a esa tarjeta' : 'Listo, tus gastos ya no entran en ninguna tarjeta')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

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
      es_default: t.es_default,
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
      limit_amount: montoDesde(form.limit_amount),
      close_day: Number(form.close_day) || 1,
      due_day: Number(form.due_day) || 10,
      es_default: form.es_default,
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

  async function pagar(t) {
    const ok = await confirmar({
      titulo: `¿Pagaste ${money(t.aPagar.monto)} de ${t.name}?`,
      detalle: 'No lo cuento como gasto nuevo: esas compras ya están anotadas una por una. ' +
        'Solo dejo de mostrártelo como pendiente.',
      aceptar: 'Sí, lo pagué',
    })
    if (!ok) return
    try {
      await api(`/cards/${t.id}/pagar`, { method: 'POST', body: JSON.stringify({}) })
      onSaved('Resumen marcado como pagado')
      onReload()
    } catch (err) {
      onError(err.message)
    }
  }

  // Los gastos que cargaste antes de tener tarjeta quedaron sin ninguna.
  async function ordenarSueltos(t) {
    try {
      const previo = await api(`/cards/${t.id}/asignar-sueltos`, {
        method: 'POST', body: JSON.stringify({}),
      })
      if (previo.cuantos === 0) return onSaved('No hay gastos sueltos para asignar')

      const ok = await confirmar({
        titulo: `¿Poner ${t.name} a ${previo.cuantos} gastos?`,
        detalle: `Son los que no tienen ninguna tarjeta, ${money(previo.total)} en total.` +
          (previo.respetados
            ? ` Dejo afuera ${previo.respetados} donde dijiste efectivo, débito o transferencia.`
            : ''),
        aceptar: 'Asignarlos',
      })
      if (!ok) return

      const r = await api(`/cards/${t.id}/asignar-sueltos`, {
        method: 'POST', body: JSON.stringify({ aplicar: true }),
      })
      onSaved(`${r.cuantos} gastos quedaron en ${t.name}`)
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
        <>
          {/* Con qué pagás casi siempre.
              Esto faltaba y se notaba: la primera tarjeta que cargabas
              quedaba por defecto y TODOS los gastos le caían encima. A quien
              paga casi todo con débito —el caso de Camila— le entraba cada
              gasto al resumen de crédito y tenía que corregirlos uno por uno.
              Ahora se puede decir «débito o efectivo» y no cae ninguno. */}
          <section className="card medio-habitual">
            <div className="card-rotulo">CON QUÉ PAGÁS CASI SIEMPRE</div>
            <p className="hint">
              Los gastos que cargues van solos acá, salvo que digas otra cosa
              («…en efectivo», «…con la Visa»). Marcá lo que uses más y
              corregís solo las excepciones.
            </p>
            <div className="medios">
              <button
                className={`tipo ${!cards.some((c) => c.es_default) ? 'elegido' : ''}`}
                onClick={() => elegirMedio(null)}
              >
                <span className="tipo-ico">💵</span>
                <span className="tipo-txt">
                  <span className="tipo-nombre">Débito o efectivo</span>
                  <small>Los gastos no entran en ningún resumen</small>
                </span>
              </button>
              {cards.map((t) => (
                <button
                  key={t.id}
                  className={`tipo ${t.es_default ? 'elegido' : ''}`}
                  onClick={() => elegirMedio(t.id)}
                >
                  <span className="tipo-ico">▭</span>
                  <span className="tipo-txt">
                    <span className="tipo-nombre">{t.name}</span>
                    <small>Entran en el resumen de esta tarjeta</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="tarjetas-grid">
            {cards.map((t) => (
              <Tarjeta key={t.id} t={t} onEditar={abrirEditar} onBorrar={borrar} onPagar={pagar} onOrdenar={ordenarSueltos} />
            ))}
          </div>
        </>
      )}

      {proximas && proximas.length > 0 && (
        <section className="card">
          <div className="card-rotulo">CUOTAS QUE SE VIENEN</div>
          <p className="hint">
            Plata que ya está comprometida. No la tenés disponible aunque
            todavía no haya salido.
          </p>
          <div className="cuotas-meses">
            {proximas.map((m) => (
              <div className="cuota-mes" key={m.mes}>
                <div className="cuota-mes-head">
                  <span className="cuota-mes-nombre">{mesLargo(m.mes)}</span>
                  <span className="cuota-mes-total monto-sensible">{money(m.total)}</span>
                </div>
                <div className="cuota-detalle">
                  {m.cuotas.map((c, i) => (
                    <span key={i}>{c.description}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
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
                onChange={(e) => setForm({ ...form, limit_amount: soloPlata(e.target.value) })}
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

            <label className="check">
              <input
                type="checkbox"
                checked={form.es_default}
                onChange={(e) => setForm({ ...form, es_default: e.target.checked })}
              />
              <span>
                Con esta pago casi todo
                <small>Los gastos nuevos van acá solos, salvo que digas «efectivo» o «débito».</small>
              </span>
            </label>

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
