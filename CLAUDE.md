# Manguito — contexto para Claude

Leé esto antes de tocar nada. Es el estado real del proyecto, no la teoría.

---

## Qué es

App de finanzas personales, en español rioplatense, para **Emanuel** (Argentina).
Multiusuario, mobile-first, con bot de Telegram. El asistente se llama
**Manguito** 🥭.

**Está en producción y en uso.** No es un experimento: si rompés algo, se rompe
la app que la persona usa todos los días.

---

## Dónde vive cada cosa

| | |
|---|---|
| Código | `C:\Users\Usuario\Desktop\emanuel-finance` |
| Producción | https://dashboard-finanzas-n4g4.onrender.com |
| Repo | https://github.com/Chatarrero22/Dashboard-Finanzas (**público**) |
| Hosting | Render, plan Hobby + servicio Starter (US$7/mes) + disco 1 GB en `/data` |
| Bot | [@Emanuel_Finance_bot](https://t.me/Emanuel_Finance_bot), se muestra como "Manguito" |
| Respaldos | `Escritorio\emanuel-finance-BACKUP-2026-08-01` |

> ⚠️ **El repo es público.** Nunca commitees contraseñas, montos reales, `.env`
> ni bases de datos. Ya está todo en `.gitignore`; verificá antes de agregar
> archivos nuevos (sobre todo los `.html` congelados, que llevan montos).

### Deploy

Render **no despliega solo** (el repo se conectó por "Public Git Repository", sin
webhook). Después de `git push`, hay que apretar **Manual Deploy** en Render.
Avisale siempre a Emanuel que lo haga.

**Antes de investigar cualquier "no me funciona", chequeá que esté desplegado.**
Ya pasó tres veces. En Ajustes hay una tarjeta **Versión** con la huella del
build (`index-XXXX`), y desde afuera se ve así:

```bash
curl -s https://dashboard-finanzas-n4g4.onrender.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
ls client/dist/assets/index-*.js   # el de acá
```

Si no coinciden, el deploy no entró y no hay nada que debuggear.

---

## Cómo se corre local

```
node server/index.js                 # todo junto: web + API + bot
cd client && npm run build           # después de tocar el frontend
```

Para probar sin ensuciar los datos reales:

```
DB_FILE=demo.db PORT=3999 TELEGRAM_BOT_TOKEN= node server/index.js
```

> **Nunca corras el bot local y el de Render al mismo tiempo**: Telegram solo
> admite un lector por token, se pelean y un gasto puede terminar en la base
> equivocada. Ya pasó. Por eso arriba va `TELEGRAM_BOT_TOKEN=` vacío.

---

## Arquitectura

Un solo proceso Node sirve la API, el frontend compilado y el bot.
SQLite (`better-sqlite3`), un archivo, todo separado por `user_id`.

### `server/`

| Archivo | Qué hace |
|---|---|
| `index.js` | Arranca todo: express, estáticos, bot, gastos fijos, alertas |
| `config.js` | Config por entorno. `DATA_DIR`, `DB_FILE`, `PORT`, `APP_NAME` |
| `db.js` | Esquema + migraciones. **Las migraciones van antes de los índices** |
| `auth.js` | Login con scrypt, sesiones en cookie httpOnly, vínculo con Telegram |
| `api.js` | Todos los endpoints. `router.use(auth.requerido)` divide público/privado |
| `categorizer.js` | Categorización con Claude (`claude-opus-5`) + reglas locales de respaldo |
| `plata.js` | Entiende "5 lucas", "un palo y medio", "15k", "2.500,50" |
| `parsers.js` | Importar resúmenes CSV / Excel / PDF |
| `prices.js` | Cripto (CoinMarketCap) y dólar (dolarapi, sin clave) |
| `fijos.js` | Carga sola las suscripciones el día que se cobran |
| `arbol.js` | Gamificación: XP, 8 etapas, racha, 11 logros |
| `alertas.js` | Avisos diarios por Telegram (10 hs, configurable con `HORA_AVISO`) |
| `alertas-pantalla.js` | Los mismos avisos pero de solo lectura, para `/api/alertas` |
| `texto.js` | Deja prolijas las descripciones (marcas, mayúsculas, espacios) |
| `aprendido.js` | Memoria de categorías: lo que corregís a mano queda para la próxima |
| `correccion.js` | Entiende "perdón eran 22" como corrección, no como gasto nuevo |
| `tarjetas.js` | Tarjetas: período de resumen, cierre, vencimiento y deuda pendiente |
| `cuotas.js` | Parte una compra en N cuotas, una fila por mes |
| `medio-de-pago.js` | Con qué se pagó: la tarjeta por defecto, salvo que digas efectivo |
| `dolares.js` | Gastos en dólares: los pasa a pesos al cambio del día |
| `telegram-bot.js` | El bot: parseo, tickets por foto, comandos, intenciones |

### `client/src/`

`App.jsx` es grande (pantallas Home, Agregar, Movimientos, Metas, Subs, Cripto,
Ajustes, Árbol, Menú). `Pnl.jsx` y `Presupuestos.jsx` son pantallas aparte;
`comunes.jsx` tiene los helpers compartidos (`money`, `monthLabel`, `Empty`,
`BudgetList`). `Arbol.jsx` dibuja el árbol en SVG.

Estilos: `index.css` (tokens + base) y `pantallas.css` (KPIs, P&L, tablas, menú).

### Tablas

`users`, `sessions`, `transactions`, `transaction_items`, `subscriptions`,
`budgets`, `goals`, `portfolio_assets`, `user_stats`, `achievements`,
`alerts_sent`, `learned_categories`, `cards`, `card_payments`.

---

## Diseño

El sistema visual sale del proyecto de Claude Design **Manguito.dc.html**
(id `27b3894e-ad36-4773-b796-6b8450c0453f`, se lee con la herramienta
DesignSync). Los tokens de los dos temas están copiados tal cual en `index.css`.

- Claro: crema cálido `#FFF7EB`, texto `#2A1C0C`, acento `#EE8A17`
- Oscuro: **no es el claro invertido**, es su propia paleta: `#0C0A07`, texto
  `#FBF3E6`, acento `#F5A524`
- Fuentes: **Archivo** para números y títulos, **Instrument Sans** para el resto
- Los tres bloques de tokens (`:root`, media dark, `[data-theme=dark]`) tienen
  que quedar siempre completos

`DISENO.md` tiene el inventario de clases y las restricciones (16px en inputs,
44px de alto tocable, nada de scroll horizontal a 320px).

---

## Lo que falta (por orden de conveniencia)

El diseño tiene 14 pantallas. Hechas: Resumen, Patrimonio, Alertas, Movimientos,
Gastos, Gastos fijos, Presupuestos, P&L, Metas, Inversiones, Árbol, Ajustes,
Agregar.

El armazón del diseño ya está: barra lateral (logo, "+ Nuevo movimiento",
tarjeta de ahorro del mes, los tres grupos, el usuario abajo que lleva a
Ajustes) y barra de arriba (ARS/US$, navegador de meses, dólar en vivo, tema,
"Ocultar montos"). Vive en `Shell.jsx` + `shell.css`.

1. **Ahorro** — necesita una tabla nueva (plazos fijos, cuentas) y su pantalla
   de carga. Es trabajo de verdad, no maquetado.
2. **Inteligencia** y **Asistente** — chat con IA. Suma costo por uso.

Otros pendientes:
- **WhatsApp**: ahora es viable (hay dirección pública). Necesita webhook, número
  aparte y cuenta de Meta. Las conversaciones de servicio son gratis.
- El usuario de **Sofía** puede estar sin crear en producción.
- El **modo simple ya no existe**: todos ven las 12 secciones. Escondía cosas
  que la persona necesitaba y no había forma de darse cuenta de por qué no
  aparecían. La columna `simple_ui` sigue en la base porque borrarla en SQLite
  es un lío, pero **no se lee**: `initDB()` la pone en 0. No la vuelvas a usar.
- La conversión a US$ usa el blue de `/api/networth`. Si algún día se quiere el
  MEP (que es lo que dice el diseño), hay que sumarlo en `prices.js`.

---

## Cosas que ya nos mordieron

No las repitas.

**Heredocs de bash con JSX.** Los backticks de los template literals rompen el
heredoc y el archivo queda con saltos de línea literales dentro de strings.
Para JSX usá la herramienta Write o archivos aparte, no `cat <<'EOF'`.

**Reemplazos con Python que fallan callados.** `s.replace(viejo, nuevo)` no
avisa si no encontró nada e imprime "listo" igual. Poné `assert viejo in s` o
verificá después con grep.

**`transform` de CSS vs atributo `transform` de SVG.** Si el elemento tiene
`transform="rotate(...)"` y además una animación CSS que usa `transform`, el CSS
gana y el dibujo se va volando. La rotación va en un `<g>` y la animación en el
hijo.

**Un modal más alto que la pantalla deja el botón afuera.** El overlay
centra con flex; si el formulario no entra, el botón de guardar queda fuera de
la vista y no hay forma de llegar. En el celular pasó con el alta de un
movimiento. `.dialogo` lleva `max-height: calc(100dvh - 40px)` +
`overflow-y: auto`, y `.dialogo-botones` va `sticky` abajo.

**Un gasto suelto y una suscripción en dólares se guardan al revés.** Un gasto
suelto va **en pesos**, congelado al cambio del día (pasó una vez y ya está).
Una suscripción va **en dólares**, y `fijos.js` la convierte cada mes al cambio
de ese día: US$15 no te sale lo mismo en marzo que en agosto, y congelarla haría
que el gasto fijo dijera un número que ya no pagás. No los unifiques.

**Los gastos en dólares se guardan en PESOS.** `amount` siempre está en pesos,
convertido al cambio del día en que se cargó, y queda congelado: que el dólar
suba después no cambia lo que te salió ese día. `amount_usd` y `usd_rate`
guardan el original para poder mostrarlo. Si se recalculara al cambio de hoy,
todos los meses viejos se moverían solos cada vez que salta el dólar.

No confundirlo con el botón ARS/US$ de la barra de arriba: ese es una forma
de **mirar** lo mismo y sí usa la cotización de hoy (`moneda.js`).

**El pago del resumen NO es un movimiento.** Las compras de la tarjeta ya
están cargadas una por una, así que si además anotáramos el pago del resumen
como un gasto, el mes contaría el doble. Por eso existe la tabla
`card_payments`: solo marca "el resumen que cerró tal día está pagado", sin
tocar `transactions`. Si alguna vez parece más simple guardarlo como un
movimiento, no lo es.

**Los heredocs también se comen ``.** Además de romper los backticks del
JSX, un `<<'PY'` puede convertir `` dentro de un regex en el **carácter de
retroceso** (byte 0x08). El archivo compila, el regex nunca coincide, y no se
ve mirando el código. Para detectarlo:

```bash
python -c "import io,glob; print([p for p in glob.glob('server/*.js') if b'' in io.open(p,'rb').read()])"
```

Para strings con escapes, usá la herramienta Edit, no heredocs.

**Una acción pendiente que no se limpia abre modales solos.** Los botones del
encabezado (`+ Nuevo…`) viven en `App` y las pantallas los reciben por props.
Si la acción queda guardada, al volver a esa pantalla el `useEffect` la ve al
montarse y abre el formulario solo. Se limpia en `irA()`, **antes** de cambiar
de pestaña: los efectos de los hijos corren antes que los del padre, así que
limpiarla en un efecto no alcanza.

**El bot guarda por su cuenta.** `telegram-bot.js` tiene su propio
`saveTransaction()` y **no pasa** por `insertTransactions()` de `api.js`. Todo
lo que se aplique al guardar (ordenar la descripción, categorías aprendidas)
hay que ponerlo en los dos lados o Telegram queda afuera. Ya pasó con el
ordenado de textos.

**El servidor viejo sigue vivo y `pkill` no lo mata.** `pkill -f "node
server/index.js"` desde git-bash **no mata procesos de Windows**: no falla, no
avisa, simplemente no hace nada. El servidor nuevo tampoco puede tomar el
puerto, así que se muere calladito, y vos seguís probando contra el código de
hace horas. Pasó: estuve un rato convencido de que un arreglo no funcionaba.

Para matarlo de verdad, PowerShell:

```powershell
Get-Process node | ForEach-Object { Stop-Process -Id $_.Id -Force }
```

Y para saber si el que responde es el nuevo, comparalo con el archivo:

```powershell
Get-Process node | Select-Object Id, StartTime
(Get-Item serverpi.js).LastWriteTime
```

Si el proceso arrancó **antes** que la última edición, estás probando lo viejo.

**Ojo con tapar variables del módulo.** `var cat = ...` adentro de una función
tapa al `var cat = require('./categorizer.js')` de arriba, y como `var` se
eleva, la llamada explota con "Cannot read properties of undefined". Si la
variable local se llama igual que un módulo importado, cambiale el nombre.

**Los hijos de una grilla no se achican solos.** Un `grid-template-columns:
1fr` no alcanza: los hijos arrancan con `min-width: auto`, así que un texto
largo o un monto grande ensanchan la columna y aparece scroll horizontal a
320px. Hay que ponerles `min-width: 0` (está en `shell.css`).

**Dos apps en el puerto 3001.** Windows deja convivir una en IPv4 y otra en
IPv6, y no sabés cuál te contesta. Si algo devuelve datos que no cierran,
revisá `Get-NetTCPConnection -State Listen -LocalPort 3001` antes que el código.

**Deduplicar contando, no preguntando.** El importador usaba "¿existe uno
igual?" y perdía movimientos legítimamente repetidos (dos cafés iguales el mismo
día). Hay que contar cuántos hay y cuántos trae el archivo.

**Tickers de cripto repetidos.** CoinMarketCap devuelve un array cuando el
símbolo está repetido (hay decenas de monedas "W", "RWA", "PIXEL") y el orden no
es estable. Hay que elegir por `cmc_rank` / capitalización, si no el patrimonio
varía 4x entre cargas.

**Los avisos se consumen al calcularlos.** Las funciones de `alertas.js`
llaman a `esNuevo()`, que marca el aviso como enviado en `alerts_sent`. Si una
pantalla las usa, abrir esa pantalla apaga el aviso de Telegram del día. Por eso
existe `alertas-pantalla.js`, que calcula lo mismo sin escribir nada.

**`.nav-pc` heredaba `position: fixed`.** La barra lateral de escritorio no se
parecía en nada al diseño y el motivo no estaba en el layout: `.nav-pc` no tenía
estilos propios y se comía el `position: fixed; bottom: 0` de `.nav`, la barra
del celular. Era la barra de abajo con títulos encima. Si algo "no se parece al
diseño", fijate qué está heredando antes de reescribir el componente.

**Los negativos siempre con el menos.** `money()` no puede comerse el signo: un
saldo en rojo se lee igual que uno a favor.

**El disco de Render.** Si no está montado en `/data`, los datos se borran en
cada deploy. Se verifica creando algo, redesplegando y viendo si sobrevive.

---

## Cómo trabajar acá

- **Verificá con capturas reales**, no con "debería andar". Playwright está
  instalado: sacá screenshots a tamaño iPhone 13 y 1440px, en claro y oscuro,
  y miralas. Varios bugs (hojas voladoras, barra desbordada, signo perdido)
  aparecieron solo mirando.
- Chequeá siempre: sin scroll horizontal a 320px, sin errores de consola, modo
  oscuro completo.
- Español rioplatense en todo lo que ve el usuario. Comentarios del código
  también en español.
- Emanuel prefiere que le expliques el porqué, no solo el qué. Y que le avises
  cuando algo es decisión suya (plata, borrar cosas, publicar).
