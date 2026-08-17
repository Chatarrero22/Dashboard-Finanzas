/**
 * Bot de Telegram multiusuario.
 *
 * Cada persona vincula su Telegram con su cuenta una sola vez: entra a la web,
 * pide un codigo y le escribe al bot "/vincular 123456". A partir de ahi el bot
 * sabe de quien son los gastos que le mandan.
 */
var TelegramBot = require('node-telegram-bot-api');
var db_module = require('./db.js');
var db = db_module.db;
var auth = require('./auth.js');
var cat = require('./categorizer.js');
var plata = require('./plata.js');
var fijos = require('./fijos.js');

var PLATFORM = 'Telegram';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return '$' + Math.abs(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

function saveTransaction(userId, tx) {
  var insert = db.prepare(
    'INSERT INTO transactions (user_id, date, description, amount, category, platform, ai_categorized)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  var insertItem = db.prepare(
    'INSERT INTO transaction_items (transaction_id, description, amount, quantity) VALUES (?, ?, ?, ?)'
  );
  var run = db.transaction(function (t) {
    var info = insert.run(userId, t.date, t.description, t.amount, t.category, PLATFORM, t.ai_categorized ? 1 : 0);
    (t.items || []).forEach(function (item) {
      insertItem.run(info.lastInsertRowid, item.description, Number(item.amount) || 0, Number(item.quantity) || 1);
    });
    return info.lastInsertRowid;
  });
  return run(tx);
}

/**
 * "Disco 15400", "gaste 5 lucas en el super", "un palo el alquiler",
 * "+250000 sueldo". Por defecto es gasto; suma si lleva "+" o suena a ingreso.
 */
function parseTextMessage(text) {
  var encontrado = plata.extraerMonto(text);
  if (!encontrado || !encontrado.monto) return null;

  var esIngreso = encontrado.positivoExplicito || plata.esIngreso(text);
  return {
    date: today(),
    description: encontrado.resto || 'Movimiento',
    amount: esIngreso ? Math.abs(encontrado.monto) : -Math.abs(encontrado.monto)
  };
}

/** Lee un ticket desde una foto usando Claude. */
async function readReceipt(buffer, mediaType) {
  var client = cat.getClient();
  if (!client) throw new Error('no hay clave de IA configurada');

  var response = await client.messages.create({
    model: cat.MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        {
          type: 'text',
          text:
            'Es un ticket o comprobante argentino. Devolvé SOLO este JSON, sin texto extra:\n' +
            '{"description": "nombre del comercio", "date": "YYYY-MM-DD", "total": 12345.67, ' +
            '"items": [{"description": "producto", "amount": 1234.5, "quantity": 1}]}\n' +
            'El total va positivo. Si no ves la fecha usá ' + today() + '. Si no hay detalle, items: [].'
        }
      ]
    }]
  });

  if (response.stop_reason === 'refusal') throw new Error('no pude leer la imagen');

  var text = response.content
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join('');

  var data = cat.extractJSON(text);
  var total = Math.abs(Number(data.total) || 0);
  if (!total) throw new Error('no pude identificar el total');

  return {
    date: data.date || today(),
    description: data.description || 'Compra',
    amount: -total,
    items: (data.items || []).map(function (i) {
      return {
        description: String(i.description || 'Item'),
        amount: -Math.abs(Number(i.amount) || 0),
        quantity: Number(i.quantity) || 1
      };
    })
  };
}

/** Elige uno al azar, para que no conteste siempre igual. */
function alAzar(opciones) {
  return opciones[Math.floor(Math.random() * opciones.length)];
}

/**
 * Como viene el presupuesto de esa categoria, en una linea.
 * El circulito de color se lee de un vistazo, sin leer el numero.
 */
function comoVaElPresupuesto(userId, categoria) {
  var b = db.prepare('SELECT * FROM budgets WHERE user_id = ? AND category = ?').get(userId, categoria);
  if (!b || !b.monthly_limit) return '';

  var mes = today().slice(0, 7);
  var usado = db.prepare(
    'SELECT COALESCE(SUM(ABS(amount)),0) t FROM transactions' +
    ' WHERE user_id = ? AND amount < 0 AND category = ? AND substr(date,1,7) = ?'
  ).get(userId, categoria, mes).t;

  var pct = (usado / b.monthly_limit) * 100;
  var falta = b.monthly_limit - usado;

  if (pct >= 100) {
    return '\n\n🔴 Te pasaste de ' + categoria + ' por ' + money(Math.abs(falta)) + '. ' +
      alAzar(['Ojo con eso.', 'A frenar un poco.', 'Pisá el freno.']);
  }
  if (pct >= 80) {
    return '\n\n🟡 Llevás ' + money(usado) + ' de ' + money(b.monthly_limit) +
      ' en ' + categoria + '. Te quedan ' + money(falta) + ' hasta fin de mes.';
  }
  return '\n\n🟢 Llevás ' + money(usado) + ' de ' + money(b.monthly_limit) + ' en ' + categoria + '.';
}

/** El total del mes, para cuando no hay presupuesto puesto. */
function comoVaElMes(userId) {
  var mes = today().slice(0, 7);
  var t = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) gastado' +
    ' FROM transactions WHERE user_id = ? AND substr(date,1,7) = ?'
  ).get(userId, mes);
  if (!t.gastado) return '';
  return '\n\nVas ' + money(t.gastado) + ' este mes.';
}

function confirmation(userId, tx, itemCount) {
  var arranque = tx.amount > 0
    ? alAzar(['Entró plata 💰', 'Buenííísimo 💰', 'Grande 💰'])
    : alAzar(['Anotado ✅', 'Listo ✅', 'Ya está ✅', 'Guardado ✅']);

  // "Anotado ✅  Disco · $15.400" — todo lo importante en el primer renglon
  var msg = arranque + '\n' + tx.description + ' · ' + money(tx.amount);
  msg += '\n' + tx.category;
  if (itemCount) msg += ' · ' + itemCount + ' productos';

  if (tx.amount < 0) {
    var aviso = comoVaElPresupuesto(userId, tx.category);
    msg += aviso || comoVaElMes(userId);
  }
  return msg;
}

var PEDIR_VINCULO =
  '🥭 ¡Hola! Soy Manguito, pero todavía no sé quién sos.\n\n' +
  'Entrá a la app, andá a Ajustes y pedime un código. Después me lo pasás así:\n\n' +
  '   /vincular 123456\n\n' +
  'Y ya quedamos presentados.';

function start(config) {
  if (!config.botToken) return null;

  var bot = new TelegramBot(config.botToken, { polling: true });

  /** Devuelve el usuario dueño de este chat, o avisa y devuelve null. */
  function quienEs(msg) {
    var user = auth.usuarioPorChatId(msg.chat.id);
    if (!user) {
      bot.sendMessage(msg.chat.id, PEDIR_VINCULO);
      return null;
    }
    return user;
  }

  bot.onText(/^\/vincular\s*(\d+)?/, function (msg, match) {
    var codigo = match[1];
    if (!codigo) {
      return bot.sendMessage(msg.chat.id, 'Escribime el código así: /vincular 123456\n\nEl código lo pedís desde la app, en "Ajustes".');
    }
    var user = auth.vincularTelegram(codigo, msg.chat.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Mmm, ese código no me cierra o ya lo usaste. Pedime uno nuevo desde la app 🙌');
    }
    bot.sendMessage(msg.chat.id,
      '🤝 ¡Listo, ' + user.displayName + '! Ya nos conocemos.\n\n' +
      'Probá tirándome algo:  Disco 15400'
    );
  });

  bot.onText(/^\/(start|help|ayuda)/, function (msg) {
    var user = auth.usuarioPorChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, PEDIR_VINCULO);

    bot.sendMessage(msg.chat.id,
      '🥭 ¡Qué hacés, ' + user.display_name + '! Soy Manguito.\n\n' +
      'Tirame lo que gastaste como se te salga, yo lo anoto:\n' +
      '   Disco 15400\n' +
      '   gasté 5 lucas en el súper\n' +
      '   un palo y medio el alquiler\n' +
      '   15k netflix\n\n' +
      'Si es plata que entra, un + adelante y listo:\n' +
      '   +250 lucas sueldo\n\n' +
      '📸 O mandame la foto del ticket y te lo cargo con todos los productos.\n\n' +
      'Para ver cómo venís: /resumen · /metas · /fijos · /ultimos'
    );
  });

  bot.onText(/^\/resumen/, function (msg) {
    var user = quienEs(msg);
    if (!user) return;

    var mes = today().slice(0, 7);
    var t = db.prepare(
      'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) income,' +
      ' COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) END),0) expense' +
      ' FROM transactions WHERE user_id = ? AND substr(date,1,7) = ?'
    ).get(user.id, mes);

    var byCat = db.prepare(
      'SELECT category, SUM(ABS(amount)) t FROM transactions' +
      ' WHERE user_id = ? AND amount < 0 AND substr(date,1,7) = ? GROUP BY category ORDER BY t DESC LIMIT 5'
    ).all(user.id, mes);

    var lines = byCat.map(function (c) { return '   ' + c.category + ': ' + money(c.t); });
    var neto = t.income - t.expense;
    var cierre = t.expense === 0
      ? 'Todavía no gastaste nada este mes 👏'
      : neto >= 0
        ? 'Vas bien, te sobran ' + money(neto) + ' 🟢'
        : 'Estás ' + money(Math.abs(neto)) + ' en rojo 🔴';

    bot.sendMessage(msg.chat.id,
      '📊 Cómo venís este mes\n\n' +
      'Entró ' + money(t.income) + ' · salió ' + money(t.expense) + '\n' +
      cierre +
      (lines.length ? '\n\nDónde se fue:\n' + lines.join('\n') : '')
    );
  });

  bot.onText(/^\/ultimos/, function (msg) {
    var user = quienEs(msg);
    if (!user) return;

    var rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(user.id);
    if (rows.length === 0) return bot.sendMessage(msg.chat.id, 'Todavía no cargaste nada. Tirame el primero 🙌');
    var lines = rows.map(function (r) {
      return '#' + r.id + '  ' + r.date.slice(5) + '  ' + (r.amount > 0 ? '+' : '-') + money(r.amount) + '  ' + r.description;
    });
    bot.sendMessage(msg.chat.id, '🧾 Últimos movimientos\n\n' + lines.join('\n') + '\n\nPara borrar uno: /borrar 12');
  });

  bot.onText(/^\/borrar\s*(\d+)?/, function (msg, match) {
    var user = quienEs(msg);
    if (!user) return;

    var id = match[1];
    if (!id) return bot.sendMessage(msg.chat.id, 'Decime cuál: /borrar 12  (el número sale en /ultimos)');

    // El user_id en el WHERE evita que alguien borre movimientos de otro.
    var row = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, user.id);
    if (!row) return bot.sendMessage(msg.chat.id, 'No encontré el movimiento #' + id + '.');
    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, user.id);
    bot.sendMessage(msg.chat.id, '🗑️ Listo, borré ' + row.description + ' · ' + money(row.amount));
  });

  bot.onText(/^\/metas/, function (msg) {
    var user = quienEs(msg);
    if (!user) return;

    var metas = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY done ASC, id DESC').all(user.id);
    if (metas.length === 0) {
      return bot.sendMessage(msg.chat.id, 'Todavía no tenés ninguna meta 🎯 Se crean desde la app, en Metas.');
    }
    var lines = metas.map(function (g) {
      var pct = g.target ? Math.min((g.saved / g.target) * 100, 100) : 0;
      var llenos = Math.round(pct / 10);
      return (g.done ? '🏆 ' : '') + g.name +
        '\n   ' + '█'.repeat(llenos) + '░'.repeat(10 - llenos) + ' ' + Math.round(pct) + '%' +
        '\n   ' + money(g.saved) + ' de ' + money(g.target);
    });
    bot.sendMessage(msg.chat.id, '🎯 Tus metas\n\n' + lines.join('\n\n'));
  });

  bot.onText(/^\/fijos/, function (msg) {
    var user = quienEs(msg);
    if (!user) return;

    var proximas = fijos.proximas(user.id, 7);
    if (proximas.length === 0) {
      return bot.sendMessage(msg.chat.id, 'Tranqui, no se te viene ningún gasto fijo en los próximos 7 días 😌');
    }
    var lines = proximas.map(function (s) {
      return '   día ' + s.billing_day + '  ' + s.name + '  ' + money(s.amount);
    });
    var total = proximas.reduce(function (a, s) { return a + s.amount; }, 0);
    bot.sendMessage(msg.chat.id, '📅 Se viene\n\n' + lines.join('\n') + '\n\nTotal: ' + money(total));
  });

  bot.on('photo', async function (msg) {
    var user = quienEs(msg);
    if (!user) return;

    bot.sendMessage(msg.chat.id, alAzar([
      '👀 Dejame ver ese ticket...',
      '📸 Lo estoy leyendo, dame unos segundos...',
      '👀 A ver qué compraste...'
    ]));
    try {
      var photo = msg.photo[msg.photo.length - 1];
      var stream = bot.getFileStream(photo.file_id);
      var chunks = [];
      for await (var chunk of stream) chunks.push(chunk);

      var tx = await readReceipt(Buffer.concat(chunks), 'image/jpeg');
      var categorized = (await cat.categorizeTransactions([tx]))[0];
      categorized.items = tx.items;
      saveTransaction(user.id, categorized);

      bot.sendMessage(msg.chat.id, confirmation(user.id, categorized, tx.items.length));
    } catch (err) {
      bot.sendMessage(msg.chat.id, '😕 No pude leer la foto (' + err.message + ').\nProbá escribiéndolo: Disco 15400');
    }
  });

  bot.on('message', async function (msg) {
    if (!msg.text || msg.text.indexOf('/') === 0) return;

    var user = quienEs(msg);
    if (!user) return;

    var parsed = parseTextMessage(msg.text);
    if (!parsed) {
      return bot.sendMessage(msg.chat.id, alAzar([
        'No le encontré el monto 🤔 Probá así: Disco 15400',
        'Uh, no vi ningún número ahí. Tirame algo tipo: Disco 15400',
        'Me falta el monto 🤔 Por ejemplo: Disco 15400'
      ]));
    }

    try {
      var categorized = (await cat.categorizeTransactions([parsed]))[0];
      saveTransaction(user.id, categorized);
      bot.sendMessage(msg.chat.id, confirmation(user.id, categorized, 0));
    } catch (err) {
      bot.sendMessage(msg.chat.id, 'Se me complicó guardarlo 😕 (' + err.message + '). Probá de nuevo en un rato.');
    }
  });

  bot.on('polling_error', function (err) {
    console.error('  Telegram: ' + err.message);
  });

  console.log('  Bot de Telegram activo (multiusuario)');
  return bot;
}

module.exports = { start: start, parseTextMessage: parseTextMessage };
