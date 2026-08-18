/**
 * Piezas compartidas entre pantallas: formato de plata, fechas y los
 * componentes chicos que se repiten.
 */

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

export function money(n, { sign = false } = {}) {
  const value = Number(n) || 0
  const formatted = Math.abs(value).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  // Los negativos SIEMPRE muestran el menos: sin eso, un saldo en rojo se
  // lee igual que uno a favor.
  if (value < 0) return `-$${formatted}`
  return `${sign && value > 0 ? '+' : ''}$${formatted}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function monthLabel(ym) {
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m] = String(ym).split('-')
  return `${names[Number(m) - 1] || ''} ${String(y).slice(2)}`
}

export function dayLabel(iso) {
  const d = String(iso).split('-')
  return `${d[2]}/${d[1]}`
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
