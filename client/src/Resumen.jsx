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

/* -------------------------------------------- contra el mes pasado */

/*
 * La tendencia muestra seis barras y ningún número decía «vas gastando tanto
 * más que el mes pasado», que es la lectura que uno le quiere sacar al
 * gráfico. Y sobre todo: EN QUÉ subió. Una barra más alta no te hace cambiar
 * nada; «Comida +$40.000» sí.
 *
 * La comparación es contra los MISMOS días del mes pasado. Comparar el 5 de
 * octubre contra septiembre entero daría «gastás mucho menos» todos los
 * primeros de mes, que es verdad y no sirve para nada.
 */
function Comparacion({ datos }) {
  if (!datos) return null
  // Sin un mes anterior con movimientos no hay con qué comparar, y un cero no
  // es «gastaste menos»: es que no hay dato.
  if (!datos.expenseParcial && !datos.expense) return null

  const delta = datos.delta
  const subio = delta > 0
  // Menos de mil pesos de diferencia es ruido, no una tendencia.
  const igual = Math.abs(delta) < 1000
  const nombreMes = mesNombre(datos.month)

  return (
    <div className="compara">
      <span className={`compara-flecha ${igual ? '' : subio ? 'sube' : 'baja'}`}>
        {igual ? '=' : subio ? '▲' : '▼'}
      </span>
      <span className="compara-txt">
        {igual ? (
          <>Vas gastando casi lo mismo que en {nombreMes}.</>
        ) : (
          <>
            Vas gastando <strong className="monto-sensible">{money(Math.abs(delta))}</strong>
            {subio ? ' más' : ' menos'} que en {nombreMes}
            {datos.parcial ? ' a esta altura del mes' : ''}.
          </>
        )}
        {datos.subioMas && (
          <>
            {' '}Lo que más subió es <strong>{datos.subioMas.category}</strong>
            {' '}(<span className="monto-sensible">{money(datos.subioMas.delta)}</span> más).
          </>
        )}
      </span>
    </div>
  )
}

/* ------------------------------------------- sale de tu cuenta este mes */

/*
 * CUÁNTA PLATA SALE DEL BANCO ESTE MES.
 *
 * «Salió» dice cuánto gastaste, contado el día de la compra. Con tarjeta esa
 * plata todavía está en el banco: compraste en octubre y se va en noviembre.
 * Así que «¿cuánta plata me sale de acá a fin de mes?» —la pregunta que uno
 * se hace para saber si llega— no la contestaba ningún número de la app.
 *
 * No es un pronóstico: los resúmenes que vencen ya cerraron y se sabe cuánto
 * son. Por eso reemplaza a la proyección, que estiraba un promedio.
 */
function SaleEsteMes({ datos, onGo }) {
  if (!datos || datos.total <= 0) return null

  const pctSalio = datos.total > 0 ? (datos.yaSalio / datos.total) * 100 : 0

  return (
    <>
      <div className="card-rotulo-fila">
        <span className="card-rotulo">SALE DE TU CUENTA ESTE MES</span>
        {datos.diasQueQuedan > 0 && (
          <span className="card-nota">
            quedan {datos.diasQueQuedan} {datos.diasQueQuedan === 1 ? 'día' : 'días'}
          </span>
        )}
      </div>

      <Numero className="sale-total monto-sensible" valor={datos.total} />
      <div className="sale-sub">
        Es plata que se va del banco, no lo que gastaste
      </div>

      <div className="sale-barra">
        <div className="sale-fill salio" style={{ width: `${pctSalio}%` }} />
        <div className="sale-fill falta" style={{ width: `${100 - pctSalio}%` }} />
      </div>
      <div className="sale-leyenda">
        <span><i className="pt salio" />Ya salió <b className="monto-sensible">{money(datos.yaSalio)}</b></span>
        <span><i className="pt falta" />Falta <b className="monto-sensible">{money(datos.faltaSalir)}</b></span>
      </div>

      {datos.atrasado > 0 && (
        <div className="sale-aviso">
          De eso, <strong className="monto-sensible">{money(datos.atrasado)}</strong> ya venció
          y no está marcado como pagado.
          {onGo && <button className="link" onClick={() => onGo('tarjetas')}>Ir a Tarjetas →</button>}
        </div>
      )}

      <div className="sale-lista">
        {datos.resumenes.map((r) => (
          <div className="sale-fila" key={`${r.tarjeta}-${r.cierre}`}>
            <span className="sale-nombre">
              {r.tarjeta}
              <span className="sale-meta">
                {r.abierto ? 'cierra y vence el ' : 'vence el '}{r.venceTexto}
              </span>
            </span>
            <span className={`sale-chip ${r.atrasado ? 'mal' : r.pagado ? 'ok' : 'falta'}`}>
              {r.atrasado ? 'venció' : r.pagado ? 'pagado' : 'falta'}
            </span>
            <span className="sale-monto monto-sensible">{money(r.monto)}</span>
          </div>
        ))}

        {datos.sinTarjeta > 0 && (
          <div className="sale-fila">
            <span className="sale-nombre">
              Débito y efectivo
              <span className="sale-meta">
                {datos.movimientosSinTarjeta} {datos.movimientosSinTarjeta === 1 ? 'movimiento' : 'movimientos'},
                {' '}ya salieron
              </span>
            </span>
            <span className="sale-chip ok">pagado</span>
            <span className="sale-monto monto-sensible">{money(datos.sinTarjeta)}</span>
          </div>
        )}
      </div>

      {/* Lo que NO entra en el número, dicho a propósito: si no, parece que la
          cuenta se olvidó de la tarjeta. */}
      {datos.masAdelante.length > 0 && (
        <p className="hint">
          No entra acá:{' '}
          {datos.masAdelante.map((r, i) => (
            <span key={`${r.tarjeta}-${i}`}>
              {i > 0 && ' · '}
              {r.tarjeta} <span className="monto-sensible">{money(r.monto)}</span>, vence el {r.venceTexto}
            </span>
          ))}
        </p>
      )}
    </>
  )
}

/* ------------------------------------------------- topes y metas */

/*
 * Los presupuestos y las metas YA venían en el dashboard y la pantalla los
 * tiraba a la basura: el servidor los calculaba en cada carga y nadie los
 * leía. Si tenés tope de Comida y vas al 90%, eso tiene que estar donde
 * mirás todos los días, no en una solapa a la que entrás una vez por mes.
 *
 * Van ordenados por lo pasado que está cada uno, no alfabético: lo que te
 * tiene que saltar a la vista es lo que te estás por comer.
 */
function TopesYMetas({ budgets, metas, onGo }) {
  const topes = (budgets || []).slice().sort((a, b) => b.pct - a.pct)
  const goles = metas || []
  if (!topes.length && !goles.length) return null

  return (
    <>
      <div className="card-rotulo-fila">
        <span className="card-rotulo">
          {topes.length ? 'TUS TOPES DEL MES' : 'TUS METAS'}
        </span>
        <button className="link" onClick={() => onGo(topes.length ? 'presu' : 'metas')}>
          Ver todos →
        </button>
      </div>

      {topes.length > 0 && (
        <div className="topes">
          {topes.map((b) => (
            <div className="tope" key={b.id}>
              <div className="tope-head">
                <span className="tope-nombre">{icono(b.category)} {b.category}</span>
                <span className="tope-monto monto-sensible">
                  {money(b.spent)} <span className="tope-de">de {money(b.monthly_limit)}</span>
                </span>
              </div>
              <div className="tope-track">
                <div
                  className={`tope-fill ${b.status}`}
                  style={{ width: `${Math.min(b.pct, 100)}%` }}
                />
              </div>
              <div className={`tope-pie ${b.status}`}>
                {b.remaining >= 0
                  ? <>Te quedan <span className="monto-sensible">{money(b.remaining)}</span></>
                  : <>Te pasaste <span className="monto-sensible">{money(-b.remaining)}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}

      {goles.length > 0 && (
        <div className="metas-mini">
          {topes.length > 0 && <div className="card-rotulo">TUS METAS</div>}
          {goles.map((g) => (
            <div className="meta-mini" key={g.id}>
              <div className="tope-head">
                <span className="tope-nombre">{g.name}</span>
                <span className="tope-monto monto-sensible">
                  {money(g.saved)} <span className="tope-de">de {money(g.target)}</span>
                </span>
              </div>
              <div className="tope-track">
                <div className="tope-fill meta" style={{ width: `${g.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* --------------------------------------------------------- gasto por día */

function GastoPorDia({ byDay, promedio, elegido, onElegir }) {
  if (!byDay || !byDay.length) return null
  const max = Math.max(...byDay.map((d) => d.total), 1)

  return (
    <>
      {/* Cada día es un <button>: tocarlo abre lo que gastaste ese día en el
          ranking de al lado, igual que la torta. La pregunta que sigue a «ese
          día gasté un montón» es siempre «¿en qué?». Los días sin gastos no
          se pueden tocar: no hay nada que abrir. */}
      <div className="dias-graf">
        {byDay.map((d) => (
          <button
            type="button"
            key={d.dia}
            disabled={d.total === 0}
            aria-pressed={elegido === d.dia}
            className={`dia-barra ${d.total === 0 ? 'vacio' : d.total > max * 0.5 ? 'fuerte' : 'flojo'}`
              + (elegido === d.dia ? ' elegido' : '')}
            style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }}
            title={`${d.dia}: ${money(d.total)}`}
            aria-label={`Día ${d.dia}: ${money(d.total)}`}
            onClick={() => onElegir(elegido === d.dia ? null : d.dia)}
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
  /*
   * UN solo filtro abierto a la vez: una categoria o un dia.
   *
   * Los dos contestan la misma pregunta -«¿en que se me fue?»- y los dos
   * usan el mismo ranking de abajo. Con dos estados sueltos se podian pisar
   * y mostrar algo que no era ni una cosa ni la otra.
   */
  const [filtro, setFiltro] = useState(null)
  const abierta = filtro && filtro.tipo === 'categoria' ? filtro.valor : null
  const diaAbierto = filtro && filtro.tipo === 'dia' ? filtro.valor : null

  // Si cambiás de mes, lo que tenías abierto puede ya no existir.
  const catsNombres = cats.map((c) => c.category).join('|')
  useEffect(() => { setFiltro(null) }, [catsNombres, mes])

  const delMes = dashboard.gastosDelMes || []
  const top = abierta
    ? delMes.filter((g) => g.category === abierta)
    : diaAbierto
      ? delMes.filter((g) => Number(String(g.date).slice(8, 10)) === diaAbierto)
      : (dashboard.topExpenses || [])

  const tituloRanking = abierta
    ? `GASTOS EN ${abierta.toUpperCase()}`
    : diaAbierto
      ? `GASTOS DEL ${diaAbierto} DE ${mesNombre(mes).toUpperCase()}`
      : 'LOS 5 GASTOS MÁS GRANDES'
  const ultimos = (transactions || []).slice(0, 5)
  const diaDeHoy = new Date().getDate()
  const promedio = dashboard.expense / Math.max(Math.min(diaDeHoy, dashboard.diasDelMes || 31), 1)
  // Si el mes que mirás es el de hoy, el titular puede hablar de tu plata.
  // En uno pasado no: ese saldo es de hoy y no tiene que ver con ese mes.
  const esMesActual = mes === new Date().toISOString().slice(0, 7)

  /*
   * Los dos bloques que pueden no estar: lo que sale del banco (solo en el
   * mes de hoy) y los topes (solo si cargaste alguno).
   *
   * Se arman en una lista porque `.fila-dos` es una grilla de dos columnas:
   * con un solo hijo la tarjeta quedaría a media pantalla con un hueco al
   * lado. Si hay uno solo va a lo ancho, como cualquier otra sección.
   */
  const bloques = []
  if (esMesActual && dashboard.saleEsteMes && dashboard.saleEsteMes.total > 0) {
    bloques.push(
      <section className="card" key="sale">
        <SaleEsteMes datos={dashboard.saleEsteMes} onGo={onGo} />
      </section>
    )
  }
  if ((dashboard.budgets || []).length > 0 || (dashboard.goals || []).length > 0) {
    bloques.push(
      <section className="card" key="topes">
        <TopesYMetas budgets={dashboard.budgets} metas={dashboard.goals} onGo={onGo} />
      </section>
    )
  }

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
          <ADondeVa
            cats={cats}
            elegida={abierta}
            onElegir={(c) => setFiltro(c ? { tipo: 'categoria', valor: c } : null)}
          />
          {cats.length > 0 && (
            <p className="hint adonde-pista">
              {abierta
                ? `Estás viendo los gastos de ${abierta}. Tocala de nuevo para ver todo.`
                : 'Tocá una categoría para ver en qué se te fue.'}
            </p>
          )}
        </section>

        <section className="card card-tendencia">
          <div className="card-rotulo-fila">
            <span className="card-rotulo">TENDENCIA · 6 MESES</span>
            <span className="leyenda">
              <span><i className="pt ing" />Ingresos</span>
              <span><i className="pt egr" />Gastos</span>
            </span>
          </div>
          <Tendencia meses={dashboard.byMonth} mesActual={mes} />
          <Comparacion datos={dashboard.comparacion} />
        </section>
      </div>

      {/* fila 3: lo que sale del banco este mes + los topes */}
      {bloques.length === 2
        ? <div className="fila-dos pareja">{bloques}</div>
        : bloques}

      {/* fila 3: top 5 gastos + gasto por día */}
      <div className="fila-dos pareja">
        <section className="card">
          <div className="card-rotulo-fila">
            <span className="card-rotulo">
              {tituloRanking}
            </span>
            {filtro && (
              <button className="chip" onClick={() => setFiltro(null)}>Ver todos</button>
            )}
          </div>
          {top.length === 0 ? (
            <Empty icon="◔" text={filtro ? 'Sin gastos acá.' : 'Sin gastos este mes.'} />
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
          <GastoPorDia
            byDay={dashboard.byDay}
            promedio={promedio}
            elegido={diaAbierto}
            onElegir={(d) => setFiltro(d ? { tipo: 'dia', valor: d } : null)}
          />

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
