/**
 * El asistente para conectar Telegram.
 *
 * Conectar el bot es lo que más cambia cómo se usa la app —anotás un gasto
 * mandando un mensaje, sin entrar acá— y sin embargo era lo más escondido:
 * había que encontrar Ajustes, apretar «Pedir código» y adivinar qué hacer
 * con los seis números que aparecían.
 *
 * Ahora son tres pasos, con el link para abrir el bot y el comando listo para
 * copiar. Y lo importante: mientras esperás, el asistente le pregunta al
 * servidor cada tanto si ya te vinculaste, así te lo confirma solo. Antes
 * mandabas el código y te quedabas sin saber si había funcionado.
 */
import { useEffect, useRef, useState } from 'react'
import { api } from './comunes.jsx'
import { Modal } from './Dialogos.jsx'

export default function ConectarTelegram({ bot, onCerrar, onListo, onError }) {
  const [paso, setPaso] = useState(1)
  const [codigo, setCodigo] = useState('')
  const [botUser, setBotUser] = useState(bot || null)
  const [copiado, setCopiado] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const timer = useRef(null)

  const comando = codigo ? `/vincular ${codigo}` : ''

  // Mientras estás en el paso 2 esperando, preguntamos cada 3 segundos si ya
  // se vinculó. Es la diferencia entre "mandé el código y no sé qué pasó" y
  // que la pantalla te diga «listo».
  useEffect(() => {
    if (paso !== 2) return

    timer.current = setInterval(async () => {
      try {
        const r = await api('/telegram/estado')
        if (r.vinculado) {
          clearInterval(timer.current)
          setPaso(3)
          onListo?.()
        }
      } catch {
        /* si falla una consulta no pasa nada: se reintenta a los 3 segundos */
      }
    }, 3000)

    return () => clearInterval(timer.current)
  }, [paso, onListo])

  async function pedirCodigo() {
    if (pidiendo) return
    setPidiendo(true)
    try {
      const r = await api('/telegram/code', { method: 'POST' })
      setCodigo(r.code)
      if (r.bot) setBotUser(r.bot)
      setPaso(2)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setPidiendo(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles no es grave: el comando está a la vista
      // y se puede escribir a mano, que son doce caracteres.
      onError?.('No pude copiarlo. Escribilo tal cual figura arriba.')
    }
  }

  return (
    <Modal
      titulo="Conectar Telegram"
      detalle="Para poder anotar gastos mandando un mensaje, sin entrar a la app."
      onCerrar={onCerrar}
    >
      <div className="tg-pasos">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n === paso ? 'ahora' : n < paso ? 'hecho' : ''} />
        ))}
      </div>

      {paso === 1 && (
        <div className="tg-paso">
          <h3>Para qué sirve</h3>
          <ul className="tg-lista">
            <li><b>Anotás escribiendo.</b> «2500 café» y listo, Manguito le pone la categoría solo.</li>
            <li><b>Mandás la foto del ticket</b> y lo lee.</li>
            <li><b>Te avisa</b> cuando se te va un presupuesto o vence una tarjeta.</li>
          </ul>
          <p className="hint">
            Son dos pasos y tarda menos de un minuto. Podés desconectarlo
            cuando quieras.
          </p>
          <div className="dialogo-botones">
            <button type="button" className="dialogo-btn" onClick={onCerrar}>Ahora no</button>
            <button
              type="button"
              className="dialogo-btn principal"
              onClick={pedirCodigo}
              disabled={pidiendo}
            >{pidiendo ? 'Pidiendo…' : 'Empezar'}</button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="tg-paso">
          <h3>Mandale este mensaje al bot</h3>

          <div className="tg-comando">
            <code>{comando}</code>
            <button type="button" className="chip" onClick={copiar}>
              {copiado ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>

          <p className="hint">
            El código es tuyo y dura hasta que lo uses. Sirve para que el bot
            sepa que los gastos que le mandes son tuyos y no de otra persona.
          </p>

          {botUser ? (
            <a
              className="tg-abrir"
              href={`https://t.me/${botUser}`}
              target="_blank"
              rel="noreferrer"
            >Abrir Telegram y escribirle →</a>
          ) : (
            <p className="hint">
              Buscá el bot en Telegram y mandale ese mensaje. Si no sabés cuál
              es, preguntale a quien instaló la app.
            </p>
          )}

          <div className="tg-esperando">
            <span className="tg-punto" />
            Esperando que le escribas… en cuanto lo hagas, esto se cierra solo.
          </div>

          <div className="dialogo-botones">
            <button type="button" className="dialogo-btn" onClick={onCerrar}>Sigo después</button>
            <button type="button" className="dialogo-btn" onClick={pedirCodigo}>Otro código</button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="tg-paso">
          <div className="tg-listo">✓</div>
          <h3>¡Listo, quedó conectado!</h3>
          <p>
            Probá mandarle <b>«1200 café»</b> y fijate que aparezca acá en
            Movimientos. También podés mandarle la foto de un ticket.
          </p>
          <div className="dialogo-botones">
            <button type="button" className="dialogo-btn principal" onClick={onCerrar}>
              Buenísimo
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/**
 * El cartelito que le ofrece conectar Telegram a quien todavía no lo hizo.
 *
 * Va en el Resumen, que es lo primero que ve. Se puede sacar, y si lo sacás
 * no vuelve: queda en Ajustes, que es donde se busca esto.
 */
const OCULTO = 'manguito.telegramOcultado'

export function InvitacionTelegram({ onConectar }) {
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(OCULTO) === '1'
    } catch {
      return false
    }
  })

  if (oculto) return null

  function sacar() {
    try {
      localStorage.setItem(OCULTO, '1')
    } catch {
      /* si no hay localStorage vuelve a aparecer, no es grave */
    }
    setOculto(true)
  }

  return (
    <section className="card tg-invita">
      <div className="tg-invita-txt">
        <div className="tg-invita-titulo">Anotá tus gastos por Telegram</div>
        <p className="hint">
          Le escribís «2500 café» y queda anotado, sin entrar a la app. Se
          conecta en menos de un minuto.
        </p>
      </div>
      <div className="tg-invita-botones">
        <button className="primary" onClick={onConectar}>Conectar</button>
        <button className="chip" onClick={sacar}>Ahora no</button>
      </div>
    </section>
  )
}
