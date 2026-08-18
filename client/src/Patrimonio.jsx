/**
 * Patrimonio: el total y de qué está hecho.
 * Los datos salen de /api/networth, que ya existía para la tarjeta del Resumen.
 */
import { money, Empty } from './comunes.jsx'

const COLORES = ['var(--accent)', 'var(--good)', 'var(--blue)', 'var(--yellow)']

/** Rueda de porciones hecha con conic-gradient, como en el diseño. */
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
  const fondo = partes.length
    ? `conic-gradient(${tramos.join(', ')})`
    : 'var(--border)'

  return (
    <div className="rueda-caja">
      <div className="rueda" style={{ background: fondo }}>
        <div className="rueda-centro">
          <span className="rueda-label">TOTAL</span>
          <span className="rueda-total monto-sensible">{money(total)}</span>
        </div>
      </div>
    </div>
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
        ? `US$ ${Math.round(networth.cryptoUsd).toLocaleString('es-AR')} al blue de ${money(networth.dolar)}`
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
      <div className="hero">
        <div className="label">Patrimonio total</div>
        <div className="value monto-sensible">{money(total)}</div>
        <div className="caption">
          {networth.pricesAvailable
            ? 'Pesos más cripto, valuada al dólar blue de hoy'
            : 'Solo pesos: no pude traer los precios de cripto'}
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
            <h2>De qué está hecho</h2>
            <div className="partes">
              {conPct.map((p, i) => (
                <div className="parte" key={p.nombre}>
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
    </>
  )
}
