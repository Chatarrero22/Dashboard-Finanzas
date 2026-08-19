/**
 * Compras en cuotas.
 *
 * En Argentina esto no es un detalle: si comprás algo de $600.000 en 6 cuotas,
 * no gastaste $600.000 en agosto. Te sale $100.000 por mes durante medio año,
 * y eso es lo que tenés que ver para saber si te alcanza.
 *
 * Cómo se guarda: una fila por cuota, cada una con su fecha. Así cae sola en
 * el mes y en el resumen de tarjeta que corresponde, y ninguna consulta de
 * la app tiene que enterarse de que existen las cuotas. Las tres columnas
 * (grupo, número, total) sirven para mostrarlas juntas y poder borrar el plan.
 *
 * El redondeo va todo a la última cuota: si $10.000 en 3 no da exacto, van
 * 3333,33 + 3333,33 + 3333,34. La suma tiene que dar el total, siempre.
 */
var crypto = require('crypto');

/** Suma meses cuidando los meses cortos: el 31 de enero + 1 mes es el 28/02. */
function sumarMeses(iso, meses) {
  var partes = String(iso).split('-');
  var anio = Number(partes[0]);
  var mes = Number(partes[1]) - 1;
  var dia = Number(partes[2]);

  var ultimo = new Date(anio, mes + meses + 1, 0).getDate();
  var d = new Date(anio, mes + meses, Math.min(dia, ultimo));

  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Redondea a centavos, para no arrastrar decimales infinitos. */
function centavos(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Parte un movimiento en N cuotas.
 * Devuelve el array de movimientos listos para guardar.
 */
function partir(tx, cantidad) {
  var n = Math.floor(Number(cantidad) || 1);
  if (n < 2) return [tx];
  if (n > 60) n = 60; // más de 5 años no es una cuota, es un error de tipeo

  var total = Number(tx.amount) || 0;
  var signo = total < 0 ? -1 : 1;
  var absoluto = Math.abs(total);

  var porCuota = centavos(absoluto / n);
  var grupo = crypto.randomBytes(8).toString('hex');
  var base = String(tx.description || '').trim();

  var filas = [];
  for (var i = 0; i < n; i++) {
    // La última se lleva la diferencia del redondeo.
    var monto = i === n - 1
      ? centavos(absoluto - porCuota * (n - 1))
      : porCuota;

    filas.push(Object.assign({}, tx, {
      date: sumarMeses(tx.date, i),
      description: base + ' (cuota ' + (i + 1) + '/' + n + ')',
      amount: signo * monto,
      installment_group: grupo,
      installment_num: i + 1,
      installment_total: n,
      // Los items del ticket van solo en la primera: si no, se multiplican.
      items: i === 0 ? (tx.items || []) : []
    }));
  }

  return filas;
}

/**
 * "en 6 cuotas", "6 cuotas", "en cuotas de 3", "3x".
 * Devuelve { cantidad, resto } o null. `resto` es el texto sin esa parte,
 * para que no quede "Lavarropas en 6 cuotas" como descripción.
 */
function detectar(texto) {
  var t = String(texto || '');

  var patrones = [
    /\ben\s+(\d{1,2})\s*cuotas?\b/i,
    /\b(\d{1,2})\s*cuotas?\b/i,
    /\bcuotas?\s+de\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s*x\b/i
  ];

  for (var i = 0; i < patrones.length; i++) {
    var m = t.match(patrones[i]);
    if (m) {
      var cantidad = parseInt(m[1], 10);
      if (cantidad < 2 || cantidad > 60) continue;
      var resto = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length))
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.])/g, '$1')
        .trim();
      return { cantidad: cantidad, resto: resto };
    }
  }

  return null;
}

module.exports = { partir: partir, detectar: detectar, sumarMeses: sumarMeses };
