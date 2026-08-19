/**
 * Diálogos propios, para no usar los del navegador.
 *
 * confirm() y prompt() abren una ventana gris del sistema que dice
 * "dashboard-finanzas.onrender.com dice", no se puede estilar y en el celular
 * se ve como una alerta de una página cualquiera. Estos viven adentro de la
 * app y usan los colores de Manguito.
 *
 * Se usan así, y devuelven una promesa igual que los originales:
 *
 *   const { confirmar, pedirTexto } = useDialogos()
 *   if (!(await confirmar({ titulo: '¿Borrar esto?' }))) return
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const Contexto = createContext(null)

export function useDialogos() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('Falta <ProveedorDialogos> más arriba en el árbol')
  return ctx
}

/**
 * Modal genérico: la misma caja que usan los diálogos, pero con el contenido
 * que le pases. Sirve para los formularios de alta ("+ Nuevo presupuesto",
 * "+ Nuevo gasto fijo") que antes se desplegaban abajo de la pantalla.
 *
 * El <form> lo pone quien lo usa, para que maneje su propio submit.
 */
export function Modal({ titulo, detalle, onCerrar, children, ancho }) {
  const cajaRef = useRef(null)

  useEffect(() => {
    // El foco va al primer campo: se puede escribir sin tocar el mouse.
    const t = setTimeout(() => {
      const caja = cajaRef.current
      if (!caja) return
      const primero = caja.querySelector('input, select, textarea')
      if (primero) primero.focus()
      else caja.focus()
    }, 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function tecla(e) { if (e.key === 'Escape') { e.preventDefault(); onCerrar() } }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div
        className="dialogo"
        ref={cajaRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={ancho ? { maxWidth: ancho } : undefined}
      >
        <div className="dialogo-head">
          <div>
            <div className="dialogo-titulo">{titulo}</div>
            {detalle && <div className="dialogo-detalle">{detalle}</div>}
          </div>
          <button type="button" className="dialogo-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Dialogo({ pedido, onCerrar }) {
  const [texto, setTexto] = useState(pedido.valor || '')
  const inputRef = useRef(null)
  const cajaRef = useRef(null)

  // Al abrirse, el foco va adentro: así se puede escribir o apretar Enter
  // sin tocar el mouse, y el lector de pantalla anuncia el diálogo.
  useEffect(() => {
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus()
      else if (cajaRef.current) cajaRef.current.focus()
    }, 30)
    return () => clearTimeout(t)
  }, [])

  // Escape cancela, como en los diálogos del navegador.
  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCerrar(null) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const esTexto = pedido.tipo === 'texto'

  function aceptar(e) {
    if (e) e.preventDefault()
    onCerrar(esTexto ? texto : true)
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(null) }}>
      <form
        className="dialogo"
        ref={cajaRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={pedido.titulo}
        onSubmit={aceptar}
      >
        <div className="dialogo-head">
          <div>
            <div className="dialogo-titulo">{pedido.titulo}</div>
            {pedido.detalle && <div className="dialogo-detalle">{pedido.detalle}</div>}
          </div>
          <button
            type="button"
            className="dialogo-x"
            onClick={() => onCerrar(null)}
            aria-label="Cerrar"
          >✕</button>
        </div>

        {esTexto && (
          <input
            ref={inputRef}
            className="dialogo-input"
            inputMode={pedido.inputMode || 'text'}
            placeholder={pedido.placeholder || ''}
            value={texto}
            onChange={(e) => setTexto(
              pedido.soloNumeros ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value
            )}
          />
        )}

        <div className="dialogo-botones">
          <button type="button" className="dialogo-btn" onClick={() => onCerrar(null)}>
            {pedido.cancelar || 'Cancelar'}
          </button>
          <button
            type="submit"
            className={`dialogo-btn principal ${pedido.peligro ? 'peligro' : ''}`}
            disabled={esTexto && !texto.trim()}
          >
            {pedido.aceptar || 'Aceptar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProveedorDialogos({ children }) {
  const [pedido, setPedido] = useState(null)
  // Guardamos el resolve de la promesa para llamarlo cuando el usuario decide.
  const resolver = useRef(null)

  const abrir = useCallback((opciones) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setPedido(opciones)
    })
  }, [])

  const cerrar = useCallback((valor) => {
    setPedido(null)
    if (resolver.current) {
      resolver.current(valor)
      resolver.current = null
    }
  }, [])

  const confirmar = useCallback(
    (o) => abrir({ ...o, tipo: 'confirmar' }).then(Boolean),
    [abrir]
  )

  const pedirTexto = useCallback(
    (o) => abrir({ ...o, tipo: 'texto' }),
    [abrir]
  )

  return (
    <Contexto.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {pedido && <Dialogo pedido={pedido} onCerrar={cerrar} />}
    </Contexto.Provider>
  )
}
