/**
 * Genera un archivo HTML unico y autocontenido con el dashboard completo,
 * usando los datos reales, sin JavaScript ni servidor.
 *
 * Sirve para pasarselo a alguien que rediseñe: puede tocar todo lo que quiera
 * sin riesgo, porque es una copia estatica.
 *
 *   node exportar-diseno.mjs
 */
import { chromium, devices } from 'playwright'
import fs from 'fs'

// Las credenciales se pasan por variable de entorno, nunca escritas acá:
//   U=emanuel P=tuClave node herramientas/exportar-diseno.mjs
const USUARIO = process.env.U || 'emanuel'
const CLAVE = process.env.P
if (!CLAVE) {
  console.error('Falta la contraseña. Usá:  U=emanuel P=tuClave node herramientas/exportar-diseno.mjs')
  process.exit(1)
}
const BASE = 'http://localhost:3001'

const PANTALLAS = [
  { tab: 'Inicio', titulo: 'Inicio — el resumen del mes' },
  { tab: 'Agregar', titulo: 'Agregar — cargar un gasto' },
  { tab: 'Metas', titulo: 'Metas y presupuestos' },
  { tab: 'Movs', titulo: 'Movimientos' },
  { tab: 'Cripto', titulo: 'Cripto' },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByLabel('Usuario').fill(USUARIO)
await page.getByLabel('Contraseña').fill(CLAVE)
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForTimeout(2600)

// El CSS compilado, tal cual lo sirve la app
const css = await page.evaluate(async () => {
  const link = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href)[0]
  return link ? await (await fetch(link)).text() : ''
})

const capturas = []
for (const p of PANTALLAS) {
  try {
    await page.getByRole('button', { name: new RegExp(p.tab) }).click()
    await page.waitForTimeout(1100)
    const html = await page.evaluate(() => {
      const app = document.querySelector('.app')
      if (!app) return ''
      const copia = app.cloneNode(true)
      // La navegacion es fija: en una pagina con varias pantallas apiladas
      // molestaria, asi que la dejamos como parte de cada bloque.
      copia.querySelectorAll('script').forEach((s) => s.remove())
      return copia.outerHTML
    })
    if (html) capturas.push({ ...p, html })
  } catch (err) {
    console.log('  (no pude capturar ' + p.tab + ': ' + err.message.split('\n')[0] + ')')
  }
}

// Login y bienvenida, en contextos limpios
async function suelta(url, accion) {
  const c = await browser.newContext({ ...devices['iPhone 13'] })
  const p = await c.newPage()
  await p.goto(url, { waitUntil: 'networkidle' })
  if (accion) await accion(p)
  await p.waitForTimeout(600)
  const html = await p.evaluate(() => {
    const el = document.querySelector('.login-wrap')
    return el ? el.outerHTML : ''
  })
  await c.close()
  return html
}

const loginHtml = await suelta(BASE)
if (loginHtml) capturas.push({ tab: 'Login', titulo: 'Entrada', html: loginHtml })

const salida = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Dashboard de Finanzas — para rediseñar</title>
<style>
/* ==================== CSS ACTUAL DE LA APP ====================
   Esto es lo que hay que rediseñar. Los nombres de las clases NO se
   pueden cambiar: la app real los escribe desde React.
   ============================================================== */
${css}

/* ============ Solo para esta hoja de muestra (no es de la app) ============ */
.muestra-fondo { background:#e9e9e6; padding:24px 12px 60px; }
@media (prefers-color-scheme: dark){ .muestra-fondo{ background:#0a0a09; } }
.muestra-titulo { max-width:1200px; margin:0 auto 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.muestra-titulo h1 { font-size:1.6rem; margin:0 0 6px; color:#111; }
.muestra-titulo p { margin:0; color:#555; font-size:.95rem; }
@media (prefers-color-scheme: dark){ .muestra-titulo h1{color:#fff} .muestra-titulo p{color:#bbb} }
.muestra-grid { display:flex; flex-wrap:wrap; gap:28px; justify-content:center; align-items:flex-start; max-width:1400px; margin:0 auto; }
.muestra-item { }
.muestra-item > h2 { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:.9rem; font-weight:600;
  color:#555; margin:0 0 10px; text-align:center; }
@media (prefers-color-scheme: dark){ .muestra-item > h2{ color:#bbb } }
/* Cada pantalla dentro de un "telefono" */
.telefono { width:390px; height:844px; overflow:hidden; position:relative;
  border-radius:34px; border:1px solid rgba(0,0,0,.18); box-shadow:0 8px 30px rgba(0,0,0,.16); background:var(--surface-0); }
.telefono > .app, .telefono > .login-wrap { position:absolute; inset:0; overflow-y:auto; }
.telefono .nav { position:absolute; }
/* La hoja de muestra se ve en una ventana ancha, asi que se activaria la regla
   de escritorio del .nav (botones de 120px fijos) y la barra no entraria en el
   telefono. Adentro del marco forzamos el comportamiento de celular. */
.telefono .nav { justify-content:flex-start; gap:0; }
.telefono .nav button { flex:1 1 auto; }
.telefono .screen { padding:16px; gap:16px; }
</style>
</head>
<body>
<div class="muestra-fondo">
  <div class="muestra-titulo">
    <h1>Dashboard de Finanzas</h1>
    <p>Pantallas reales con datos reales, tamaño iPhone. Se puede rediseñar todo el CSS de arriba;
       los nombres de las clases tienen que quedar igual. Probá también en modo oscuro.</p>
  </div>
  <div class="muestra-grid">
${capturas.map((c) => `    <div class="muestra-item">
      <h2>${c.titulo}</h2>
      <div class="telefono">${c.html}</div>
    </div>`).join('\n')}
  </div>
</div>
</body>
</html>
`

fs.writeFileSync('dashboard-para-rediseno.html', salida)
console.log('Listo: dashboard-para-rediseno.html')
console.log('  pantallas incluidas: ' + capturas.map((c) => c.tab).join(', '))
console.log('  tamaño: ' + (fs.statSync('dashboard-para-rediseno.html').size / 1024).toFixed(0) + ' KB')

await browser.close()
