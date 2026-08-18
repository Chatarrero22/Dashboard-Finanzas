/**
 * Pantalla de Resumen, copiada del diseño de Claude Design.
 *
 * El orden de los bloques es el del diseño y no es casual: primero el número
 * grande del mes con los cuatro KPI al costado, después la proyección, después
 * a dónde va la plata y la tendencia, y abajo el detalle.
 */
import { money, monthLabel, mesNombre, dayLabel, Empty } from './comunes.jsx'

/* Un ícono por categoría, para que la lista no sea toda gris. */
const ICONOS = {
  Supermercado: '🛒', Comida: '🍽', Transporte: '🚗', Servicios: '⚡',
  Salud: '💊', Ocio: '🎬', Ropa: '👕', Educación: '📚', Hogar: '🏠',
  Impuestos: '🏛', Mascotas: '🐾', Regalos: '🎁', Viajes: '✈',
  Tecnología: '💻', Sueldo: '💰', Otros: '◈',
}
const icono = (cat) => ICONOS[cat] || '◈'

const COLORES = [
  'var(--accent)', 'var(--blue)', 'var(--good)',
  'var(--yellow)', 'var(--critical)', 'var(--text-tertiary)',
]

/* ------------------------------------------------------------ el número */

function Titular({ dashboard, mes }) {
  const neto = dashboard.income - dashboard.expense
  const enRojo = neto < 0

  // El porcentaje solo significa algo si entró plata.
  const pctGastado = dashboard.income > 0
    ? Math.round((dashboard.expense / dashboard.income) * 100)
    : null

  const chip = pctGastado == null
    ? 'Este mes no hay ingresos anotados'
    : pctGastado >= 100
      ? `Gastás el ${pctGastado}% de lo que entra`
      : `Te queda el ${100 - pctGastado}% de lo que entró`

  return (
    <div className="titular">
      <div className="titular-brillo" />
      <div className="titular-txt">
        <div className="titular-label">Resultado de {mesNombre(mes)}</div>
        <div className={`titular-num monto-sensible ${enRojo ? 'negativo' : 'positivo'}`}>
          {money(neto)}
        </div>
        <div className="titular-pie">
          <span className={`titular-chip ${enRojo || pctGastado == null ? 'mal' : 'ok'}`}>{chip}</span>
          <span className="titular-movs">
            {dashboard.count} {dashboard.count === 1 ? 'movimiento' : 'movimientos'} este mes
          </span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- los KPI */

function Kpis({ dashboard }) {
  const pctAhorro = dashboard.income > 0
    ? Math.round(((dashboard.income - dashboard.expense) / dashboard.income) * 100)
    : null

  const diaDeHoy = new Date().getDate()
  const promedio = dashboard.expense / (dashboard.diasDelMes ? Math.min(diaDeHoy, dashboard.diasDelMes) : 1)

  const items = [
    { label: 'Entró', valor: money(dashboard.income), pie: `${dashboard.byMonth ? '' : ''}ingresos del mes`, color: 'var(--good)' },
    { label: 'Salió', valor: money(dashboard.expense), pie: `${dashboard.count} movimientos`, color: 'var(--accent)' },
    { label: 'Ahorro', valor: pctAhorro == null ? '—' : `${pctAhorro}%`, pie: 'del ingreso', color: 'var(--blue)' },
    { label: 'Promedio', valor: money(promedio), pie: 'por día', color: 'var(--yellow)' },
  ]

  return (
    <div className="kpi-grid">
      {items.map((k) => (
        <div className="kpi-chico" key={k.label}>
          <div className="kpi-chico-top">
            <span className="kpi-punto" style={{ background: k.color }} />
            <span className="kpi-chico-label">{k.label}</span>
          </div>
          <div className="kpi-chico-valor monto-sensible">{k.valor}</div>
          <div className="kpi-chico-pie">{k.pie}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- la proyección */

function Proyeccion({ p, mes }) {
  if (!p || p.diasQueQuedan <= 0) return null
  const cierraEnRojo = p.netoProyectado < 0
  const nombreMes = mesNombre(mes)

  return (
    <div className="proyeccion">
      <div className="proyeccion-txt">
        <div className="proyeccion-label">PROYECCIÓN</div>
        <div className="proyeccion-frase">
          Si seguís a este ritmo, {nombreMes} cierra {cierraEnRojo ? 'en rojo' : 'en verde'}.
        </div>
      </div>
      <div className="proyeccion-num">
        <div className={`monto-sensible ${cierraEnRojo ? 'negativo' : 'positivo'}`}>
          {money(p.netoProyectado)}
        </div>
        <div className="proyeccion-dias">
          quedan {p.diasQueQuedan} {p.diasQueQuedan === 1 ? 'día' : 'días'}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------- a dónde va la plata */

function ADondeVa({ cats }) {
  const total = cats.reduce((a, c) => a + c.total, 0)
  if (!total) return <Empty icon="◔" text="Sin gastos este mes." />

  // Solo las 6 primeras entran en la rueda; el resto se junta en "Otras".
  const top = cats.slice(0, 6)
  let desde = 0
  const tramos = top.map((c, i) => {
    const hasta = desde + (c.total / total) * 100
    const t = `${COLORES[i % COLORES.length]} ${desde}% ${hasta}%`
    desde = hasta
    return t
  })

  return (
    <div className="adonde">
      <div className="donut">
        {/* Igual que en Patrimonio: el aro gira solo, el centro queda quieto
            para que nunca se vea como un disco lleno. */}
        <div className="donut-aro" style={{ background: `conic-gradient(${tramos.join(', ')})` }} />
        <div className="donut-centro">
          <span className="donut-label">TOTAL</span>
          <span className="donut-total monto-sensible">{money(total)}</span>
        </div>
      </div>
      <div className="adonde-lista">
        {top.map((c, i) => (
          <div className="adonde-item" key={c.category}>
            <div className="adonde-head">
              <span className="adonde-nombre">
                <span className="adonde-punto" style={{ background: COLORES[i % COLORES.length] }} />
                {c.category}
              </span>
              <span className="adonde-monto monto-sensible">{money(c.total)}</span>
            </div>
            <div className="adonde-track">
              <div
                className="adonde-fill"
                style={{ width: `${(c.total / total) * 100}%`, background: COLORES[i % COLORES.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ tendencia */

function Tendencia({ meses, mesActual }) {
  if (!meses || !meses.length) return <Empty icon="⌁" text="Todavía no hay meses para comparar." />
  const max = Math.max(...meses.flatMap((m) => [m.income, m.expense]), 1)

  return (
    <div className="tendencia">
      {meses.map((m) => (
        <div className="tendencia-mes" key={m.month}>
          <div className="tendencia-par">
            <div
              className="tendencia-barra ing"
              style={{ height: `${Math.max((m.income / max) * 100, 2)}%` }}
              role="img"
              aria-label={`${monthLabel(m.month)}: entró ${money(m.income)}`}
            />
            <div
              className="tendencia-barra egr"
              style={{ height: `${Math.max((m.expense / max) * 100, 2)}%` }}
              role="img"
              aria-label={`${monthLabel(m.month)}: salió ${money(m.expense)}`}
            />
          </div>
          <div className={`tendencia-label ${m.month === mesActual ? 'actual' : ''}`}>
            {monthLabel(m.month).split(' ')[0]}
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- gasto por día */

function GastoPorDia({ byDay, promedio }) {
  if (!byDay || !byDay.length) return null
  const max = Math.max(...byDay.map((d) => d.total), 1)
  const hoy = new Date().getDate()

  return (
    <>
      <div className="dias-graf">
        {byDay.map((d) => (
          <div
            key={d.dia}
            className={`dia-barra ${d.total === 0 ? 'vacio' : d.total > max * 0.5 ? 'fuerte' : 'flojo'}`}
            style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }}
            title={`${d.dia}: ${money(d.total)}`}
            role="img"
            aria-label={`Día ${d.dia}: ${money(d.total)}`}
          />
        ))}
      </div>
      <div className="dias-escala">
        <span>1</span><span>10</span><span>15</span><span>20</span><span>25</span>
        <span>{byDay.length}</span>
      </div>
    </>
  )
}

/* ============================================================= la pantalla */

export default function ResumenScreen({ dashboard, transactions, mes, onGo, config }) {
  if (!dashboard) return <div className="spinner" />

  const cats = dashboard.byCategory || []
  const top = dashboard.topExpenses || []
  const ultimos = (transactions || []).slice(0, 5)
  const diaDeHoy = new Date().getDate()
  const promedio = dashboard.expense / Math.max(Math.min(diaDeHoy, dashboard.diasDelMes || 31), 1)

  return (
    <>
      {/* fila 1: el número grande + los cuatro KPI */}
      <div className="fila-titular">
        <Titular dashboard={dashboard} mes={mes} />
        <Kpis dashboard={dashboard} />
      </div>

      <Proyeccion p={dashboard.proyeccion} mes={mes} />

      {/* fila 2: a dónde va la plata + tendencia */}
      <div className="fila-dos">
        <section className="card">
          <div className="card-rotulo">A DÓNDE VA LA PLATA</div>
          <ADondeVa cats={cats} />
        </section>

        <section className="card">
          <div className="card-rotulo-fila">
            <span className="card-rotulo">TENDENCIA · 6 MESES</span>
            <span className="leyenda">
              <span><i className="pt ing" />Ingresos</span>
              <span><i className="pt egr" />Gastos</span>
            </span>
          </div>
          <Tendencia meses={dashboard.byMonth} mesActual={mes} />
        </section>
      </div>

      {/* fila 3: top 5 gastos + gasto por día */}
      <div className="fila-dos pareja">
        <section className="card">
          <div className="card-rotulo">LOS 5 GASTOS MÁS GRANDES</div>
          {top.length === 0 ? (
            <Empty icon="◔" text="Sin gastos este mes." />
          ) : (
            <div className="ranking">
              {top.map((g, i) => (
                <div className="rank" key={g.id}>
                  <span className="rank-n">{i + 1}</span>
                  <span className="rank-ico">{icono(g.category)}</span>
                  <span className="rank-txt">
                    <span className="rank-nombre">{g.description}</span>
                    <span className="rank-meta">{dayLabel(g.date)} · {g.category}</span>
                  </span>
                  <span className="rank-monto monto-sensible">{money(-g.total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-rotulo-fila">
            <span className="card-rotulo">GASTO POR DÍA</span>
            <span className="card-nota monto-sensible">Promedio {money(promedio)} / día</span>
          </div>
          <GastoPorDia byDay={dashboard.byDay} promedio={promedio} />

          {dashboard.subscriptionsMonthly > 0 && (
            <div className="nota-fija">
              <span className="nota-ico">🥭</span>
              <span>
                Tus {dashboard.subscriptionsCount} {dashboard.subscriptionsCount === 1 ? 'suscripción' : 'suscripciones'} se
                llevan <strong className="monto-sensible">{money(dashboard.subscriptionsMonthly)}</strong> por mes.
              </span>
            </div>
          )}
        </section>
      </div>

      {/* fila 4: últimos movimientos */}
      <section className="card">
        <div className="card-rotulo-fila">
          <span className="card-rotulo">ÚLTIMOS MOVIMIENTOS</span>
          <button className="link" onClick={() => onGo('movs')}>Ver todos →</button>
        </div>
        {ultimos.length === 0 ? (
          <Empty icon="⇄" text="Todavía no anotaste nada. Probá con el botón de arriba o mandale un mensaje a Manguito." />
        ) : (
          <div className="ranking">
            {ultimos.map((t) => (
              <div className="rank" key={t.id}>
                <span className="rank-ico">{icono(t.category)}</span>
                <span className="rank-txt">
                  <span className="rank-nombre">{t.description}</span>
                  <span className="rank-meta">{dayLabel(t.date)} · {t.category}</span>
                </span>
                <span className="rank-tag">{t.platform || 'Web'}</span>
                <span className={`rank-monto monto-sensible ${t.amount > 0 ? 'positivo' : ''}`}>
                  {money(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
