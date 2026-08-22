/**
 * Piezas compartidas entre pantallas: formato de plata, fechas y los
 * componentes chicos que se repiten.
 */
import { useState } from 'react'
import { formatear } from './moneda.js'

export const API = '/api'

export async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  // Si la sesión venció, volvemos al login recargando.
  if (res.status === 401) {
    window.location.reload()
    throw new Error('Se cerró la sesión')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Algo salió mal')
  return data
}

// El formato vive en moneda.js porque depende del botón ARS/US$.
export function money(n, opciones) {
  return formatear(n, opciones)
}

/**
 * Lo que se puede tipear en un campo de plata.
 *
 * Dejamos pasar los puntos y las comas mientras escribís, porque la gente
 * escribe los montos como los lee: 1.000.000, no 1000000. Interpretarlos es
 * trabajo de montoDesde().
 */
export function soloPlata(texto, { negativos = false } = {}) {
  const limpio = String(texto).replace(negativos ? /[^\d.,-]/g : /[^\d.,]/g, '')
  if (!negativos) return limpio
  // El menos solo tiene sentido adelante: "-300", no "30-0".
  return (limpio.startsWith('-') ? '-' : '') + limpio.replace(/-/g, '')
}

/**
 * Un monto escrito a la argentina, en número.
 *
 *   "300.000"    -> 300000
 *   "1.000.000"  -> 1000000
 *   "2.500,50"   -> 2500.5
 *   "300,50"     -> 300.5
 *
 * Es la misma regla que usa `plata.js` en el server, y tiene que seguir
 * siéndolo: si los dos lados leen distinto, un gasto que cargás por la web
 * vale otra cosa que el mismo gasto por Telegram.
 *
 * Antes acá se hacía `Number(texto.replace(/[^\d.]/g, ''))` y estaba mal de
 * dos formas: "300.000" daba 300 —movía trescientos pesos sin avisar— y
 * "1.000.000" daba NaN, que apagaba el botón de guardar y parecía que la app
 * "no dejaba" con ciertos montos.
 */
export function montoDesde(texto) {
  const crudo = String(texto == null ? '' : texto).trim()
  // El menos importa para el ajuste de saldo: podés tener plata en contra.
  const signo = crudo.startsWith('-') ? -1 : 1

  let s = crudo.replace(/[^\d.,]/g, '')
  if (!s) return 0

  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    // 1.234,56 -> la coma son los centavos
    s = s.replace(/\./g, '').replace(',', '.')
  } else if ((s.match(/\./g) || []).length > 1) {
    // 1.000.000 -> los puntos son miles
    s = s.replace(/\./g, '')
  } else if (/^\d{1,3}\.\d{3}$/.test(s)) {
    // 15.400 son quince mil cuatrocientos, no quince con cuatro
    s = s.replace('.', '')
  } else {
    s = s.replace(/,/g, '')
  }

  const n = parseFloat(s)
  return isNaN(n) ? 0 : n * signo
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function monthLabel(ym) {
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m] = String(ym).split('-')
  return `${names[Number(m) - 1] || ''} ${String(y).slice(2)}`
}

/** "2026-08" -> "agosto" (para frases: "Resultado de agosto") */
export function mesNombre(ym) {
  const largos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return largos[Number(String(ym).split('-')[1]) - 1] || ''
}

export function dayLabel(iso) {
  const d = String(iso).split('-')
  return `${d[2]}/${d[1]}`
}

/* Un ícono por categoría, para que las listas no sean todas grises.
   Vive acá porque lo usan Resumen, Presupuestos, Gastos y Movimientos.

   Las claves tienen que ser EXACTAMENTE las de CATEGORIES en
   server/categorizer.js. "Educacion" va sin tilde por eso: escrito
   "Educación" no coincidía y salía con el ícono genérico. */
export const ICONOS = {
  Supermercado: '🛒',
  Delivery: '🛵',
  Gustitos: '🍻',
  Transporte: '🚗',
  Servicios: '⚡',
  Entretenimiento: '🎬',
  Salud: '💊',
  Ropa: '👕',
  Educacion: '📚',
  Sueldo: '💰',
  Transferencia: '🔁',
  Otros: '◈',
  // Alias por si alguna categoría vieja quedó escrita distinto
  'Educación': '📚',
  Comida: '🍔',
  Ocio: '🎬',
}

export function icono(cat) {
  return ICONOS[cat] || '◈'
}

/**
 * Una pantalla que arranca con los montos tapados.
 *
 * Patrimonio e Inversiones muestran cuánta plata tenés en total, que es lo
 * más privado de la app: alcanza con que alguien pase por al lado. Por eso
 * estas dos empiezan tapadas y las destapás vos.
 *
 * Se vuelven a tapar solas al salir de la sección: el `key={tab}` del
 * contenedor hace que la pantalla se vuelva a montar, y este estado arranca
 * de nuevo en false. Es a propósito, si no dejaría de tener sentido.
 *
 * La clase `oculto` es la misma del botón «Ocultar saldos» de la barra: como
 * el selector es `.oculto .monto-sensible`, ponerla en cualquier envoltorio
 * de adentro tapa lo que haya abajo.
 */
/*
 * Si destapaste los montos, siguen destapados hasta que recargues.
 *
 * Antes vivía en el estado del componente, y como el contenedor se remonta
 * al cambiar de sección (`key={tab}`), volver a Patrimonio te obligaba a
 * apretar «Mostrar» de nuevo cada vez. Emanuel lo pidió: que se tape solo al
 * recargar, no al cambiar de solapa.
 *
 * Va en una variable del módulo y NO en localStorage a propósito: así vive lo
 * que vive la pestaña. Guardarlo dejaría los montos destapados la próxima vez
 * que abrís la app, que es justo lo que esto tiene que evitar.
 */
let destapado = false

export function Privado({ children }) {
  const [visible, setVisible] = useState(destapado)

  function alternar() {
    destapado = !visible
    setVisible(destapado)
  }

  return (
    <div className={visible ? undefined : 'oculto'}>
      <div className="privado-barra">
        <span className="privado-txt">
          {visible ? 'Los montos están a la vista' : 'Los montos están ocultos'}
        </span>
        <button className="chip" onClick={alternar}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {children}
    </div>
  )
}

export function Empty({ icon, text }) {
  return (
    <div className="empty">
      <span className="big">{icon}</span>
      {text}
    </div>
  )
}

export function BudgetList({ budgets }) {
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
            <div className={`budget-fill ${b.status}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
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
