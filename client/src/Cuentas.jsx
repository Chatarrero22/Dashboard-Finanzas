import { useEffect, useState } from 'react'
import { api, money, Empty, montoDesde, soloPlata } from './comunes.jsx'
import { Modal, useDialogos } from './Dialogos.jsx'

/**
 * Los tipos de cuenta que se manejan ACÁ.
 *
 * Antes había un tercero, «Invertido», para la plata apartada esperando para
 * comprar algo. Se sacó: confundía. El nombre hacía pensar que ahí ibas a ver
 * tus acciones, y «pesos apartados para invertir» es casi lo mismo que
 * «ahorro». Esa plata ahora vive en Inversiones, como en un broker: la ves al
 * lado de lo que compraste, que es donde la buscás.
 *
 * Las cuentas de tipo `inversion` que ya existían siguen funcionando: no se
 * migró nada, simplemente se muestran en Inversiones en vez de acá.
 */
const TIPOS = [
  { id: 'gasto', nombre: 'Liquidez', ayuda: 'La que usás: de acá sale el día a día', icono: '👛' },
  { id: 'ahorro', nombre: 'Ahorro', ayuda: 'La que apartás: sube cuando le mandás plata', icono: '🏦' },
]

const COLORES = ['#EE8A17', '#3B5AA8', '#0E8A51', '#7A5AC9', '#C1372F', '#6B5634']
const VACIA = { name: '', tipo: 'ahorro', color: COLORES[1], saldo_inicial: '' }

function tipoDe(id) {
  return TIPOS.find((t) => t.id === id) || TIPOS[0]
}

/**
 * Qué tipo MOSTRAR para una cuenta.
 *
 * La cuenta principal es tu liquidez, esté marcada como esté: es donde cae
 * todo lo que no dice otra cosa, y es la que se suma en el pote de arriba.
 * La de Emanuel quedó marcada como Ahorro y la fila decía «🏦 Ahorro» justo
 * abajo de un pote que la contaba como Liquidez — la pantalla se contradecía
 * sola. Lo guardado no se toca: solo se muestra lo que de verdad es.
 */
function tipoQueMuestra(c) {
  return c.es_default ? 'gasto' : c.tipo
}

/**
 * Tus cuentas: dónde está la plata y cómo moverla de un lugar a otro.
 *
 * Esto era una sección propia («Ahorro») y se saco: con una sola cuenta
 * mostraba un número que ya estaba en la barra lateral, dos recuadros con
 * uno en cero y una lista de un elemento. No se ganaba el lugar.
 *
 * Ahora vive dentro de Patrimonio, que es la pantalla que ya contesta
 * «cuánto tenés y de qué está hecho». Lo que sigue siendo útil —saber que
 * hay plata en la cuenta de otra persona o en un plazo fijo, y poder moverla—
 * quedó intacto.
 *
 * Mover plata entre cuentas NO es un gasto: no ganaste ni gastaste nada,
 * cambiaste la plata de lugar. Por eso no aparece en tus gastos del mes.
 */
export default function Cuentas({ cuentas, potes, accion, onReload, onError, onSaved }) {
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

  // Las cuentas de inversión se muestran en Inversiones, no acá.
  const lista = (cuentas || []).filter((c) => c.tipo !== 'inversion')

  async function guardar(e) {
    e.preventDefault()
    if (!form.name.trim()) return onError('Ponele un nombre a la cuenta')
    try {
      if (editando) {
        await api(`/cuentas/${editando.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await api('/cuentas', {
          method: 'POST',
          body: JSON.stringify({ ...form, saldo_inicial: montoDesde(form.saldo_inicial) }),
        })
      }
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

  // El pote de ahorro: si no existe, se ofrece crearlo acá mismo. Una
  // pantalla que habla de mover plata al ahorro sin que haya adónde mandarla
  // es la misma trampa de siempre.
  const hayAhorro = lista.some((c) => c.tipo === 'ahorro' && !c.es_default)

  function crearAhorro() {
    setEditando(null)
    setForm({ ...VACIA, name: 'Ahorro', tipo: 'ahorro' })
    setAbierto(true)
  }

  return (
    <>
      {/* Los dos potes, que es como se piensa la plata: la que usás y la que
          apartaste. Cuando mandás plata de una a la otra, la de arriba baja
          — y eso es justamente lo que se quiere ver. */}
      {potes && (
        <section className="potes">
          <div className="pote">
            <div className="pote-label">👛 Liquidez</div>
            <div className={`pote-monto monto-sensible ${potes.liquidez < 0 ? 'negativo' : ''}`}>
              {money(potes.liquidez)}
            </div>
            <p className="hint">La que podés usar hoy</p>
          </div>
          <div className="pote">
            <div className="pote-label">🏦 Ahorro</div>
            <div className={`pote-monto monto-sensible ${potes.ahorro < 0 ? 'negativo' : ''}`}>
              {money(potes.ahorro)}
            </div>
            <p className="hint">
              {hayAhorro
                ? 'Apartada. Lo que le mandes sale de Liquidez.'
                : 'Todavía no tenés dónde apartar plata.'}
            </p>
            {!hayAhorro && (
              <button className="chip" onClick={crearAhorro}>Crear la cuenta de Ahorro</button>
            )}
          </div>
        </section>
      )}

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
                  <div className="cuenta-tipo">{tipoDe(tipoQueMuestra(c)).icono} {tipoDe(tipoQueMuestra(c)).nombre}</div>
                </div>
                <div className={`cuenta-saldo monto-sensible ${c.saldo < 0 ? 'negativo' : ''}`}>
                  {money(c.saldo)}
                </div>
                {/* «Mover» al lado de cada cuenta: es donde lo buscás, no en
                    un chip chiquito arriba del todo. A 320 los botones bajan
                    a su propia línea: apretados en la misma se pisaban y la ✕
                    terminaba fuera de la tarjeta. */}
                <div className="cuenta-acciones">
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

            {!editando && (
              <label className="field">
                <span className="field-label">¿Cuánta plata hay ahí ahora? (opcional)</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={form.saldo_inicial}
                  onChange={(e) => setForm({ ...form, saldo_inicial: soloPlata(e.target.value) })}
                />
                <span className="hint" style={{ marginTop: 6 }}>
                  Si esa plata ya existe pero la app todavía no la sabe, ponela
                  acá. No cuenta como un ingreso del mes: es la app poniéndose
                  al día. Si la vas a pasar desde otra cuenta tuya, dejalo en
                  blanco y usá «Mover plata».
                </span>
              </label>
            )}

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
