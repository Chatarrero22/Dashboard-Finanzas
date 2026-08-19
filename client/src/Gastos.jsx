/**
 * Gastos: en qué se te va la plata este mes, por categoría.
 * Usa byCategory de /api/dashboard, que ya acepta ?month=.
 */
import { money, Empty } from './comunes.jsx'
import Numero from './Numero.jsx'

const COLORES = [
  'var(--accent)', 'var(--blue)', 'var(--good)',
  'var(--yellow)', 'var(--critical)', 'var(--text-tertiary)',
]

export default function GastosScreen({ dashboard }) {
  if (!dashboard) return <div className="spinner" />

  const cats = dashboard.byCategory || []
  const total = cats.reduce((a, c) => a + c.total, 0)

  if (cats.length === 0) {
    return (
      <section className="card">
        <Empty icon="◔" text="No hay gastos anotados este mes." />
      </section>
    )
  }

  const mayor = cats[0]

  return (
    <>
      <div className="kpis kpis-3">
        <div className="kpi">
          <div className="kpi-label">Total gastado</div>
          <Numero className="kpi-valor negativo monto-sensible" valor={total} />
          <span className="kpi-sub">{dashboard.count} movimientos</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Donde más se va</div>
          <div className="kpi-valor monto-sensible">{mayor.category}</div>
          <span className="kpi-sub">
            {money(mayor.total)} · {Math.round((mayor.total / total) * 100)}% del mes
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Categorías con gasto</div>
          <div className="kpi-valor">{cats.length}</div>
          <span className="kpi-sub">
            Promedio {money(total / cats.length)} cada una
          </span>
        </div>
      </div>

      <section className="card">
        <h2>Por categoría</h2>
        <div className="cats">
          {cats.map((c, i) => {
            const pct = (c.total / total) * 100
            return (
              <div className="cat" key={c.category}>
                <div className="cat-head">
                  <span className="cat-nombre">{c.category}</span>
                  <span className="cat-monto monto-sensible">{money(c.total)}</span>
                </div>
                <div
                  className="cat-track"
                  role="img"
                  aria-label={`${c.category}: ${money(c.total)}, ${Math.round(pct)}% del mes`}
                >
                  <div
                    className="cat-fill"
                    style={{ width: `${pct}%`, background: COLORES[i % COLORES.length] }}
                  />
                </div>
                <div className="cat-pie">
                  {Math.round(pct)}% del mes · {c.count} {c.count === 1 ? 'movimiento' : 'movimientos'}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
