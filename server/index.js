/**
 * Un solo proceso: API + frontend + bot de Telegram, para todas las personas.
 */
var express = require('express');
var path = require('path');
var fs = require('fs');
var os = require('os');

var db_module = require('./db.js');
var config = db_module.config;
var initDB = db_module.initDB;
var auth = require('./auth.js');
var api = require('./api.js');

initDB();
auth.limpiarSesionesVencidas();

var app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

// Detrás del proxy de Render, para que la cookie Secure funcione.
if (config.isProduction) app.set('trust proxy', 1);

app.use('/api', api.router);

var DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, function (req, res) {
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', function (req, res) {
    res.status(503).send('<h1>Falta compilar el frontend</h1><p>Corré <code>npm run build</code>.</p>');
  });
}

function localIPs() {
  var out = [];
  var nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (net) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    });
  });
  return out;
}

app.listen(config.port, '0.0.0.0', function () {
  var cantidad = auth.contarUsuarios();

  console.log('');
  console.log('  Finanzas');
  console.log('  Base:     ' + path.basename(config.dbPath));
  console.log('  Usuarios: ' + cantidad);
  console.log('  Acá:      http://localhost:' + config.port);
  if (!config.isProduction) {
    localIPs().forEach(function (ip) {
      console.log('  Celular:  http://' + ip + ':' + config.port);
    });
  }
  console.log('  IA: ' + (config.hasAI ? 'sí' : 'no') + '   Precios: ' + (config.hasPrices ? 'sí' : 'no'));

  if (cantidad === 0) {
    console.log('');
    console.log('  ⚠ No hay ningún usuario todavía. Creá el primero:');
    console.log('     node crear-usuario.js emanuel "Emanuel" tuClave --admin');
  }
  console.log('');

  try {
    require('./fijos.js').iniciar();
  } catch (err) {
    console.error('  No se pudieron cargar los gastos fijos: ' + err.message);
  }

  if (config.botToken) {
    try {
      require('./telegram-bot.js').start(config);
    } catch (err) {
      console.error('  El bot de Telegram no arrancó: ' + err.message);
    }
  } else {
    console.log('  Bot de Telegram apagado (falta ' + config.botTokenEnv + ' en .env)');
  }
});

process.on('unhandledRejection', function (err) {
  console.error('Error no manejado:', err && err.message ? err.message : err);
});
