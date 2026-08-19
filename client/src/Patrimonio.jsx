/**
 * Patrimonio: el total y de qué está hecho.
 *
 * Sigue el diseño: tarjeta grande con degradado y el resplandor que se mueve,
 * la píldora de variación arriba a la derecha, y abajo la rueda de porciones
 * junto a la lista "De qué está hecho".
 *
 * Los datos salen de /api/networth.
 */
import { money, Empty } from './comunes.jsx'
import Numero from './Numero.jsx'

const COLORES = ['var(--accent)', 'var(--good)', 'var(--blue)', 'var(--yellow)']

/** Rueda de porciones. La animación de entrada la barre hacia su lugar. */
function Rueda({ partes, total }) {
  let desde = 0
  const tramos = partes.map((p, i) => {
    const hasta = desde + p.pct
    const t = `${COLORES[i % COLORES.length]} ${desde}% ${hasta}%`
    desde = hasta
    return t
  })

  // Un total en cero deja el conic-gradient vacío y se ve un anillo roto:
  // en ese caso pintamos el aro apagado y listo.
  const fondo = partes.length ? `conic-gradient(${tramos.join(', ')})` : 'var(--border)'

  return (
    <div className="rueda-caja">
      <div className="rueda">
        {/* El aro y el centro van separados a proposito: la animacion rota
            SOLO el aro. Si rotaran juntos, el texto del medio entraria
            torcido; y si el centro se desvaneciera, durante la animacion la
            rueda se veria como un disco lleno en vez de un anillo. */}
        <div className="rueda-aro" style={{ background: fondo }} />
        <div className="rueda-centro">
          <span className="rueda-label">TOTAL</span>
          <span className="rueda-total monto-sensible">{money(total)}</span>
        </div>
      </div>
    </div>
  )
}

/** La píldora de variación de los últimos 30 días. */
function Variacion({ cambio, total }) {
  if (cambio == null || cambio === 0) return null

  const antes = total - cambio
  // Si antes era cero o cambió de signo, el porcentaje no significa nada.
  const pct = antes > 0 ? (cambio / antes) * 100 : null
  const sube = cambio > 0

  return (
    <span className={`variacion-pill ${sube ? 'ok' : 'mal'}`}>
      {sube ? '↗' : '↘'} {money(cambio, { sign: true })}
      {pct != null && ` · ${Math.abs(pct).toFixed(1).replace('.', ',')}%`} en 30 días
    </span>
  )
}

export default function PatrimonioScreen({ networth }) {
  if (!networth) return <div className="spinner" />

  const total = networth.total || 0

  // Solo mostramos lo que tiene plata: una porción de $0 no dice nada.
  const partes = [
    {
      nombre: 'En pesos',
      meta: 'Saldo de todos tus movimientos',
      monto: networth.cash,
    },
    {
      nombre: 'Cripto',
      meta: networth.pricesAvailable
        ? `US$${Math.round(networth.cryptoUsd).toLocaleString('es-AR')} a ${networth.dolarNombre || 'MEP'}`
        : 'Sin precios ahora mismo',
      monto: networth.cryptoArs,
    },
  ].filter((p) => Math.abs(p.monto) > 0)

  // El porcentaje se calcula sobre la suma de valores absolutos: si el saldo
  // en pesos es negativo, un porcentaje sobre el total daría cualquier cosa.
  const base = partes.reduce((a, p) => a + Math.abs(p.monto), 0) || 1
  const conPct = partes.map((p) => ({ ...p, pct: (Math.abs(p.monto) / base) * 100 }))

  return (
    <>
      <div className="titular patrimonio-titular">
        <div className="titular-brillo" />
        <div className="titular-txt patrimonio-cabeza">
          <div>
            <div className="titular-label">Patrimonio total</div>
            <Numero className="patrimonio-num monto-sensible" valor={total} />
          </div>
          <Variacion cambio={networth.cambio30} total={total} />
        </div>
      </div>

      {conPct.length === 0 ? (
        <section className="card">
          <Empty icon="▦" text="Todavía no hay nada que sumar. Anotá un movimiento o cargá cripto." />
        </section>
      ) : (
        <div className="patrimonio-grid">
          <section className="card">
            <Rueda partes={conPct} total={total} />
          </section>

          <section className="card">
            <div className="card-rotulo">DE QUÉ ESTÁ HECHO</div>
            <div className="partes">
              {conPct.map((p, i) => (
                <div className="parte" key={p.nombre} style={{ animationDelay: `${0.08 + i * 0.07}s` }}>
                  <span className="parte-punto" style={{ background: COLORES[i % COLORES.length] }} />
                  <div className="parte-txt">
                    <div className="parte-nombre">{p.nombre}</div>
                    <div className="parte-meta">{p.meta}</div>
                  </div>
                  <div className="parte-pct">{Math.round(p.pct)}%</div>
                  <div className={`parte-monto monto-sensible ${p.monto < 0 ? 'negativo' : ''}`}>
                    {money(p.monto)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!networth.pricesAvailable && (
        <p className="hint">
          No pude traer los precios de cripto ahora mismo, así que el total es solo
          la parte en pesos.
        </p>
      )}
    </>
  )
}
