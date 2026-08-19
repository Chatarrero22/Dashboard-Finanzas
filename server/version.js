/**
 * Qué versión está corriendo.
 *
 * Ya pasó tres veces: algo "no funciona" en producción y en realidad el
 * código nuevo nunca se desplegó. Render no despliega solo (el repo se
 * conectó sin webhook), así que hay que apretar Manual Deploy a mano y es
 * fácil olvidarse o creer que se hizo.
 *
 * La huella es el nombre del archivo compilado del frontend: Vite le pone un
 * hash distinto en cada build, así que si cambia una sola línea, cambia el
 * nombre. Comparando ese nombre se sabe en diez segundos si el deploy entró.
 */
var fs = require('fs');
var path = require('path');

var cache = null;

function leer() {
  var indice = path.join(__dirname, '..', 'client', 'dist', 'index.html');

  try {
    var html = fs.readFileSync(indice, 'utf8');
    var m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+)\.js/);
    return {
      build: m ? m[1] : 'sin compilar',
      // Cuándo se compiló, que es cuándo se desplegó.
      fecha: fs.statSync(indice).mtime.toISOString().slice(0, 16).replace('T', ' ')
    };
  } catch (err) {
    // En desarrollo puede no existir dist: no es un error.
    return { build: 'sin compilar', fecha: '' };
  }
}

/** Se lee una sola vez: el archivo no cambia mientras el proceso vive. */
function actual() {
  if (!cache) cache = leer();
  return cache;
}

module.exports = { actual: actual };
