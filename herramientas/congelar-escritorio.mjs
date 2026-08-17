/**
 * Congela la version de ESCRITORIO (la app original, en localhost:5173) en un
 * unico archivo HTML autocontenido, para pasarselo a un diseñador.
 *
 * La app vieja tiene los estilos escritos dentro del JSX, asi que al copiar el
 * HTML renderizado los estilos viajan solos.
 *
 *   node congelar-escritorio.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = 'http://localhost:5173'
const ANCHO = 1440
const ALTO = 950

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: ANCHO, height: ALTO } })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })

await page.waitForTimeout(3500)

// El menu lateral tiene el emoji pegado al texto, asi que buscamos por
// coincidencia parcial en vez de exacta.
const secciones = ['Dashboard', 'Inversiones', 'Inteligencia', 'Gastos', 'Movimientos', 'Asistente IA']

const capturas = []

for (const nombre of secciones) {
  try {
    if (capturas.length > 0) {
      await page.getByText(nombre).first().click({ timeout: 8000 })
      await page.waitForTimeout(2600)
    }
    const html = await page.evaluate(() => {
      const root = document.getElementById('root')
      if (!root) return ''
      const copia = root.cloneNode(true)
      copia.querySelectorAll('script').forEach((s) => s.remove())
      // los canvas no sobreviven al clonado: los reemplazamos por un aviso
      copia.querySelectorAll('canvas').forEach((c) => {
        const d = document.createElement('div')
        d.setAttribute('data-era-canvas', '1')
        d.style.cssText = 'height:' + (c.height || 200) + 'px;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px;border:1px dashed #555;border-radius:8px'
        d.textContent = '(gráfico)'
        c.replaceWith(d)
      })
      return copia.innerHTML
    })
    if (html) capturas.push({ nombre, html })
    console.log('  capturada: ' + nombre)
  } catch (err) {
    console.log('  (no pude capturar ' + nombre + ': ' + err.message.split('\n')[0] + ')')
  }
}

// El poco CSS global que tiene
const cssGlobal = await page.evaluate(async () => {
  let txt = ''
  for (const l of document.querySelectorAll('link[rel=stylesheet]')) {
    try { txt += await (await fetch(l.href)).text() } catch (e) { /* ignorar */ }
  }
  for (const st of document.querySelectorAll('style')) txt += st.textContent
  return txt
})

const salida = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Dashboard de escritorio — versión original congelada</title>
<style>
${cssGlobal}
/* --- solo para esta hoja de muestra --- */
body { margin:0; background:#0f0f14; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.era-nota { max-width:${ANCHO}px; margin:0 auto; padding:28px 20px 8px; color:#ddd; }
.era-nota h1 { margin:0 0 8px; font-size:1.5rem; }
.era-nota p { margin:0 0 4px; color:#9a9aa5; font-size:.92rem; line-height:1.5; }
.era-seccion { max-width:${ANCHO}px; margin:0 auto 40px; }
.era-seccion > h2 { color:#8b8b96; font-size:.82rem; font-weight:600; text-transform:uppercase;
  letter-spacing:.08em; padding:22px 20px 10px; margin:0; }
.era-marco { width:${ANCHO}px; overflow:hidden; border:1px solid #2a2a35; border-radius:12px; }
</style>
</head>
<body>
<div class="era-nota">
  <h1>Dashboard de Finanzas — versión de escritorio</h1>
  <p>Copia congelada de la app real, con datos reales, a ${ANCHO}px de ancho. Los estilos están
     escritos dentro del HTML (la app original los tiene inline), así que se pueden editar acá mismo.</p>
  <p>El objetivo es mejorar esto visualmente: jerarquía, color, tipografía, espaciado y densidad.
     Mantener el idioma (español rioplatense) y que siga siendo legible y serio, tipo app de banco.</p>
</div>
${capturas.map((c) => `<div class="era-seccion">
  <h2>${c.nombre}</h2>
  <div class="era-marco">${c.html}</div>
</div>`).join('\n')}
</body>
</html>
`

fs.writeFileSync('escritorio-original.html', salida)
console.log('')
console.log('Listo: escritorio-original.html')
console.log('  secciones: ' + capturas.length)
console.log('  tamaño: ' + (fs.statSync('escritorio-original.html').size / 1024).toFixed(0) + ' KB')
await browser.close()
