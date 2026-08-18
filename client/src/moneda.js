/**
 * En qué moneda se muestran los montos.
 *
 * Los datos SIEMPRE se guardan en pesos: esto es solo cómo se dibujan. El
 * botón ARS/US$ de la barra de arriba cambia esto y React vuelve a dibujar
 * todo, así que no hace falta pasarlo por props a cada pantalla.
 *
 * Si no hay cotización del dólar no se puede convertir: en ese caso se
 * muestran pesos igual, que es preferible a mostrar un número inventado.
 */
export const estado = { moneda: 'ars', dolar: 0 }

export function configurar(moneda, dolar) {
  estado.moneda = moneda
  estado.dolar = Number(dolar) || 0
}

/** ¿Se puede mostrar en dólares ahora mismo? */
export function hayDolares() {
  return estado.moneda === 'usd' && estado.dolar > 0
}

/** Formatea un monto en pesos según la moneda elegida. */
export function formatear(n, { sign = false } = {}) {
  const pesos = Number(n) || 0

  if (hayDolares()) {
    const usd = pesos / estado.dolar
    // En dólares los centavos importan: $1.500 son US$0,96, no US$1.
    const txt = Math.abs(usd).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (usd < 0) return `-US$${txt}`
    return `${sign && usd > 0 ? '+' : ''}US$${txt}`
  }

  const txt = Math.abs(pesos).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  // Los negativos SIEMPRE muestran el menos: sin eso, un saldo en rojo se
  // lee igual que uno a favor.
  if (pesos < 0) return `-$${txt}`
  return `${sign && pesos > 0 ? '+' : ''}$${txt}`
}
