/**
 * SALE DE TU CUENTA ESTE MES.
 *
 * «Salió» del Resumen dice cuánto GASTASTE: el gasto se anota el día de la
 * compra, que es lo correcto para las categorías, los presupuestos y el P&L.
 * Pero con tarjeta esa plata todavía está en el banco. Compraste en octubre y
 * la plata se va en noviembre.
 *
 * O sea que la pregunta «¿cuánta plata me sale de acá a fin de mes?» no la
 * contesta ningún número de la app, y es la que uno se hace para saber si
 * llega. Esto la contesta.
 *
 * Se cuenta por la fecha en que la plata SE VA, no por la fecha de la compra:
 *
 *   - lo que NO es tarjeta, de este mes. Débito y efectivo salen en el
 *     momento, así que la fecha de la compra ya es la fecha en que salió.
 *   - los resúmenes de tarjeta que VENCEN este mes, estén marcados como
 *     pagados o no. Los pagados ya salieron; los otros faltan.
 *   - los resúmenes que vencieron antes y siguen sin marcar: esa plata tiene
 *     que salir igual, y si no se cuenta acá no se cuenta en ningún lado.
 *
 * TODO SE ANCLA AL VENCIMIENTO, nunca a `card_payments.paid_on`. Esto es a
 * propósito y no es un detalle: «Pagué todos» marca resúmenes viejos con la
 * fecha de HOY, así que mirando `paid_on` un año de resúmenes pagados en la
 * vida real aparecería como un millón saliendo este mes. El vencimiento es un
 * hecho del resumen; `paid_on` es cuándo alguien apretó el botón.
 *
 * Lo que queda afuera a propósito:
 *
 *   - Los `Traspaso`. Mover plata entre tus cuentas no es plata que se te va,
 *     y comprar un título tampoco: cambiás pesos por un bono, lo seguís
 *     teniendo. Es el mismo criterio que usa todo el resto de la app.
 *   - El `Saldo inicial`, que es plata que ya era tuya y la app no sabía.
 *   - Un `Ajuste` NEGATIVO sí cuenta: es plata que se fue y no se cargó.
 *     (Un `Ajuste` positivo no puede entrar: acá solo miramos los negativos.)
 */
var db_module = require('./db.js');
var db = db_module.db;
var tarjetas = require('./tarjetas.js');

function aISO(d) {
  return d.toISOString().slice(0, 10);
}

/** El último día de ese mes, como fecha ISO. */
function finDeMes(month) {
  var y = Number(month.slice(0, 4));
  var m = Number(month.slice(5, 7));
  var dias = new Date(y, m, 0).getDate();
  return month + '-' + String(dias).padStart(2, '0');
}

/*
 * Lo que no es tarjeta se va el día de la compra.
 *
 * No se filtra por `category NOT IN (...)` nada más: tiene que quedar afuera
 * el traspaso (incluido el que compra un título, que lleva `asset_id`) porque
 * esa plata no se te fue, cambió de forma.
 */
var SIN_TARJETA =
  ' AND card_id IS NULL' +
  " AND category NOT IN ('Traspaso','Saldo inicial')";

/**
 * Cuánta plata sale de tus cuentas en `month`, partida en lo que ya salió y
 * lo que falta.
 *
 * Solo tiene sentido en el mes en curso: la raya entre «ya salió» y «falta
 * salir» es hoy. En un mes cerrado no hay nada que avisar y la pantalla no lo
 * muestra, así que devuelve null y nadie tiene que acordarse de esconderlo.
 */
function delMes(userId, month, hoy) {
  var hoyISO = hoy || aISO(new Date());
  if (month !== hoyISO.slice(0, 7)) return null;

  var desdeMes = month + '-01';
  var hastaMes = finDeMes(month);

  var sinTarjeta = db.prepare(
    'SELECT COALESCE(SUM(ABS(amount)),0) total, COUNT(*) n FROM transactions' +
    ' WHERE user_id = ? AND amount < 0' + SIN_TARJETA +
    ' AND substr(date,1,7) = ? AND date <= ?'
  ).get(userId, month, hoyISO);

  // Un gasto que no es tarjeta con fecha de más adelante en el mes: una cuota
  // sin tarjeta, un fijo que todavía no se cobró.
  var sinTarjetaPorVenir = db.prepare(
    'SELECT COALESCE(SUM(ABS(amount)),0) total, COUNT(*) n FROM transactions' +
    ' WHERE user_id = ? AND amount < 0' + SIN_TARJETA +
    ' AND substr(date,1,7) = ? AND date > ?'
  ).get(userId, month, hoyISO);

  var yaSalio = sinTarjeta.total;
  var faltaSalir = sinTarjetaPorVenir.total;
  var atrasado = 0;
  var detalle = [];
  // Los resúmenes que están abiertos y vencen DESPUÉS de este mes. No entran
  // en la cuenta, y hay que decirlo: si no, el número de arriba parece que se
  // olvidó de la tarjeta.
  var masAdelante = [];

  var filas = db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY id').all(userId);

  filas.forEach(function (t) {
    tarjetas.resumenes(userId, t, hoyISO).forEach(function (r) {
      if (r.monto <= 0) return;

      var venceEsteMes = r.vence >= desdeMes && r.vence <= hastaMes;
      var vencioAntes = r.vence < desdeMes;

      if (venceEsteMes) {
        /*
         * Un resumen que vencio el 10 y hoy es 14 esta atrasado, aunque
         * venza este mismo mes. «Atrasado» es por la fecha, no por el mes:
         * eso es lo unico accionable y tiene que decirse asi.
         */
        var yaVencio = !r.pagado && !r.abierto && r.vence < hoyISO;

        if (r.pagado) {
          yaSalio += r.monto;
        } else {
          faltaSalir += r.monto;
          if (yaVencio) atrasado += r.monto;
        }
        detalle.push({
          tarjeta: t.name,
          monto: r.monto,
          vence: r.vence,
          venceTexto: r.venceTexto,
          cierre: r.cierre,
          pagado: r.pagado,
          // El que todavía no cerró puede crecer: lo que gastes hasta el
          // cierre entra en ese mismo resumen.
          abierto: r.abierto,
          atrasado: yaVencio
        });
        return;
      }

      // Venció antes y sigue sin marcar: esa plata tiene que salir igual.
      if (vencioAntes && !r.pagado && !r.abierto) {
        faltaSalir += r.monto;
        atrasado += r.monto;
        detalle.push({
          tarjeta: t.name,
          monto: r.monto,
          vence: r.vence,
          venceTexto: r.venceTexto,
          cierre: r.cierre,
          pagado: false,
          abierto: false,
          atrasado: true
        });
        return;
      }

      // Vence más adelante. Solo nos interesa contarlo para poder decir que
      // existe y que no está sumado acá.
      if (r.vence > hastaMes && !r.pagado) {
        masAdelante.push({
          tarjeta: t.name,
          monto: r.monto,
          venceTexto: r.venceTexto,
          abierto: r.abierto
        });
      }
    });
  });

  // El que vence antes primero: es el orden en que te va a pasar.
  detalle.sort(function (a, b) { return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0; });

  return {
    month: month,
    total: yaSalio + faltaSalir,
    yaSalio: yaSalio,
    faltaSalir: faltaSalir,
    // De lo que falta, cuánto ya tendría que haber salido.
    atrasado: atrasado,
    // Cuánto de lo que falta no es tarjeta, para poder explicar el número.
    faltaSinTarjeta: sinTarjetaPorVenir.total,
    sinTarjeta: sinTarjeta.total,
    movimientosSinTarjeta: sinTarjeta.n,
    resumenes: detalle,
    masAdelante: masAdelante,
    diasQueQuedan: Math.max(Number(hastaMes.slice(8, 10)) - Number(hoyISO.slice(8, 10)), 0)
  };
}

module.exports = {
  delMes: delMes,
  finDeMes: finDeMes
};
