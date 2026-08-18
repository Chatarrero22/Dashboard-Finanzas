/**
 * Alertas: lo mismo que Manguito avisa por Telegram, pero para mirarlo.
 * Viene de /api/alertas, que es de solo lectura y no apaga los avisos del bot.
 */
import { Empty } from './comunes.jsx'

export default function AlertasScreen({ alertas }) {
  if (!alertas) return <div className="spinner" />

  if (alertas.length === 0) {
    return (
      <section className="card">
        <Empty icon="◊" text="Nada urgente por ahora. Cuando algo se salga de la línea te aviso acá y por Telegram." />
      </section>
    )
  }

  return (
    <div className="alertas">
      {alertas.map((a) => (
        <div className={`alerta ${a.tono}`} key={a.id}>
          <div className="alerta-ico">{a.ico}</div>
          <div className="alerta-txt">
            <div className="alerta-titulo">{a.titulo}</div>
            <div className="alerta-detalle monto-sensible">{a.txt}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
