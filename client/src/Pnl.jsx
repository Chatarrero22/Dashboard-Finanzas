import { money, monthLabel, Empty } from './comunes.jsx'
import Numero from './Numero.jsx'

/** Barras de ingresos vs egresos, una al lado de la otra por mes. */
function PnlBarras({ meses }) {
  const max = Math.max(...meses.flatMap((m) => [m.ingresos, m.egresos]), 1)
  return (
    <div className="pnl-graf">
      {meses.map((m) => (
        <div className="pnl-mes" key={m.mes}>
          <div className="pnl-par">
            <div
              className="pnl-barra ing"
              style={{ height: `${Math.max((m.ingresos / max) * 100, 1.5)}%` }}
              role="img"
              aria-label={`${monthLabel(m.mes)}: entró ${money(m.ingresos)}`}
            />
            <div
              className="pnl-barra egr"
              style={{ height: `${Math.max((m.egresos / max) * 100, 1.5)}%` }}
              role="img"
              aria-label={`${monthLabel(m.mes)}: salió ${money(m.egresos)}`}
            />
          </div>
          <div className="pnl-label">{monthLabel(m.mes)}</div>
        </div>
      ))}
    </div>
  )
}

/** Flechita de variación contra el mes anterior. */
function Variacion({ valor, invertido = false }) {
  if (valor == null) return null
  const sube = valor >= 0
  // En egresos subir es malo, por eso se puede invertir el color.
  const bueno = invertido ? !sube : sube
  return (
    <span className={`variacion ${bueno ? 'ok' : 'mal'}`}>
      {sube ? '▲' : '▼'} {Math.abs(valor).toFixed(0)}% vs el mes pasado
    </span>
  )
}

export default function PnlScreen({ pnl }) {
  if (!pnl) return <div className="spinner" />
  if (!pnl.meses.length) {
    return (
      <div className="card">
        <Empty icon="⌁" text="Todavía no hay movimientos para armar el P&L." />
      </div>
    )
  }

  const a = pnl.actual
  const v = pnl.variacion || {}

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Entró este mes</div>
          <Numero className="kpi-valor positivo monto-sensible" valor={a.ingresos} />
          <Variacion valor={v.ingresos} />
        </div>
        <div className="kpi">
          <div className="kpi-label">Salió este mes</div>
          <Numero className="kpi-valor negativo monto-sensible" valor={a.egresos} />
          <Variacion valor={v.egresos} invertido />
        </div>
        <div className="kpi">
          <div className="kpi-label">Ahorro del mes</div>
          <Numero
            className={`kpi-valor monto-sensible ${a.ahorro >= 0 ? 'positivo' : 'negativo'}`}
            valor={a.ahorro}
          />
          <span className="kpi-sub">
            Tasa de ahorro: {a.tasa == null ? '—' : `${Math.round(a.tasa)}%`}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="card-title-row">
          <h2>Mes a mes</h2>
          <div className="leyenda">
            <span><i className="pt ing" />Entró</span>
            <span><i className="pt egr" />Salió</span>
          </div>
        </div>
        <PnlBarras meses={pnl.meses} />
      </section>

      <section className="card">
        <h2>El detalle</h2>
        <div className="tabla">
          <div className="tabla-cab">
            <span>Mes</span><span>Entró</span><span>Salió</span><span>Ahorro</span>
          </div>
          {[...pnl.meses].reverse().map((m) => (
            <div className="tabla-fila" key={m.mes}>
              <span className="mes">{monthLabel(m.mes)}</span>
              <span className="num">{money(m.ingresos)}</span>
              <span className="num">{money(m.egresos)}</span>
              <span className={`num ${m.ahorro >= 0 ? 'positivo' : 'negativo'}`}>
                {money(m.ahorro)}
                {m.tasa != null && <small>{Math.round(m.tasa)}%</small>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
