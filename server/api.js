var express = require('express');
var multer = require('multer');
var path = require('path');
var fs = require('fs');

var db_module = require('./db.js');
var db = db_module.db;

var auth = require('./auth.js');
var cat = require('./categorizer.js');
var parsers = require('./parsers.js');
var prices = require('./prices.js');
var fijos = require('./fijos.js');
var arbol = require('./arbol.js');
var alertasPantalla = require('./alertas-pantalla.js');
var texto = require('./texto.js');
var aprendido = require('./aprendido.js');
var tarjetas = require('./tarjetas.js');
var cuotas = require('./cuotas.js');
var medioDePago = require('./medio-de-pago.js');
var dolares = require('./dolares.js');

var router = express.Router();

var UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
var upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 15 * 1024 * 1024 } });

function mesActual() {
  return new Date().toISOString().slice(0, 10).slice(0, 7);
}

/* ============================================================ LOGIN ======= */

router.post('/login', function (req, res) {
  var resultado = auth.login(req.body.username, req.body.password);
  if (!resultado) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  auth.ponerCookie(res, resultado.session.token, resultado.session.expiresAt);
  res.json({ user: resultado.user });
});

router.post('/logout', function (req, res) {
  auth.cerrarSesion(auth.leerCookie(req, auth.COOKIE));
  auth.borrarCookie(res);
  res.json({ success: true });
});

/**
 * Primer arranque: si todavía no hay ningún usuario, cualquiera puede crear el
 * primero y queda como administrador. En cuanto existe uno, esto se cierra.
 * Sirve para no tener que entrar por consola al servidor recién desplegado.
 */
router.post('/setup', function (req, res) {
  if (auth.contarUsuarios() > 0) {
    return res.status(403).json({ error: 'La app ya tiene usuarios. Entrá con el tuyo.' });
  }
  try {
    auth.crearUsuario({
      username: req.body.username,
      displayName: req.body.display_name || req.body.username,
      password: req.body.password,
      isAdmin: true
    });
    var resultado = auth.login(req.body.username, req.body.password);
    auth.ponerCookie(res, resultado.session.token, resultado.session.expiresAt);
    res.json({ user: resultado.user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Quién soy. Sin sesión devuelve authenticated:false (no es un error). */
router.get('/me', auth.opcional, function (req, res) {
  if (!req.user) return res.json({ authenticated: false, needsSetup: auth.contarUsuarios() === 0 });
  res.json({
    authenticated: true,
    user: req.user,
    categories: cat.CATEGORIES,
    appName: process.env.APP_NAME || 'Manguito',
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    prices: Boolean(process.env.CMC_API_KEY),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN)
  });
});

router.post('/password', auth.requerido, function (req, res) {
  try {
    auth.cambiarPassword(req.user.id, req.body.password);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Alta de usuarios: solo el administrador. */
router.get('/users', auth.requerido, auth.soloAdmin, function (req, res) {
  res.json(db.prepare(
    'SELECT id, username, display_name, is_admin, simple_ui,' +
    ' (telegram_chat_id IS NOT NULL) as telegram_linked FROM users ORDER BY id'
  ).all());
});

router.post('/users', auth.requerido, auth.soloAdmin, function (req, res) {
  try {
    res.json(auth.crearUsuario({
      username: req.body.username,
      displayName: req.body.display_name || req.body.username,
      password: req.body.password,
      isAdmin: req.body.is_admin
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', auth.requerido, auth.soloAdmin, function (req, res) {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'No podés borrar tu propio usuario' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/** Código para vincular Telegram con esta cuenta. */
router.post('/telegram/code', auth.requerido, function (req, res) {
  res.json({ code: auth.generarCodigoVinculo(req.user.id) });
});

/* ===================== de acá para abajo, todo pide sesión ================ */

router.use(auth.requerido);

/* ---------------------------------------------------------------- helpers */

function insertTransactions(userId, transactions, platform) {
  var insert = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform,' +
    ' ai_categorized, card_id, installment_group, installment_num, installment_total,' +
    ' amount_usd, usd_rate)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  var insertItem = db.prepare(
    'INSERT INTO transaction_items (transaction_id, description, amount, quantity) VALUES (?, ?, ?, ?)'
  );

  var run = db.transaction(function (txs) {
    var ids = [];
    txs.forEach(function (t) {
      // La descripcion se ordena aca y no en cada pantalla: por esta funcion
      // pasan la web, el bot de Telegram y los resumenes importados.
      var desc = texto.ordenarDescripcion(t.description);
      var info = insert.run(
        userId, t.date, desc, t.amount, t.category, platform,
        t.ai_categorized ? 1 : 0, t.card_id || null,
        t.installment_group || null, t.installment_num || null, t.installment_total || null,
        t.amount_usd || null, t.usd_rate || null
      );
      ids.push(info.lastInsertRowid);
      (t.items || []).forEach(function (item) {
        insertItem.run(info.lastInsertRowid, item.description, Number(item.amount) || 0, Number(item.quantity) || 1);
      });
    });
    return ids;
  });

  return run(transactions);
}

/* ------------------------------------------------------------ movimientos */

router.get('/transactions', function (req, res) {
  var limit = Math.min(Number(req.query.limit) || 500, 2000);
  var rows = db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?'
  ).all(req.user.id, limit);

  var items = db.prepare(
    'SELECT i.* FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id WHERE t.user_id = ?'
  ).all(req.user.id);

  var byTx = {};
  items.forEach(function (i) {
    if (!byTx[i.transaction_id]) byTx[i.transaction_id] = [];
    byTx[i.transaction_id].push(i);
  });
  rows.forEach(function (r) { r.items = byTx[r.id] || []; });
  res.json(rows);
});

router.post('/transactions', async function (req, res) {
  try {
    var transactions = req.body.transactions || [req.body];
    transactions = transactions.filter(function (t) { return t && t.description && t.amount; });
    if (transactions.length === 0) {
      return res.status(400).json({ error: 'Faltan datos: descripción y monto' });
    }

    var categorized;
    if (req.body.category) {
      categorized = transactions.map(function (t) {
        return {
          date: t.date || new Date().toISOString().slice(0, 10),
          description: String(t.description).trim(),
          amount: Number(t.amount),
          category: req.body.category,
          ai_categorized: 0,
          card_id: t.card_id || req.body.card_id || null,
          items: t.items || []
        };
      });
    } else {
      // Lo que ya te aprendimos gana: no le preguntamos a la IA algo que vos
      // ya corregiste una vez.
      var sabidas = [];
      var porPreguntar = [];
      transactions.forEach(function (t, i) {
        var conocida = aprendido.buscar(req.user.id, t.description);
        if (conocida) sabidas[i] = conocida;
        else porPreguntar.push(i);
      });

      var resueltas = porPreguntar.length
        ? await cat.categorizeTransactions(porPreguntar.map(function (i) { return transactions[i]; }))
        : [];

      categorized = transactions.map(function (t, i) {
        if (sabidas[i]) {
          return {
            date: t.date || new Date().toISOString().slice(0, 10),
            description: String(t.description).trim(),
            amount: Number(t.amount),
            category: sabidas[i],
            ai_categorized: 0,
            card_id: t.card_id || req.body.card_id || null,
            items: t.items || []
          };
        }
        // Las que fueron a la IA vuelven sin la tarjeta: se la devolvemos.
        var r = resueltas[porPreguntar.indexOf(i)];
        r.card_id = t.card_id || req.body.card_id || null;
        return r;
      });
    }

    // Si el monto vino en dólares, lo pasamos a pesos al cambio de HOY y
    // guardamos los dos. El valor en pesos queda congelado: que el dólar suba
    // mañana no cambia lo que te salió hoy.
    if (req.body.moneda === 'usd') {
      var cotiz = await prices.getDolar();
      var mep = (cotiz.bolsa && cotiz.bolsa.venta) || (cotiz.blue && cotiz.blue.venta) || 0;
      if (!mep) {
        return res.status(503).json({
          error: 'No puedo traer la cotización del dólar ahora. Probá en un rato o cargalo en pesos.'
        });
      }
      categorized.forEach(function (t) {
        var conv = dolares.aPesos(Math.abs(t.amount), mep);
        var signo = t.amount < 0 ? -1 : 1;
        t.amount_usd = signo * conv.usd;
        t.usd_rate = conv.cambio;
        t.amount = signo * conv.pesos;
      });
    }

    // Con qué tarjeta se pagó. Si no viene dicho, manda la predeterminada:
    // marcar una por una es imposible cuando pagás casi todo con la misma.
    var porDefecto = tarjetas.porDefecto(req.user.id);
    var misTarjetas = tarjetas.todas(req.user.id);
    categorized.forEach(function (t, i) {
      if (req.body.card_id !== undefined) {
        t.card_id = req.body.card_id;
      } else if (!t.card_id) {
        var texto = (transactions[i] && transactions[i].description) || t.description;
        t.card_id = medioDePago.elegirTarjeta(t.amount, texto, porDefecto, misTarjetas);
      }
    });

    // Las cuotas se parten recién acá, después de categorizar: así la IA ve
    // la compra entera una sola vez y todas las cuotas quedan en la misma
    // categoría.
    var enCuotas = Number(req.body.cuotas) || 0;
    if (enCuotas > 1) {
      categorized = categorized.reduce(function (acc, t) {
        var partes = cuotas.partir(t, enCuotas);
        // Si la compra fue en dólares, cada cuota se lleva su parte también
        // en dólares: si no, la primera diría US$600 y las otras nada.
        if (t.amount_usd) {
          partes.forEach(function (parte) {
            parte.amount_usd = Math.round((t.amount_usd / enCuotas) * 100) / 100;
          });
        }
        return acc.concat(partes);
      }, []);
    }

    var ids = insertTransactions(req.user.id, categorized, req.body.platform || 'Web');
    var premio = arbol.alAnotarMovimiento(req.user.id, {});
    res.json({ success: true, count: categorized.length, ids: ids, transactions: categorized, premio: premio });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/transactions/:id', function (req, res) {
  var current = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'No existe la transacción' });

  var next = {
    // null es un valor valido: significa "sacale la tarjeta"
    card_id: req.body.card_id !== undefined ? req.body.card_id : current.card_id,
    date: req.body.date != null ? req.body.date : current.date,
    description: req.body.description != null
      ? texto.ordenarDescripcion(req.body.description) : current.description,
    amount: req.body.amount != null ? Number(req.body.amount) : current.amount,
    category: req.body.category != null ? req.body.category : current.category
  };

  db.prepare('UPDATE transactions SET date=?, description=?, amount=?, category=?, card_id=? WHERE id=? AND user_id=?')
    .run(next.date, next.description, next.amount, next.category, next.card_id, req.params.id, req.user.id);

  // Si cambiaste la categoria a mano, Manguito se lo anota: la proxima vez
  // que escribas algo parecido lo va a poner solo.
  if (req.body.category != null && req.body.category !== current.category) {
    aprendido.recordar(req.user.id, next.description, next.category);
  }

  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
});

router.delete('/transactions/:id', function (req, res) {
  // ?plan=1 borra todas las cuotas de la compra, no solo esta.
  if (req.query.plan) {
    var fila = db.prepare('SELECT installment_group FROM transactions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (fila && fila.installment_group) {
      var borradas = db.prepare('DELETE FROM transactions WHERE user_id = ? AND installment_group = ?')
        .run(req.user.id, fila.installment_group).changes;
      return res.json({ success: true, borradas: borradas });
    }
  }

  var info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  // Si no borró nada, o no existe o es de otra persona: para el que pregunta
  // es lo mismo, no confirmamos que el movimiento exista.
  if (info.changes === 0) return res.status(404).json({ error: 'No existe ese movimiento' });
  res.json({ success: true });
});

/* --------------------------------------------------------------- dashboard */

function estadoPresupuestos(userId, month) {
  var budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ? ORDER BY category').all(userId);
  var gastado = db.prepare(
    'SELECT category, SUM(ABS(amount)) total FROM transactions' +
    ' WHERE user_id = ? AND amount < 0 AND substr(date,1,7) = ? GROUP BY category'
  ).all(userId, month);

  var porCategoria = {};
  gastado.forEach(function (g) { porCategoria[g.category] = g.total; });

  return budgets.map(function (b) {
    var usado = porCategoria[b.category] || 0;
    var pct = b.monthly_limit ? (usado / b.monthly_limit) * 100 : 0;
    return {
      id: b.id,
      category: b.category,
      monthly_limit: b.monthly_limit,
      spent: usado,
      remaining: b.monthly_limit - usado,
      pct: pct,
      status: pct >= 100 ? 'pasado' : pct >= 80 ? 'cerca' : 'ok'
    };
  });
}

router.get('/dashboard', function (req, res) {
  var uid = req.user.id;
  var month = req.query.month || mesActual();

  var totals = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) income,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) expense,' +
    ' COUNT(*) count FROM transactions WHERE user_id = ?'
  ).get(uid);

  var monthTotals = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) income,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) expense,' +
    ' COUNT(*) count FROM transactions WHERE user_id = ? AND substr(date,1,7) = ?'
  ).get(uid, month);

  // Los ajustes de saldo quedan fuera del analisis por categoria: no son un
  // gasto en algo, son una correccion para que el total cierre con la realidad.
  var byCategory = db.prepare(
    'SELECT category, SUM(ABS(amount)) total, COUNT(*) count FROM transactions' +
    " WHERE user_id = ? AND amount < 0 AND category <> 'Ajuste' AND substr(date,1,7) = ?" +
    ' GROUP BY category ORDER BY total DESC'
  ).all(uid, month);

  var byMonth = db.prepare(
    'SELECT substr(date,1,7) month,' +
    ' COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) income,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) expense' +
    ' FROM transactions WHERE user_id = ? GROUP BY month ORDER BY month DESC LIMIT 6'
  ).all(uid);

  // Las suscripciones en dolares se convierten para poder sumarlas con las
  // de pesos. Se usa el ultimo cambio que tenemos cacheado, sin ir a la red:
  // este endpoint lo llama toda la app y no puede depender de una API externa.
  var subsFilas = db.prepare(
    'SELECT amount, moneda FROM subscriptions WHERE user_id = ? AND active = 1'
  ).all(uid);
  var cambioCache = prices.ultimoDolar();
  var subs = {
    n: subsFilas.length,
    total: subsFilas.reduce(function (a, s) {
      return a + (s.moneda === 'usd' ? Math.abs(s.amount) * cambioCache : Math.abs(s.amount));
    }, 0)
  };

  // Los 5 gastos mas grandes del mes, para el ranking del Resumen.
  var topExpenses = db.prepare(
    'SELECT id, date, description, category, ABS(amount) total FROM transactions' +
    " WHERE user_id = ? AND amount < 0 AND category <> 'Ajuste' AND substr(date,1,7) = ?" +
    ' ORDER BY total DESC LIMIT 5'
  ).all(uid, month);

  // Cuanto se gasto cada dia del mes. Devolvemos los 31 dias siempre (con 0
  // donde no hubo nada) para que el grafico no se deforme segun el mes.
  var porDia = db.prepare(
    'SELECT CAST(substr(date,9,2) AS INTEGER) dia, SUM(ABS(amount)) total FROM transactions' +
    ' WHERE user_id = ? AND amount < 0 AND substr(date,1,7) = ? GROUP BY dia'
  ).all(uid, month);
  var diasDelMes = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  var byDay = [];
  for (var d = 1; d <= diasDelMes; d++) byDay.push({ dia: d, total: 0 });
  porDia.forEach(function (r) { if (byDay[r.dia - 1]) byDay[r.dia - 1].total = r.total; });

  // Proyeccion: al ritmo de lo que va del mes, como cierra.
  // Solo tiene sentido en el mes en curso; en meses cerrados no proyectamos.
  var proyeccion = null;
  if (month === mesActual()) {
    var hoyDia = new Date().getDate();
    var diarioPromedio = hoyDia > 0 ? monthTotals.expense / hoyDia : 0;
    var quedan = Math.max(diasDelMes - hoyDia, 0);
    proyeccion = {
      diasQueQuedan: quedan,
      gastoProyectado: monthTotals.expense + diarioPromedio * quedan,
      netoProyectado: monthTotals.income - (monthTotals.expense + diarioPromedio * quedan),
      promedioDiario: diarioPromedio
    };
  }

  var goals = db.prepare('SELECT * FROM goals WHERE user_id = ? AND done = 0 ORDER BY id DESC LIMIT 3').all(uid);
  goals.forEach(function (g) {
    g.pct = g.target ? Math.min((g.saved / g.target) * 100, 100) : 0;
  });

  res.json({
    month: month,
    budgets: estadoPresupuestos(uid, month),
    goals: goals,
    income: monthTotals.income,
    expense: monthTotals.expense,
    balance: monthTotals.income - monthTotals.expense,
    count: monthTotals.count,
    allTime: {
      income: totals.income,
      expense: totals.expense,
      balance: totals.income - totals.expense,
      count: totals.count
    },
    byCategory: byCategory,
    byMonth: byMonth.reverse(),
    topExpenses: topExpenses,
    byDay: byDay,
    diasDelMes: diasDelMes,
    proyeccion: proyeccion,
    subscriptionsCount: subs.n,
    subscriptionsMonthly: subs.total
  });
});

/* ----------------------------------------------------------- suscripciones */

router.get('/subscriptions', function (req, res) {
  var rows = db.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY active DESC, billing_day ASC'
  ).all(req.user.id);
  var hoy = new Date();
  rows.forEach(function (s) {
    s.promo_active = Boolean(s.promo_end) && new Date(s.promo_end) >= hoy;
    s.next_price = s.promo_active && s.normal_price ? s.normal_price : s.amount;
  });
  res.json(rows);
});

router.post('/subscriptions', function (req, res) {
  var b = req.body;
  if (!b.name || b.amount == null) return res.status(400).json({ error: 'Faltan nombre y monto' });
  var info = db.prepare(
    'INSERT INTO subscriptions (user_id, name, plan, amount, category, billing_day, active,' +
    ' promo_price, promo_end, normal_price, moneda)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id, b.name, b.plan || 'Estandar', Number(b.amount), b.category || 'Servicios',
    Number(b.billing_day) || 1, b.active === false ? 0 : 1,
    Number(b.promo_price) || Number(b.amount), b.promo_end || '', Number(b.normal_price) || 0,
    b.moneda === 'usd' ? 'usd' : 'ars'
  );
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/subscriptions/:id', function (req, res) {
  var current = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'No existe la suscripción' });

  var fields = ['name', 'plan', 'amount', 'category', 'billing_day', 'active',
    'promo_price', 'promo_end', 'normal_price', 'moneda'];
  var next = {};
  fields.forEach(function (f) { next[f] = req.body[f] != null ? req.body[f] : current[f]; });

  db.prepare(
    'UPDATE subscriptions SET name=?, plan=?, amount=?, category=?, billing_day=?, active=?,' +
    ' promo_price=?, promo_end=?, normal_price=?, moneda=? WHERE id=? AND user_id=?'
  ).run(
    next.name, next.plan, Number(next.amount), next.category, Number(next.billing_day),
    next.active ? 1 : 0, Number(next.promo_price), next.promo_end, Number(next.normal_price),
    next.moneda === 'usd' ? 'usd' : 'ars',
    req.params.id, req.user.id
  );

  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id));
});

router.delete('/subscriptions/:id', function (req, res) {
  db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

/* ------------------------------------------------------------ presupuestos */

router.get('/budgets', function (req, res) {
  res.json(estadoPresupuestos(req.user.id, req.query.month || mesActual()));
});

router.post('/budgets', function (req, res) {
  var b = req.body;
  if (!b.category || b.monthly_limit == null) {
    return res.status(400).json({ error: 'Faltan la categoría y el monto' });
  }
  db.prepare(
    'INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)' +
    ' ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit'
  ).run(req.user.id, b.category, Number(b.monthly_limit));
  res.json(estadoPresupuestos(req.user.id, mesActual()));
});

router.delete('/budgets/:id', function (req, res) {
  db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

/* ------------------------------------------------------------------ metas */

router.get('/goals', function (req, res) {
  var rows = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY done ASC, id DESC').all(req.user.id);
  rows.forEach(function (g) {
    g.pct = g.target ? Math.min((g.saved / g.target) * 100, 100) : 0;
    g.remaining = Math.max(g.target - g.saved, 0);
  });
  res.json(rows);
});

router.post('/goals', function (req, res) {
  var b = req.body;
  if (!b.name || !b.target) return res.status(400).json({ error: 'Faltan el nombre y el objetivo' });
  var info = db.prepare('INSERT INTO goals (user_id, name, target, saved, deadline) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, b.name.trim(), Number(b.target), Number(b.saved) || 0, b.deadline || '');
  res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid));
});

router.post('/goals/:id/add', function (req, res) {
  var goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'No existe la meta' });

  var saved = Math.max(goal.saved + (Number(req.body.amount) || 0), 0);
  var done = saved >= goal.target ? 1 : 0;
  db.prepare('UPDATE goals SET saved = ?, done = ? WHERE id = ?').run(saved, done, req.params.id);

  var updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  updated.justCompleted = done === 1 && goal.done === 0;
  if ((Number(req.body.amount) || 0) > 0) {
    updated.premio = arbol.alSumarAMeta(req.user.id, updated.justCompleted);
  }
  res.json(updated);
});

router.delete('/goals/:id', function (req, res) {
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

/* --------------------------------------------------------------- portfolio */

router.get('/portfolio', async function (req, res) {
  try {
    var assets = db.prepare('SELECT * FROM portfolio_assets WHERE user_id = ? ORDER BY id ASC').all(req.user.id);
    var quotes = await prices.getPrices(assets.map(function (a) { return a.symbol; }));

    var totalValue = 0;
    var totalCost = 0;

    assets.forEach(function (a) {
      var quote = quotes[String(a.symbol).toUpperCase()];
      a.price = quote ? quote.price : null;
      a.change24h = quote ? quote.change24h : null;
      a.value = quote ? quote.price * a.quantity : null;
      a.cost = a.avg_price * a.quantity;
      a.pnl = a.value != null ? a.value - a.cost : null;
      a.pnl_pct = a.value != null && a.cost ? ((a.value - a.cost) / a.cost) * 100 : null;
      if (a.value != null) { totalValue += a.value; totalCost += a.cost; }
    });

    res.json({
      assets: assets,
      totalValue: totalValue,
      totalCost: totalCost,
      totalPnl: totalValue - totalCost,
      totalPnlPct: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      pricesAvailable: Object.keys(quotes).length > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/portfolio', function (req, res) {
  var b = req.body;
  if (!b.symbol) return res.status(400).json({ error: 'Falta el símbolo' });
  var info = db.prepare(
    'INSERT INTO portfolio_assets (user_id, symbol, name, asset_type, quantity, avg_price) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id, String(b.symbol).toUpperCase(), b.name || b.symbol, b.asset_type || 'crypto',
    Number(b.quantity) || 0, Number(b.avg_price) || 0
  );
  arbol.alAgregarInversion(req.user.id);
  res.json(db.prepare('SELECT * FROM portfolio_assets WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/portfolio/:id', function (req, res) {
  var current = db.prepare('SELECT * FROM portfolio_assets WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'No existe el activo' });
  var quantity = req.body.quantity != null ? Number(req.body.quantity) : current.quantity;
  var avgPrice = req.body.avg_price != null ? Number(req.body.avg_price) : current.avg_price;
  db.prepare('UPDATE portfolio_assets SET quantity=?, avg_price=? WHERE id=? AND user_id=?')
    .run(quantity, avgPrice, req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM portfolio_assets WHERE id = ?').get(req.params.id));
});

router.delete('/portfolio/:id', function (req, res) {
  db.prepare('DELETE FROM portfolio_assets WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

/* ------------------------------------------------------- patrimonio neto */

router.get('/networth', async function (req, res) {
  try {
    var cash = db.prepare('SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE user_id = ?')
      .get(req.user.id).total;

    var assets = db.prepare('SELECT * FROM portfolio_assets WHERE user_id = ?').all(req.user.id);
    var quotes = await prices.getPrices(assets.map(function (a) { return a.symbol; }));
    var dolar = await prices.getDolar();
    // El MEP ("bolsa") es la referencia que usa el diseño y la que tiene
    // sentido para valuar. Si no viene, caemos al blue y despues al oficial.
    var venta = (dolar.bolsa && dolar.bolsa.venta)
      || (dolar.blue && dolar.blue.venta)
      || (dolar.oficial && dolar.oficial.venta) || 0;
    var cual = (dolar.bolsa && dolar.bolsa.venta) ? 'MEP'
      : (dolar.blue && dolar.blue.venta) ? 'blue' : 'oficial';

    var cryptoUsd = 0;
    assets.forEach(function (a) {
      var q = quotes[String(a.symbol).toUpperCase()];
      if (q) cryptoUsd += q.price * a.quantity;
    });

    // Cuanto se movio el patrimonio en los ultimos 30 dias. Solo podemos
    // medir la parte en pesos: de la cripto no guardamos precios viejos, asi
    // que decir "vario X" incluyendo cripto seria inventar.
    var hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    var cambio30 = db.prepare(
      'SELECT COALESCE(SUM(amount),0) t FROM transactions WHERE user_id = ? AND date >= ?'
    ).get(req.user.id, hace30).t;

    res.json({
      cash: cash,
      cambio30: cambio30,
      cryptoUsd: cryptoUsd,
      cryptoArs: cryptoUsd * venta,
      dolar: venta,
      dolarNombre: cual,
      total: cash + cryptoUsd * venta,
      pricesAvailable: Object.keys(quotes).length > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------- tarjetas */

router.get('/cards', function (req, res) {
  res.json(tarjetas.listar(req.user.id));
});

router.post('/cards', function (req, res) {
  if (!req.body.name) return res.status(400).json({ error: 'Falta el nombre de la tarjeta' });

  var info = db.prepare(
    'INSERT INTO cards (user_id, name, last4, color, limit_amount, close_day, due_day)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id,
    String(req.body.name).trim(),
    String(req.body.last4 || '').replace(/\D/g, '').slice(-4),
    req.body.color || '#EE8A17',
    Number(req.body.limit_amount) || 0,
    Math.min(Math.max(Number(req.body.close_day) || 1, 1), 31),
    Math.min(Math.max(Number(req.body.due_day) || 10, 1), 31)
  );

  // La primera tarjeta que cargás queda como predeterminada sola: si tenés
  // una sola, obviamente pagás con esa.
  var esPrimera = db.prepare('SELECT COUNT(*) c FROM cards WHERE user_id = ?').get(req.user.id).c === 1;
  if (req.body.es_default || esPrimera) tarjetas.marcarPorDefecto(req.user.id, info.lastInsertRowid);

  res.json(tarjetas.listar(req.user.id).find(function (t) { return t.id === info.lastInsertRowid; }));
});

router.patch('/cards/:id', function (req, res) {
  var actual = db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!actual) return res.status(404).json({ error: 'No existe esa tarjeta' });

  db.prepare(
    'UPDATE cards SET name=?, last4=?, color=?, limit_amount=?, close_day=?, due_day=?' +
    ' WHERE id=? AND user_id=?'
  ).run(
    req.body.name != null ? String(req.body.name).trim() : actual.name,
    req.body.last4 != null ? String(req.body.last4).replace(/\D/g, '').slice(-4) : actual.last4,
    req.body.color != null ? req.body.color : actual.color,
    req.body.limit_amount != null ? Number(req.body.limit_amount) : actual.limit_amount,
    req.body.close_day != null ? Math.min(Math.max(Number(req.body.close_day), 1), 31) : actual.close_day,
    req.body.due_day != null ? Math.min(Math.max(Number(req.body.due_day), 1), 31) : actual.due_day,
    req.params.id, req.user.id
  );

  if (req.body.es_default) tarjetas.marcarPorDefecto(req.user.id, Number(req.params.id));

  res.json(tarjetas.listar(req.user.id).find(function (t) { return t.id === Number(req.params.id); }));
});

router.delete('/cards/:id', function (req, res) {
  var info = db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'No existe esa tarjeta' });

  // Los movimientos quedan: existieron igual, solo dejan de estar asignados.
  db.prepare('UPDATE transactions SET card_id = NULL WHERE card_id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);

  res.json({ success: true });
});

/**
 * Marcar un resumen como pagado.
 *
 * NO crea ningún movimiento a propósito: las compras de ese resumen ya están
 * cargadas una por una. Si además anotáramos el pago, el gasto contaría dos
 * veces y el mes quedaría al doble.
 */
router.post('/cards/:id/pagar', function (req, res) {
  var tarjeta = db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!tarjeta) return res.status(404).json({ error: 'No existe esa tarjeta' });

  var pendientes = tarjetas.resumenesPendientes(req.user.id, tarjeta);
  if (pendientes.length === 0) {
    return res.status(400).json({ error: 'No hay resúmenes pendientes en esa tarjeta' });
  }

  // Sin decir cuál, se paga el más viejo: es el que vence antes.
  var cual = req.body.cierre
    ? pendientes.find(function (r) { return r.cierre === req.body.cierre; })
    : pendientes[0];
  if (!cual) return res.status(404).json({ error: 'No encontré ese resumen' });

  tarjetas.pagarResumen(req.user.id, tarjeta.id, cual.cierre, cual.monto, req.body.fecha);
  res.json({ pagado: cual, tarjetas: tarjetas.listar(req.user.id) });
});

router.delete('/cards/:id/pagar/:cierre', function (req, res) {
  db.prepare('DELETE FROM card_payments WHERE user_id = ? AND card_id = ? AND period_close = ?')
    .run(req.user.id, req.params.id, req.params.cierre);
  res.json({ success: true });
});

/**
 * Poner una tarjeta a todos los gastos que no tienen ninguna.
 * Sirve para ordenar lo que cargaste antes de tener tarjetas.
 * Sin ?aplicar solo cuenta cuántos serían.
 */
router.post('/cards/:id/asignar-sueltos', function (req, res) {
  var tarjeta = db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!tarjeta) return res.status(404).json({ error: 'No existe esa tarjeta' });

  var desde = req.body.desde || '0000-01-01';

  var sueltos = db.prepare(
    'SELECT id, description, amount FROM transactions' +
    ' WHERE user_id = ? AND card_id IS NULL AND amount < 0 AND date >= ?'
  ).all(req.user.id, desde);

  // Si en la descripción dice "efectivo", "débito" o "transferencia", ya nos
  // dijiste que no fue con tarjeta: no se lo pisamos.
  var candidatos = sueltos.filter(function (t) {
    return medioDePago.loQueDijo(t.description) !== 'no';
  });

  if (req.body.aplicar && candidatos.length) {
    var poner = db.prepare('UPDATE transactions SET card_id = ? WHERE id = ? AND user_id = ?');
    db.transaction(function () {
      candidatos.forEach(function (t) { poner.run(tarjeta.id, t.id, req.user.id); });
    })();
  }

  res.json({
    aplicado: Boolean(req.body.aplicar),
    cuantos: candidatos.length,
    total: candidatos.reduce(function (a, t) { return a + Math.abs(t.amount); }, 0),
    // Los que dejamos afuera porque vos dijiste cómo los pagaste.
    respetados: sueltos.length - candidatos.length
  });
});

/** Las cuotas que ya tenés comprometidas para los meses que vienen. */
router.get('/cuotas', function (req, res) {
  res.json({ meses: tarjetas.cuotasQueSeVienen(req.user.id) });
});

/* ------------------------------------------------------------- aprendido */

/* Lo que Manguito aprendió de vos al corregir categorías. Se puede mirar y
   borrar: si no, cambiaría cómo se categoriza sin que puedas verlo. */
router.get('/aprendido', function (req, res) {
  res.json({ reglas: aprendido.listar(req.user.id) });
});

router.delete('/aprendido/:id', function (req, res) {
  if (!aprendido.olvidar(req.user.id, req.params.id)) {
    return res.status(404).json({ error: 'No existe esa regla' });
  }
  res.json({ success: true });
});

/* ------------------------------------------------------------- saldo real */

/**
 * Poner el saldo en lo que de verdad tenés.
 *
 * Sirve cuando arrancás: la app solo sabe de lo que cargaste, así que si
 * pagaste el resumen de un mes que nunca cargaste, cree que tenés esa plata
 * y no la tenés. En vez de inventar gastos, se anota UN movimiento de ajuste
 * por la diferencia.
 *
 * Va con categoría "Ajuste" y queda fuera del análisis por categoría: no es
 * un gasto en algo, es una corrección para que el total cierre.
 */
router.get('/saldo', function (req, res) {
  var saldo = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM transactions WHERE user_id = ?')
    .get(req.user.id).t;
  res.json({ saldo: saldo });
});

router.post('/saldo', function (req, res) {
  if (req.body.saldoReal == null || isNaN(Number(req.body.saldoReal))) {
    return res.status(400).json({ error: 'Decime cuánta plata tenés de verdad' });
  }

  var saldo = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM transactions WHERE user_id = ?')
    .get(req.user.id).t;
  var real = Number(req.body.saldoReal);
  var diferencia = real - saldo;

  if (Math.abs(diferencia) < 1) {
    return res.json({ ajustado: false, saldo: saldo, mensaje: 'Ya cerraba, no hizo falta ajustar' });
  }

  var fecha = req.body.fecha || new Date().toISOString().slice(0, 10);
  var texto = req.body.motivo
    ? String(req.body.motivo).trim()
    : (diferencia < 0 ? 'Ajuste de saldo' : 'Ajuste de saldo (a favor)');

  db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform)' +
    " VALUES (?, ?, ?, ?, 'Ajuste', 'Ajuste')"
  ).run(req.user.id, fecha, texto, diferencia);

  res.json({ ajustado: true, diferencia: diferencia, saldo: real });
});

/* -------------------------------------------------------- mantenimiento */

/**
 * Ordena las descripciones de los movimientos que ya estaban cargados y
 * vuelve a categorizar los que quedaron en "Otros".
 *
 * Sin ?aplicar=1 solo devuelve la lista de lo que cambiaría: es la persona
 * la que decide si lo toca o no. Nunca modificamos datos viejos sin permiso.
 */
router.post('/mantenimiento/ordenar', function (req, res) {
  var aplicar = req.body && req.body.aplicar;
  var filas = db.prepare('SELECT id, description, category FROM transactions WHERE user_id = ?')
    .all(req.user.id);

  var cambios = [];
  filas.forEach(function (f) {
    var desc = texto.ordenarDescripcion(f.description);
    // Solo re-categorizamos lo que quedó en Otros: si vos elegiste una
    // categoría a mano, no te la vamos a pisar.
    // Ojo con el nombre: llamarla `cat` tapaba al módulo `cat` de arriba.
    var categoria = f.category === 'Otros'
      ? cat.categorizeByRules(desc, -1)
      : f.category;

    if (desc !== f.description || categoria !== f.category) {
      cambios.push({
        id: f.id,
        antes: f.description, despues: desc,
        categoriaAntes: f.category, categoriaDespues: categoria
      });
    }
  });

  if (aplicar && cambios.length) {
    var upd = db.prepare('UPDATE transactions SET description = ?, category = ? WHERE id = ? AND user_id = ?');
    db.transaction(function () {
      cambios.forEach(function (c) { upd.run(c.despues, c.categoriaDespues, c.id, req.user.id); });
    })();
  }

  res.json({ aplicado: Boolean(aplicar), total: filas.length, cambios: cambios });
});

/* ------------------------------------------------------------------ alertas */

/* Lo mismo que avisa el bot, para verlo en pantalla. Es de solo lectura: no
   marca nada como enviado, así no apaga los avisos de Telegram del día. */
router.get('/alertas', function (req, res) {
  res.json({ alertas: alertasPantalla.paraPantalla(req.user.id) });
});

/* ------------------------------------------------------------------ precios */

router.get('/prices/dolar', async function (req, res) {
  res.json(await prices.getDolar());
});

/* ------------------------------------------------------------ gastos fijos */

router.get('/fixed/upcoming', function (req, res) {
  res.json(fijos.proximas(req.user.id, Number(req.query.days) || 5));
});

router.post('/fixed/run', async function (req, res) {
  res.json({ cargadas: await fijos.cargarVencidas(req.user.id) });
});

/* ------------------------------------------------------------------- P&L */

/**
 * Ingresos, egresos y ahorro mes por mes, con la tasa de ahorro.
 * La "tasa de ahorro" es cuanto de lo que entro te quedo: (entro-salio)/entro.
 */
router.get('/pnl', function (req, res) {
  var uid = req.user.id;
  var limite = Math.min(Number(req.query.meses) || 12, 24);

  var filas = db.prepare(
    'SELECT substr(date,1,7) mes,' +
    ' COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) ingresos,' +
    ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) egresos,' +
    ' COUNT(*) n FROM transactions WHERE user_id = ?' +
    ' GROUP BY mes ORDER BY mes DESC LIMIT ?'
  ).all(uid, limite).reverse();

  var meses = filas.map(function (f) {
    var ahorro = f.ingresos - f.egresos;
    return {
      mes: f.mes,
      ingresos: f.ingresos,
      egresos: f.egresos,
      ahorro: ahorro,
      // Sin ingresos la tasa no significa nada: la dejamos en null y el
      // frontend muestra un guion en vez de un 0% enganoso.
      tasa: f.ingresos > 0 ? (ahorro / f.ingresos) * 100 : null,
      movimientos: f.n
    };
  });

  var ultimo = meses[meses.length - 1] || null;
  var anterior = meses[meses.length - 2] || null;

  function variacion(hoy, antes) {
    if (antes == null || antes === 0) return null;
    return ((hoy - antes) / antes) * 100;
  }

  res.json({
    meses: meses,
    actual: ultimo,
    anterior: anterior,
    variacion: ultimo && anterior ? {
      ingresos: variacion(ultimo.ingresos, anterior.ingresos),
      egresos: variacion(ultimo.egresos, anterior.egresos),
      ahorro: variacion(ultimo.ahorro, anterior.ahorro)
    } : null,
    // Acumulado de todo el periodo mostrado
    total: meses.reduce(function (a, m) {
      a.ingresos += m.ingresos; a.egresos += m.egresos; a.ahorro += m.ahorro; return a;
    }, { ingresos: 0, egresos: 0, ahorro: 0 })
  });
});

/* --------------------------------------------------------------- el arbol */

router.get('/progreso', function (req, res) {
  res.json(arbol.progreso(req.user.id));
});

/* ------------------------------------------------ presupuestos sugeridos */

/**
 * Mira lo que gastaste en los ultimos meses y propone un tope por categoria.
 * No guarda nada: devuelve la propuesta para que la persona decida.
 */
router.get('/budgets/suggest', function (req, res) {
  var uid = req.user.id;
  var desde = new Date();
  desde.setMonth(desde.getMonth() - 3);
  var desdeMes = desde.toISOString().slice(0, 7);
  var mesActualStr = mesActual();

  var filas = db.prepare(
    'SELECT category, substr(date,1,7) mes, SUM(ABS(amount)) total FROM transactions' +
    ' WHERE user_id = ? AND amount < 0 AND substr(date,1,7) >= ? AND substr(date,1,7) < ?' +
    ' GROUP BY category, mes'
  ).all(uid, desdeMes, mesActualStr);

  if (filas.length === 0) {
    return res.json({
      hayHistorial: false,
      mensaje: 'Todavia no hay meses cerrados para calcular. Cargá un mes completo y vuelvo con una propuesta.',
      propuestas: []
    });
  }

  var porCategoria = {};
  filas.forEach(function (f) {
    if (!porCategoria[f.category]) porCategoria[f.category] = [];
    porCategoria[f.category].push(f.total);
  });

  var yaTiene = {};
  db.prepare('SELECT category FROM budgets WHERE user_id = ?').all(uid)
    .forEach(function (b) { yaTiene[b.category] = true; });

  var propuestas = Object.keys(porCategoria).map(function (cat) {
    var meses = porCategoria[cat];
    var promedio = meses.reduce(function (a, b) { return a + b; }, 0) / meses.length;
    // Redondeamos para arriba al millar: un tope con centavos no lo respeta nadie
    var sugerido = Math.ceil((promedio * 1.05) / 1000) * 1000;
    return {
      category: cat,
      promedio: Math.round(promedio),
      meses: meses.length,
      sugerido: sugerido,
      yaTiene: Boolean(yaTiene[cat])
    };
  }).sort(function (a, b) { return b.promedio - a.promedio; });

  res.json({ hayHistorial: true, propuestas: propuestas });
});

/** Guarda de una todas las propuestas que le manden. */
router.post('/budgets/suggest/apply', function (req, res) {
  var lista = req.body.propuestas || [];
  var ins = db.prepare(
    'INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)' +
    ' ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit'
  );
  var run = db.transaction(function () {
    lista.forEach(function (p) {
      if (p && p.category && p.sugerido) ins.run(req.user.id, p.category, Number(p.sugerido));
    });
  });
  run();
  arbol.revisarLogros(req.user.id);
  res.json({ success: true, guardados: lista.length, budgets: estadoPresupuestos(req.user.id, mesActual()) });
});

/* ------------------------------------------------- respaldo: exportar/importar */

/**
 * Se baja TODO lo del usuario en un JSON. Sirve de respaldo y para mudarse
 * de una instalación a otra (por ejemplo, de la PC al servidor).
 */
router.get('/export', function (req, res) {
  var uid = req.user.id;

  var transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id').all(uid);
  var items = db.prepare(
    'SELECT i.*, t.date, t.description as tx_description, t.amount as tx_amount' +
    ' FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id WHERE t.user_id = ?'
  ).all(uid);

  var porTx = {};
  items.forEach(function (i) {
    if (!porTx[i.transaction_id]) porTx[i.transaction_id] = [];
    porTx[i.transaction_id].push({ description: i.description, amount: i.amount, quantity: i.quantity });
  });

  res.json({
    formato: 1,
    exportado: new Date().toISOString(),
    de: req.user.displayName,
    transactions: transactions.map(function (t) {
      return {
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        platform: t.platform,
        ai_categorized: t.ai_categorized,
        items: porTx[t.id] || []
      };
    }),
    subscriptions: db.prepare('SELECT name, plan, amount, category, billing_day, active, promo_price, promo_end, normal_price FROM subscriptions WHERE user_id = ?').all(uid),
    budgets: db.prepare('SELECT category, monthly_limit FROM budgets WHERE user_id = ?').all(uid),
    goals: db.prepare('SELECT name, target, saved, deadline, done FROM goals WHERE user_id = ?').all(uid),
    portfolio: db.prepare('SELECT symbol, name, asset_type, quantity, avg_price, real_pnl, real_pnl_pct FROM portfolio_assets WHERE user_id = ?').all(uid)
  });
});

/**
 * Carga un respaldo. No duplica: si un movimiento ya está (misma fecha,
 * descripción y monto) lo saltea, así se puede importar dos veces sin miedo.
 */
router.post('/import', function (req, res) {
  var uid = req.user.id;
  var datos = req.body;

  if (!datos || !Array.isArray(datos.transactions)) {
    return res.status(400).json({ error: 'El archivo no tiene el formato esperado' });
  }

  var resumen = { movimientos: 0, repetidos: 0, items: 0, suscripciones: 0, presupuestos: 0, metas: 0, cripto: 0 };

  /**
   * Para no perder movimientos legítimamente repetidos (dos cafés iguales el
   * mismo día), no alcanza con preguntar "¿existe?": hay que contar. Si el
   * archivo trae 2 y en la base hay 1, falta insertar 1.
   */
  var cuantosHay = db.prepare(
    'SELECT COUNT(*) c FROM transactions WHERE user_id = ? AND date = ? AND description = ? AND amount = ?'
  );

  function clave(t) {
    return t.date + '|' + t.description + '|' + Number(t.amount);
  }

  var vecesEnArchivo = {};
  datos.transactions.forEach(function (t) {
    if (!t || !t.date || !t.description || t.amount == null) return;
    var k = clave(t);
    vecesEnArchivo[k] = (vecesEnArchivo[k] || 0) + 1;
  });

  var yaInsertadas = {};
  var insTx = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform, ai_categorized)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  var insItem = db.prepare(
    'INSERT INTO transaction_items (transaction_id, description, amount, quantity) VALUES (?, ?, ?, ?)'
  );

  var run = db.transaction(function () {
    datos.transactions.forEach(function (t) {
      if (!t || !t.date || !t.description || t.amount == null) return;

      var k = clave(t);
      if (yaInsertadas[k] == null) {
        // Cuántas de estas ya estaban antes de empezar a importar.
        yaInsertadas[k] = cuantosHay.get(uid, t.date, t.description, Number(t.amount)).c;
      }
      // Si en la base ya hay tantas como trae el archivo, esta sobra.
      if (yaInsertadas[k] >= vecesEnArchivo[k]) { resumen.repetidos++; return; }
      yaInsertadas[k]++;

      var info = insTx.run(
        uid, t.date, t.description, Number(t.amount), t.category || 'Otros',
        t.platform || 'Importado', t.ai_categorized ? 1 : 0
      );
      resumen.movimientos++;
      (t.items || []).forEach(function (i) {
        insItem.run(info.lastInsertRowid, i.description, Number(i.amount) || 0, Number(i.quantity) || 1);
        resumen.items++;
      });
    });

    (datos.subscriptions || []).forEach(function (s) {
      if (!s || !s.name) return;
      if (db.prepare('SELECT id FROM subscriptions WHERE user_id = ? AND name = ?').get(uid, s.name)) return;
      db.prepare(
        'INSERT INTO subscriptions (user_id, name, plan, amount, category, billing_day, active, promo_price, promo_end, normal_price)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        uid, s.name, s.plan || 'Estandar', Number(s.amount) || 0, s.category || 'Servicios',
        Number(s.billing_day) || 1, s.active == null ? 1 : (s.active ? 1 : 0),
        Number(s.promo_price) || 0, s.promo_end || '', Number(s.normal_price) || 0
      );
      resumen.suscripciones++;
    });

    (datos.budgets || []).forEach(function (b) {
      if (!b || !b.category) return;
      db.prepare(
        'INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)' +
        ' ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit'
      ).run(uid, b.category, Number(b.monthly_limit) || 0);
      resumen.presupuestos++;
    });

    (datos.goals || []).forEach(function (g) {
      if (!g || !g.name) return;
      if (db.prepare('SELECT id FROM goals WHERE user_id = ? AND name = ?').get(uid, g.name)) return;
      db.prepare('INSERT INTO goals (user_id, name, target, saved, deadline, done) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uid, g.name, Number(g.target) || 0, Number(g.saved) || 0, g.deadline || '', g.done ? 1 : 0);
      resumen.metas++;
    });

    (datos.portfolio || []).forEach(function (a) {
      if (!a || !a.symbol) return;
      if (db.prepare('SELECT id FROM portfolio_assets WHERE user_id = ? AND symbol = ?').get(uid, a.symbol)) return;
      db.prepare(
        'INSERT INTO portfolio_assets (user_id, symbol, name, asset_type, quantity, avg_price, real_pnl, real_pnl_pct)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        uid, String(a.symbol).toUpperCase(), a.name || a.symbol, a.asset_type || 'crypto',
        Number(a.quantity) || 0, Number(a.avg_price) || 0, Number(a.real_pnl) || 0, Number(a.real_pnl_pct) || 0
      );
      resumen.cripto++;
    });
  });

  try {
    run();
    res.json({ success: true, resumen: resumen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ upload */

router.post('/upload', upload.single('file'), async function (req, res) {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
  try {
    var parsed = await parsers.parseFile(req.file.path, req.file.originalname);
    if (parsed.length === 0) {
      return res.status(422).json({ error: 'No se detectaron movimientos en el archivo' });
    }
    var categorized = await cat.categorizeTransactions(parsed);
    var platform = path.extname(req.file.originalname).replace('.', '').toUpperCase() || 'Archivo';
    insertTransactions(req.user.id, categorized, platform);
    res.json({ success: true, count: categorized.length, transactions: categorized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, function () {});
  }
});

module.exports = { router: router, insertTransactions: insertTransactions };
