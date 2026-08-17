/**
 * Crea un usuario desde la consola.
 *
 *   node crear-usuario.js emanuel "Emanuel" miClave123 --admin
 *   node crear-usuario.js sofia "Sofía" otraClave --simple
 *
 * --admin   puede crear y borrar usuarios
 * --simple  ve la version reducida de la app (menos pestañas)
 */
var db_module = require('./server/db.js');
db_module.initDB();
var auth = require('./server/auth.js');

var args = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });
var flags = process.argv.slice(2).filter(function (a) { return a.indexOf('--') === 0; });

if (args.length < 3) {
  console.log('Uso: node crear-usuario.js <usuario> "<Nombre>" <contraseña> [--admin] [--simple]');
  process.exit(1);
}

try {
  var user = auth.crearUsuario({
    username: args[0],
    displayName: args[1],
    password: args[2],
    isAdmin: flags.indexOf('--admin') !== -1,
    simpleUi: flags.indexOf('--simple') !== -1
  });
  console.log('Usuario creado:');
  console.log('  usuario: ' + user.username);
  console.log('  nombre:  ' + user.display_name);
  console.log('  admin:   ' + (user.is_admin ? 'si' : 'no'));
  console.log('  simple:  ' + (user.simple_ui ? 'si' : 'no'));
} catch (err) {
  console.error('Error: ' + err.message);
  process.exit(1);
}
