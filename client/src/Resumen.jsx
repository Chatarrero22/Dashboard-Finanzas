/**
 * Pantalla de Resumen, copiada del diseño de Claude Design.
 *
 * El orden de los bloques es el del diseño y no es casual: primero el número
 * grande del mes con los cuatro KPI al costado, después la proyección, después
 * a dónde va la plata y la tendencia, y abajo el detalle.
 */
import { useEffect, useState } from 'react'
import { money, monthLabel, mesNombre, dayLabel, icono, Empty } from './comunes.jsx'
import Numero from './Numero.jsx'

const COLORES = [
  'var(--accent)', 'var(--blue)', 'var(--good)',
  'var(--yellow)', 'var(--critical)', 'var(--text-tertiary)',
]

/* ------------------------------------------------------------ el número */

function Titular({ dashboard, mes, onGo, esMesActual }) {
  const neto = dashboard.income - dashboard.expense
  // Lo que ya mandaste a ahorro, a invertir o a comprar titulos este mes.
  const apartado = dashboard.apartado || 0
  const potes = dashboard.potes
  const libre = neto - apartado

  /*
   * EN EL MES DE HOY arriba va lo que TENES. En un mes pasado, como te fue.
   *
   * El numero grande decia «Resultado de octubre» y era ingresos menos
   * gastos: un flujo. Emanuel pregunto cuatro veces por que no coincidia con
   * su plata, y la ultima lo dijo derecho: «es medio confuso porque capaz
   * usas plata disponible del mes pasado e igual te aparece que este mes
   * estas negativo».
   *
   * Tenia razon: arriba de todo tiene que estar el numero que puede
   * verificar mirando el banco.
   *
   * Pero en un mes pasado «Disponible» seria el saldo de HOY, que no tiene
   * nada que ver con el mes que estas mirando, y volveria a confundir. Por
   * eso al viajar al pasado el titular cambia a como te fue ESE mes, que es
   * justo la pregunta que uno se hace mirando un mes cerrado.
   */
  const disponible = potes ? potes.liquidez : 0
  const enRojo = esMesActual ? disponible < 0 : neto < 0

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
        <div className="titular-label">
          {esMesActual ? 'Disponible' : `Resultado de ${mesNombre(mes)}`}
        </div>
        <Numero
          className={`titular-num monto-sensible ${enRojo ? 'negativo' : 'positivo'}`}
          valor={esMesActual ? disponible : neto}
        />

        {/* En el mes de hoy, de qué está hecho ese número. */}
        {esMesActual && potes && (
          <div className="titular-reparto">
            <span>
              Lo que tenés en tus cuentas para usar
              {potes.ahorro > 0 && <>, más <b className="monto-sensible">{money(potes.ahorro)}</b> en Ahorro</>}
            </span>
            {potes.deudaTarjeta > 0 && (
              <span>
                Debés <b className="monto-sensible">{money(potes.deudaTarjeta)}</b> de tarjeta,
                que sale cuando pagues el resumen
              </span>
            )}
          </div>
        )}

        {/* En un mes pasado, cuánto de lo que te quedó ya tenía destino. */}
        {!esMesActual && apartado > 0 && (
          <div className="titular-reparto">
            <span>
              Apartaste <b className="monto-sensible">{money(apartado)}</b>
              {' '}para ahorrar o invertir
            </span>
            <span className={libre < 0 ? 'mal' : ''}>
              {libre >= 0
                ? <>Te quedaron <b className="monto-sensible">{money(libre)}</b> sin destino</>
                : <>Apartaste <b className="monto-sensible">{money(-libre)}</b> más de lo que ahorraste: salió de lo que traías</>}
            </span>
          </div>
        )}

        <div className="titular-pie">
          <span className={`titular-chip ${enRojo || pctGastado == null ? 'mal' : 'ok'}`}>{chip}</span>
          <span className="titular-movs">
            {dashboard.count} {dashboard.count === 1 ? 'movimiento' : 'movimientos'}
            {esMesActual ? ' este mes' : ' ese mes'}
          </span>
          {esMesActual && onGo && (
            <button className="titular-link" onClick={() => onGo('patrimonio')}>Ver dónde está</button>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- los KPI */

function Kpis({ dashboard, esMesActual }) {
  const pctAhorro = dashboard.income > 0
    ? Math.round(((dashboard.income - dashboard.expense) / dashboard.income) * 100)
    : null

  /*
   * El resultado del mes bajo del titular a acá.
   *
   * Sigue siendo un dato util -decirte si gastaste mas de lo que entro- pero
   * arriba de todo y en grande parecia «tu plata» y no lo es. Acá, al lado de
   * Entró y Salió, se lee como lo que es: la resta de esos dos.
   *
   * El «Promedio por día» se fue: nadie decide nada con eso.
   */
  const neto = dashboard.income - dashboard.expense

  const items = [
    { label: 'Entró', numero: dashboard.income, pie: 'ingresos del mes', color: 'var(--good)' },
    { label: 'Salió', numero: dashboard.expense, pie: `${dashboard.count} movimientos`, color: 'var(--accent)' },
    { label: 'Ahorro', valor: pctAhorro == null ? '—' : `${pctAhorro}%`, pie: 'del ingreso', color: 'var(--blue)' },
  ]

  // En un mes pasado el titular YA es el resultado: repetirlo seria decir dos
  // veces lo mismo en la misma pantalla.
  if (esMesActual) {
    items.push({
      label: 'Resultado',
      numero: neto,
      pie: 'entró menos salió',
      color: neto < 0 ? 'var(--critical)' : 'var(--yellow)',
    })
  }

  return (
    <div className="kpi-grid">
      {items.map((k) => (
        <div className="kpi-chico" key={k.label}>
          <div className="kpi-chico-top">
            <span className="kpi-punto" style={{ background: k.color }} />
            <span className="kpi-chico-label">{k.label}</span>
          </div>
          {k.numero != null
            ? <Numero className="kpi-chico-valor monto-sensible" valor={k.numero} />
            : <div className="kpi-chico-valor monto-sensible">{k.valor}</div>}
          <div className="kpi-chico-pie">{k.pie}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------- a dónde va la plata */

function ADondeVa({ cats, elegida, onElegir }) {
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
        {/* Tocar una categoría abre lo que la compone en el ranking de al
            lado. Es un <button> y no un <div> con onClick: se llega con el
            teclado y el lector de pantalla lo anuncia como lo que es. */}
        {top.map((c, i) => (
          <button
            type="button"
            className={`adonde-item ${elegida === c.category ? 'elegida' : ''}`}
            key={c.category}
            aria-pressed={elegida === c.category}
            onClick={() => onElegir(elegida === c.category ? null : c.category)}
          >
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
          </button>
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

  /*
   * La categoría abierta. Tocar «Gustitos» en la torta muestra abajo los
   * gastos de Gustitos, de mayor a menor: la pregunta que sigue a «¿a dónde
   * va la plata?» es siempre «¿en qué?», y antes había que ir a otra pantalla
   * y filtrar a mano.
   */
  const [abierta, setAbierta] = useState(null)

  // Si cambiás de mes, la categoría abierta puede ya no existir.
  const catsNombres = cats.map((c) => c.category).join('|')
  useEffect(() => {
    setAbierta((a) => (a && catsNombres.split('|').includes(a) ? a : null))
  }, [catsNombres])

  const delMes = dashboard.gastosDelMes || []
  const top = abierta
    ? delMes.filter((g) => g.category === abierta)
    : (dashboard.topExpenses || [])
  const ultimos = (transactions || []).slice(0, 5)
  const diaDeHoy = new Date().getDate()
  const promedio = dashboard.expense / Math.max(Math.min(diaDeHoy, dashboard.diasDelMes || 31), 1)
  // Si el mes que mirás es el de hoy, el titular puede hablar de tu plata.
  // En uno pasado no: ese saldo es de hoy y no tiene que ver con ese mes.
  const esMesActual = mes === new Date().toISOString().slice(0, 7)

  return (
    <>
      {/* fila 1: el número grande + los cuatro KPI */}
      <div className="fila-titular">
        <Titular dashboard={dashboard} mes={mes} onGo={onGo} esMesActual={esMesActual} />
        <Kpis dashboard={dashboard} esMesActual={esMesActual} />
      </div>

      {/* fila 2: a dónde va la plata + tendencia */}
      <div className="fila-dos">
        <section className="card">
          <div className="card-rotulo">A DÓNDE VA LA PLATA</div>
          <ADondeVa cats={cats} elegida={abierta} onElegir={setAbierta} />
          {cats.length > 0 && (
            <p className="hint adonde-pista">
              {abierta
                ? `Estás viendo los gastos de ${abierta}. Tocala de nuevo para ver todo.`
                : 'Tocá una categoría para ver en qué se te fue.'}
            </p>
          )}
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
          <div className="card-rotulo-fila">
            <span className="card-rotulo">
              {abierta ? `GASTOS EN ${abierta.toUpperCase()}` : 'LOS 5 GASTOS MÁS GRANDES'}
            </span>
            {abierta && (
              <button className="chip" onClick={() => setAbierta(null)}>Ver todos</button>
            )}
          </div>
          {top.length === 0 ? (
            <Empty icon="◔" text={abierta ? `Sin gastos en ${abierta} este mes.` : 'Sin gastos este mes.'} />
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
