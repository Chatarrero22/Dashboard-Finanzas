/**
 * Gastos en dólares.
 *
 * Regla: el monto se guarda SIEMPRE en pesos, al cambio del día en que lo
 * cargaste. Si el 19 de agosto gastaste US$50 con el MEP a 1.524, eso fueron
 * $76.200 y va a seguir siendo $76.200 para siempre. Que el dólar suba después
 * no cambia lo que te salió ese día, y si lo recalculáramos, todos tus meses
 * viejos cambiarían solos cada vez que se mueve el dólar.
 *
 * Guardamos aparte cuántos dólares eran y a qué cambio, para poder mostrarlo
 * ("US$50 al MEP de $1.524") y para que se pueda revisar.
 *
 * Ojo, no confundir con el botón ARS/US$ de la barra de arriba: ese es una
 * forma de MIRAR lo mismo, y usa la cotización de hoy. Esto es otra cosa.
 */

/*
 * Formas de escribir que un monto está en dólares.
 *
 * El orden importa: los que llevan el símbolo van PRIMERO. Si probáramos
 * "us" antes que "us$", en "Curso US$ 200" se comería solo el "US" y quedaría
 * un "$" suelto en la descripción.
 */
var EN_DOLARES = [
  /u\$s/i, /us\$/i, /\busd\b/i,
  /\bd[oó]lares?\b/i, /\bd[oó]lar\b/i,
  /\bverdes?\b/i, /\bus\b/i
];

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * ¿El texto dice que el monto está en dólares?
 * Devuelve { resto } sin esa palabra, o null.
 */
function detectar(texto) {
  var t = String(texto || '');
  for (var i = 0; i < EN_DOLARES.length; i++) {
    var m = t.match(EN_DOLARES[i]);
    if (!m) continue;
    // "dolar blue" o "dolar hoy" es una pregunta, no un gasto en dólares.
    var despues = normalizar(t.slice(m.index + m[0].length, m.index + m[0].length + 8));
    if (/^\s*(blue|mep|hoy|oficial)/.test(despues)) continue;

    var resto = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length))
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { resto: resto };
  }
  return null;
}

/**
 * Pasa un monto en dólares a pesos.
 * Devuelve { pesos, usd, cambio } o null si no hay cotización.
 */
function aPesos(usd, cotizacion) {
  var cambio = Number(cotizacion) || 0;
  if (!cambio) return null;
  var monto = Number(usd) || 0;
  return {
    // Redondeamos a peso: nadie paga centavos de peso.
    pesos: Math.round(monto * cambio),
    usd: monto,
    cambio: cambio
  };
}

module.exports = { detectar: detectar, aPesos: aPesos };
