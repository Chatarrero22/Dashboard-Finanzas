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
webhook). Después de `git push` hay que apretar **Manual Deploy** en Render.
Avisale siempre a Emanuel que lo haga.

**Antes de investigar cualquier "no me funciona", chequeá que esté desplegado.**
Ya pasó tres veces: perdí un rato buscando bugs que no existían. En Ajustes hay
una tarjeta **Versión** con la huella del build; desde afuera se compara así:

```bash
curl -s https://dashboard-finanzas-n4g4.onrender.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
ls client/dist/assets/index-*.js   # el de acá
```

Si no coinciden, el deploy no entró y no hay nada que debuggear. Un **502**
suele ser el reinicio del deploy: esperá y reintentá antes de asustarte.

---

## Cómo se corre local

```bash
node server/index.js                 # todo junto: web + API + bot
cd client && npm run build           # después de tocar el frontend
```

Para probar sin ensuciar los datos reales:

```bash
DB_FILE=demo.db PORT=3999 TELEGRAM_BOT_TOKEN= node server/index.js
```

> **Nunca corras el bot local y el de Render al mismo tiempo**: Telegram solo
> admite un lector por token, se pelean y un gasto puede terminar en la base
> equivocada. Ya pasó. Por eso arriba va `TELEGRAM_BOT_TOKEN=` vacío.

Al terminar, borrá `data/demo.db*` y matá el proceso (ver más abajo: `pkill` no
sirve en Windows).

---

## Arquitectura

Un solo proceso Node sirve la API, el frontend compilado y el bot.
SQLite (`better-sqlite3`), un archivo, todo separado por `user_id`.

### `server/`

| Archivo | Qué hace |
|---|---|
| `index.js` | Arranca todo: express, estáticos, bot, gastos fijos, alertas |
| `config.js` | Config por entorno: `DATA_DIR`, `DB_FILE`, `PORT`, `APP_NAME` |
| `db.js` | Esquema + migraciones. **Las migraciones van antes de los índices** |
| `auth.js` | Login con scrypt, sesiones en cookie httpOnly, vínculo con Telegram |
| `api.js` | Todos los endpoints. `router.use(auth.requerido)` divide público/privado |
| `categorizer.js` | Categoriza con Claude (`claude-opus-5`) + reglas locales de respaldo |
| `aprendido.js` | Memoria: lo que corregís a mano queda para la próxima |
| `texto.js` | Deja prolijas las descripciones (marcas, mayúsculas, espacios) |
| `plata.js` | Entiende "5 lucas", "un palo y medio", "15k", "2.500,50" |
| `dolares.js` | Detecta montos en dólares y los pasa a pesos |
| `cuotas.js` | Parte una compra en N cuotas, una fila por mes |
| `correccion.js` | Entiende "perdón eran 22" como corrección, no como gasto nuevo |
| `medio-de-pago.js` | Con qué se pagó: la tarjeta por defecto, salvo que digas efectivo |
| `tarjetas.js` | Período de resumen, cierre, vencimiento y deuda pendiente |
| `cuentas.js` | Dónde está la plata y cómo moverla entre cuentas |
| `fijos.js` | Carga sola las suscripciones el día que se cobran |
| `parsers.js` | Importar resúmenes CSV / Excel / PDF |
| `prices.js` | Cripto (CoinMarketCap) y dólar (dolarapi, sin clave) |
| `mercado-arg.js` | Acciones, CEDEARs, bonos, letras y ONs en vivo (data912, sin clave) |
| `arbol.js` | Gamificación: XP, 8 etapas, racha, 11 logros |
| `alertas.js` | Avisos diarios por Telegram (10 hs, configurable con `HORA_AVISO`) |
| `alertas-pantalla.js` | Los mismos avisos pero de solo lectura, para `/api/alertas` |
| `version.js` | Qué build está corriendo (para saber si el deploy entró) |
| `telegram-bot.js` | El bot: parseo, tickets por foto, comandos, intenciones |

### `client/src/`

| Archivo | Qué hace |
|---|---|
| `App.jsx` | El grande: estado, navegación, y las pantallas que no salieron a un archivo |
| `Shell.jsx` | Barra lateral, barra de arriba y encabezado de pantalla |
| `Dialogos.jsx` | `<Modal>` y los diálogos propios (`confirmar`, `pedirTexto`) |
| `Numero.jsx` | Un monto que sube solo hasta su valor |
| `comunes.jsx` | `money`, fechas, `ICONOS` por categoría, `Empty` |
| `moneda.js` | Si los montos se muestran en pesos o dólares (botón ARS/US$) |
| `Resumen.jsx` `Patrimonio.jsx` `Alertas.jsx` `Gastos.jsx` | Pantallas |
| `Tarjetas.jsx` `Presupuestos.jsx` `Pnl.jsx` | Pantallas |
| `Cuentas.jsx` | Tus cuentas y mover plata. Vive **dentro de Patrimonio** |
| `Inversiones.jsx` | Pantalla: la cartera a precio de mercado |
| `Ayuda.jsx` | El tutorial paso a paso de cada sección |
| `Telegram.jsx` | El asistente para conectar el bot, paso a paso |
| `Arbol.jsx` | Dibuja el árbol en SVG |
| `Login.jsx` `Setup.jsx` | Entrada y primer arranque |

Estilos: `index.css` (tokens + base), `shell.css` (armazón, modales),
`pantallas.css` y `resumen.css`.

### Tablas

`users`, `sessions`, `transactions`, `transaction_items`, `subscriptions`,
`budgets`, `goals`, `portfolio_assets`, `user_stats`, `achievements`,
`alerts_sent`, `learned_categories`, `cards`, `card_payments`, `accounts`.

---

## Cómo se modela la plata

Esta es la parte que más cuesta y la que más fácil se rompe. Cada decisión de
acá se tomó por un motivo; si algo parece más simple de otra forma, leé el
motivo antes de cambiarlo.

**El gasto se cuenta el día de la compra.** No el día que sale la plata. Es lo
correcto para categorías, presupuestos y P&L: si comprás en agosto, gastaste en
agosto aunque pagues la tarjeta en septiembre.

**Categorías que NO son gastos: `Traspaso`, `Ajuste` y `Saldo inicial`.** Hay
que excluirlas de `byCategory`, `topExpenses` y `byDay`: no son un gasto EN
algo. De los **totales** (ingresos y gastos del mes) se excluyen solo
`Traspaso` y `Saldo inicial` — un `Ajuste` sí cuenta, porque representa plata
que realmente se movió y no se cargó. Si no, mover plata al
ahorro aparece como un gasto y el mes queda arruinado.

**Un traspaso entre cuentas son DOS movimientos que se anulan.** `-X` en la
cuenta de origen y `+X` en la de destino, con el mismo `transfer_group`. Que
sean dos y no uno es a propósito: así la suma de todos los movimientos sigue
dando tu plata total sin que ninguna consulta sepa que existen los traspasos.

**El saldo de una cuenta no se guarda.** Es la suma de sus movimientos. Guardarlo
sería tener dos verdades que se pueden contradecir.

**Con qué pagás casi siempre lo elegís vos.** Si pagás casi todo con una
tarjeta, marcarla una por una es imposible: hay un medio por defecto y todo va
ahí salvo que digas lo contrario («…en efectivo», «…con la Naranja»). Pero
**«débito o efectivo» tiene que ser una opción**: Camila paga poco con
crédito y si no, cada gasto le entra al resumen y hay que corregirlo a mano.
Se elige en Tarjetas.

**El pago del resumen de la tarjeta NO es un movimiento.** Las compras ya están
cargadas una por una; si además anotáramos el pago, el mes contaría el doble.
Por eso existe `card_payments`, que solo marca "el resumen que cerró tal día
está pagado" sin tocar `transactions`.

**Las cuotas son una fila por mes.** Cada una con su fecha, así cae sola en el
mes y en el resumen de tarjeta que corresponde. El redondeo va todo a la última
cuota: la suma tiene que dar el total exacto, siempre.

**Un gasto en dólares y una suscripción en dólares se guardan al revés, y está
bien:**

- Un **gasto suelto** se guarda **en pesos**, congelado al cambio del día
  (`amount_usd` y `usd_rate` guardan el original). Pasó una vez y ya está: si
  lo recalculáramos, todos los meses viejos se moverían cada vez que salta el
  dólar.
- Una **suscripción** se guarda **en dólares** y `fijos.js` la convierte cada
  mes al cambio de ese día. US$15 no te sale lo mismo en marzo que en agosto;
  congelarla haría que el gasto fijo mostrara un número que ya no pagás.

No confundir nada de esto con el botón **ARS/US$** de la barra de arriba: ese es
una forma de *mirar* lo mismo, usa la cotización de hoy y vive en `moneda.js`.

**El signo del `Ajuste` cambia lo que significa.** Son tres cosas, no dos:

- **`Ajuste` negativo** — la app decía que tenías **más** de lo que tenés.
  Hubo plata que **se fue** y nunca se cargó (pagaste el resumen de un mes que
  no anotaste). Es un gasto de verdad aunque no sepamos en qué. **Cuenta** en
  los totales del mes.
- **`Ajuste` positivo** — la app decía que tenías **menos**. Eso **no** es
  plata que ganaste: es plata que ya era tuya y la app no sabía. **No cuenta.**
- **`Saldo inicial`** — lo mismo que el anterior pero dicho a propósito
  («tengo un palo en el broker esperando»). **No cuenta.**

La asimetría no es un capricho, es cómo falla la memoria de la gente: el
sueldo se anota siempre, los gastos se olvidan. Si la app cree que tenés de
más, falta un gasto; si cree que tenés de menos, es plata que ya estaba.

Los tres quedan afuera de `byCategory` / `topExpenses` / `byDay`: no son un
gasto EN algo, no tienen dónde ir en la torta.

**Los dos lados me mordieron, uno por vez.** Primero saqué el `Ajuste` de los
totales razonando «una corrección no es un gasto», y el ahorro del mes de
Emanuel saltó de $109.367 a $1.059.436 —plata que él sabía que no tenía—.
Después dejé que el `Ajuste` positivo contara, y arreglar el saldo de una
cuenta le sumó **$59.345 de ingresos que nunca cobró**. El filtro vive en una
sola constante, `SIN_CORRECCIONES`, para que no se separen de nuevo.

**El saldo real se ajusta SIEMPRE de a una cuenta.** «Poner el saldo real»
compara contra el saldo de **una** cuenta y anota la diferencia ahí; las otras
no se tocan.

Antes ajustaba contra toda tu plata junta y anotaba la diferencia en la cuenta
principal. Suena parecido y no lo es: Emanuel miró el banco, vio $50.000, lo
escribió, y la app entendió «en total tengo $50.000» — así que le descontó a
la principal todo lo que había en las otras cuentas y la dejó en **-$9.045**.

**Nadie puede verificar un total.** Lo que una persona puede mirar es el saldo
de una cuenta, y eso es lo único contra lo que tiene sentido comparar.

El saldo de una cuenta se calcula en un solo lado, `cuentas.saldoDe()`: si
cada lado hiciera su propia cuenta, el ajuste corregiría una diferencia que no
existe.

**La plata que ya tenías y la app no sabía se anota como `Ajuste`.** Una
cuenta nueva puede nacer con saldo (`saldo_inicial` en `POST /cuentas`), y en
Inversiones podés decir «ya la tengo ahí» en vez de moverla de otro lado.
Antes la única forma de llenar una cuenta era transferir, así que cargar
«tengo un palo en el broker» dejaba la otra cuenta en un millón negativo.

**El resultado del mes no dice cuánto de eso ya tiene destino.** «Ahorré 300k
pero 200k los mandé a invertir, me quedan 100k»: eso es lo que la gente quiere
saber. El resultado del mes es un flujo y **no cambia** cuando movés plata de
lugar (está bien que no cambie), así que el Resumen lo aclara aparte:
`dashboard.apartado`.

**Apartar es MOVER plata a un costado, no que una cuenta crezca.** Se cuentan
dos cosas y nada más:

- los **traspasos** que entraron a una cuenta apartada (neto: si la sacaste,
  resta);
- las **compras de títulos** pagadas con plata que todavía no estaba apartada.

Si comprás un bono con plata que ya estaba en el broker, la cuenta baja y los
títulos suben: el apartado no se mueve, que es lo correcto — esa plata ya
estaba apartada.

Y **la cuenta principal nunca es una cuenta apartada, sea del tipo que sea**:
es donde vivís, no un costado.

Antes esto sumaba todo lo que pasara por una cuenta de tipo `ahorro` o
`inversion`, y con eso alcanzaba para mentir. La cuenta principal de Emanuel
es de tipo Ahorro, así que su sueldo, sus gastos y el ajuste de la tarjeta
contaban como si los hubiera apartado: el Resumen le decía «apartaste
$1.187.059» un mes en el que no había invertido nada. Un sueldo que cae en una
cuenta no es apartar, y un `Ajuste` mucho menos.

**«En tus cuentas» y «Ahorro del mes» son cosas distintas.** Un saldo y un
flujo, y se confunden fácil porque los dos son un peso con signo:

- **En tus cuentas** = `SUM(amount)` de **todos** los movimientos, de siempre,
  sin filtrar categoría. Es cuánta plata tenés.
- **Ahorro del mes** = ingresos menos gastos **de ese mes**. Es cómo te fue
  este mes.

La diferencia entre los dos es exactamente lo que arrastrás de los meses
anteriores (los traspasos no cuentan porque se anulan entre sí). Emanuel vio
$1.157.159 y $1.097.792 y preguntó por qué; la pantalla ahora lo explica sola
en vez de dejarte hacer la cuenta.

Ese cartel decía «Toda tu plata» y era mentira: con $50.000 en el banco y ocho
millones en títulos, mostraba $50.000. **Si un título dice «todo», que sea
todo.**

**Los montos se leen igual en los dos lados.** La gente escribe `1.000.000`,
no `1000000`. El front usa `montoDesde()` de `comunes.jsx` y el server usa
`plata.js`, y **tienen que seguir la misma regla**: si leyeran distinto, el
mismo gasto valdría una cosa por la web y otra por Telegram. Hay una prueba
que los compara.

Lo que había antes era `Number(texto.replace(/[^\d.]/g, ''))` y fallaba de dos
formas: `300.000` daba **300** —movía trescientos pesos sin avisar— y
`1.000.000` daba `NaN`, que apagaba el botón de guardar y parecía que la app
«no dejaba» con ciertos montos.

**Los negativos siempre con el menos.** `money()` no puede comerse el signo: un
saldo en rojo se lee igual que uno a favor.

**Las inversiones se valúan a mercado, cada una en su moneda.** La cripto
cotiza en dólares contra CoinMarketCap. Todo lo demás —acciones argentinas,
CEDEARs, bonos, letras y ONs— cotiza en la Bolsa de Buenos Aires y casi
siempre en pesos (`mercado-arg.js`, data912, sin clave). Cada activo guarda en
qué moneda está: **no se adivina por el ticker**. Los totales salen siempre en
pesos, convirtiendo lo que está en dólares al MEP.

**«Ahorro» no existe más como sección.** Con una sola cuenta mostraba un
número que ya estaba en la barra lateral, dos recuadros con uno en cero, una
tarjeta que repetía Inversiones y una lista de un elemento. Emanuel: «no
cumple ninguna función».

Lo que sí servía —saber que hay plata en la cuenta de otra persona o en un
plazo fijo, y poder moverla— se mudó a **Patrimonio**, que es la pantalla que
ya contestaba «cuánto tenés». Ahora contesta las dos: cuánto y dónde. El
componente es `Cuentas.jsx`.

**Toda acción tiene que tener su inversa, y en la misma pantalla.** En
Inversiones había «Agregar plata» y no había cómo sacarla: Emanuel pasó
$50.300 y se quedó sin forma de volver atrás. Ahora está «Sacar plata», y
pregunta lo mismo que al sacar un activo, porque son dos cosas que no se
pueden adivinar: o la plata **se va a otra cuenta tuya** (traspaso), o **nunca
estuvo ahí** y te equivocaste al cargarla (`Saldo inicial` negativo, no toca
el mes).

Es la misma familia que el botón «Mover plata» escondido detrás de
`lista.length > 1`: una función a la que le falta la mitad no es una función,
es una trampa.

**La plata que espera para comprar vive en Inversiones.** Es una cuenta de
tipo `inversion` como cualquier otra —la fuente de verdad sigue siendo
`accounts`— pero se **muestra** arriba de la cartera, como el efectivo
disponible de un broker, y no en Ahorro.

Antes era el tercer tipo de cuenta de Ahorro, «Invertido», y confundía: el
nombre hacía pensar que ahí ibas a ver tus acciones, y «pesos apartados para
invertir» es casi lo mismo que «ahorro». Emanuel lo dijo derecho: «se me
confunde». Ahorro quedó con dos tipos (Para gastar / Ahorro).

Por eso el hero de Ahorro dice **«En tus cuentas»** y no «Toda tu plata»: con
las inversiones afuera, ese título mentía. La tarjeta de abajo suma las dos
cosas para que nada desaparezca.

**Comprar un título saca la plata de una cuenta, y NO es un gasto.** Cuando
cargás un activo elegís de qué cuenta salió, y se anota **una sola pata** de
`-monto` con categoría `Traspaso`, atada al activo por `transactions.asset_id`.

Que sea una sola pata es al revés que un traspaso entre cuentas, y es a
propósito: en un traspaso los pesos siguen siendo pesos y por eso las dos
patas se anulan; acá los pesos **dejan de ser pesos** y pasan a ser un bono.
Tu plata en cuentas tiene que bajar de verdad. El patrimonio no cambia, porque
el título aparece del otro lado valuado a mercado.

Sin esto la misma plata se contaba dos veces: como pesos en la cuenta y como
título en la cartera.

**Sacar un activo son dos cosas distintas y no se pueden adivinar.** O lo
vendiste —y vuelve a una cuenta el **valor de hoy**, que es donde se hace real
la ganancia— o te equivocaste al cargarlo, y entonces se deshace la compra y la
cuenta queda como estaba. Lo pregunta la pantalla.

**Si no hay cotización, no inventamos.** El botón US$ se deshabilita, la API
responde 503 con un mensaje claro y una suscripción en dólares no se carga (se
reintenta al día siguiente). Preferible que falte un dato a que haya uno falso.

---

## Qué se ve y qué está tapado

- **Patrimonio e Inversiones arrancan tapadas.** Son las que muestran cuánta
  plata tenés en total. Se destapan con «Mostrar» y **se vuelven a tapar al
  salir de la sección** — el `key={tab}` del contenedor remonta la pantalla y
  el estado de `Privado` vuelve a false. Si quedara destapado no serviría.
- **El botón «Ocultar saldos» de la barra** tapa todo lo que tenga
  `.monto-sensible`, en todas las pantallas. Es aparte del anterior.
- **Lo que no está marcado se ve.** Había ocho secciones mostrando montos
  igual. Se chequea recorriendo la app con el modo prendido y buscando texto
  con pinta de plata que no esté tapado.
- **El botón «Actualizar»** de la barra vuelve a pedir todo lo de la pantalla
  actual, sin recargar. Usa `refrescar()`, la **única** lista de qué recargar:
  antes había dos que se habían ido separando.

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

Los formularios de alta abren en **pop-up**, nunca desplegados abajo de la
pantalla. Emanuel lo pidió explícitamente más de una vez.

---

## El tutorial

`Ayuda.jsx` tiene los pasos de cada sección. Un paso es `{ titulo, texto,
apunta }`, donde `apunta` es un **selector CSS de algo que existe de verdad en
la pantalla**: se le hace un agujero a la penumbra ahí encima y el cartel se
acomoda al lado.

- Se abre solo la primera vez que entrás a cada sección, y después queda en el
  botón `?` al lado del título.
- **Saltear cuenta como visto.** Si lo cerraste es porque no lo querés.
- Si el selector no encuentra nada, el paso **igual se muestra**, centrado y
  sin agujero. Una sección vacía todavía no tiene lista que marcar, y perder la
  explicación es peor que perder el resalte.
- Lo visto se guarda en `localStorage`, no en la base: es de este navegador. Se
  borra todo desde Ajustes → «Ver los tutoriales de nuevo».
- Al agregar una sección nueva, agregale la entrada en `GUIAS`. Si no está, el
  botón `?` no aparece y nadie se entera de que falta.

**Las claves de `GUIAS` son ids de sección, no los nombres que se ven.** Los
ids reales son `movs`, `subs`, `presu` — no `movimientos`, `fijos` ni
`presupuestos`. Escribirlos mal **no rompe nada**, y por eso es peligroso: la
guía simplemente no existe, el botón `?` no aparece y nadie se entera. Lo mismo
con los selectores de `apunta`: si no coinciden con nada, el paso se muestra
igual pero sin marcar nada.

Las dos cosas se chequean solas recorriendo la app: los ids contra los de
`App.jsx` y cada selector contra la pantalla de verdad.

---

## Conectar Telegram

`Telegram.jsx` guía la conexión en tres pasos: para qué sirve, el comando
`/vincular NNNNNN` listo para copiar con el link que abre el bot, y la
confirmación.

Lo que lo hace usable: **mientras esperás, pregunta cada 3 segundos a
`/api/telegram/estado` si ya te vinculaste** y se cierra solo. Antes mandabas
el código y te quedabas sin saber si había funcionado.

- El `@usuario` del bot no se puede escribir a mano en el código: cada
  instalación tiene el suyo. Se lo preguntamos a Telegram con `getMe()` al
  arrancar (`telegram-bot.js`, `quienEsElBot()`). Si falla, el asistente sigue
  andando: en vez del botón «Abrir Telegram» muestra cómo buscarlo a mano.
- La invitación del Resumen aparece solo si hay bot configurado y **esta
  persona** no lo conectó (`/me` devuelve `telegramVinculado`). Se puede sacar
  y no vuelve; queda en Ajustes.

**Para probar esto NO se levanta el bot de verdad.** Telegram admite un solo
lector por token: el bot local le robaría los mensajes al de producción y un
gasto podría terminar en la base equivocada. Se prueba con un token falso
—alcanza para que la app crea que hay bot— y simulando al bot con
`auth.vincularTelegram(codigo, chatId)`, que es exactamente lo que hace al
recibir `/vincular`.

---

## Lo que falta

Resumen, Patrimonio (con tus cuentas adentro), Alertas, Movimientos, Gastos,
Gastos fijos, Tarjetas, Presupuestos, P&L, Metas, Inversiones y Árbol, más
Ajustes y el alta en pop-up.

Queda:

1. **Inteligencia** y **Asistente** — chat con IA. Suma costo por uso.
2. **WhatsApp** — viable (hay dirección pública). Necesita webhook, número
   aparte y cuenta de Meta. Las conversaciones de servicio son gratis.
3. **Los dos números del Resumen** — "gastaste este mes" (lo de hoy) vs "sale de
   tu cuenta este mes" (el resumen que vence + lo que no es tarjeta). Los datos
   ya están; falta mostrarlos. Lo que **sí** se hizo es el reparto de lo
   ahorrado: cuánto ya apartaste y cuánto queda sin destino.
4. **La deuda de tarjeta en Patrimonio** — hoy resta bien el total pero no dice
   cuánto de eso es tarjeta sin pagar.

### Cosas del pasado que conviene saber

- El **modo simple ya no existe**: todos ven las 12 secciones. Escondía cosas
  que la persona necesitaba y no había forma de darse cuenta de por qué no
  aparecían. La columna `simple_ui` sigue en la base porque borrarla en SQLite
  es un lío, pero **no se lee**: `initDB()` la pone en 0. No la vuelvas a usar.
- La otra persona que usa la app es **Camila**.

---

## Cosas que ya nos mordieron

No las repitas.

### El entorno y las herramientas

**Los heredocs de bash se comen los escapes.** Es la que más veces mordió.

- Los **backticks** de los template literals de JSX rompen el heredoc y el
  archivo queda con saltos de línea literales dentro de strings.
- `\n` dentro de un string puede convertirse en un salto de línea real, y el
  archivo deja de compilar.
- `\b` dentro de un regex puede convertirse en el **carácter de retroceso**
  (byte `0x08`). Esto es lo peor: el archivo **compila**, el regex **nunca
  coincide**, y mirando el código no se ve nada raro.

Para strings con escapes usá la herramienta **Edit** o **Write**, no heredocs.
Para detectar el daño:

```bash
python -c "import io,glob; print([p for p in glob.glob('server/*.js') if b'\x08' in io.open(p,'rb').read()])"
```

(Este mismo archivo ya salió dañado una vez por escribirlo con un heredoc.)

**Reemplazos con Python que fallan callados.** `s.replace(viejo, nuevo)` no
avisa si no encontró nada e imprime "listo" igual. Poné `assert viejo in s`.
Ojo además: si el script hace varios reemplazos y uno falla, **no se escribe
ninguno** — verificá después con grep, no confíes en el "ok".

**`pkill` no mata procesos de Windows.** Desde git-bash no falla, no avisa,
simplemente no hace nada. El servidor nuevo tampoco puede tomar el puerto, se
muere calladito, y seguís probando contra el código de hace horas.

```powershell
Get-Process node | ForEach-Object { Stop-Process -Id $_.Id -Force }
```

Y para saber si el que responde es el nuevo, comparalo con el archivo:

```powershell
Get-Process node | Select-Object Id, StartTime
(Get-Item server\api.js).LastWriteTime
```

Si el proceso arrancó **antes** que la última edición, estás probando lo viejo.

**`cd x && ... &` deja el `cd` adentro del subshell.** El `&` aplica a toda la
cadena, así que el directorio de trabajo del shell no cambia y los comandos
siguientes corren donde no querías. Poné el `cd` en un statement aparte.

**Dos apps en el mismo puerto.** Windows deja convivir una en IPv4 y otra en
IPv6, y no sabés cuál te contesta. Si algo devuelve datos que no cierran,
revisá `Get-NetTCPConnection -State Listen -LocalPort 3999` antes que el código.

**Los tests dejan basura.** Si no reiniciás la base entre corridas, una prueba
que "falla" puede ser una fila que dejó la corrida anterior. Antes de dudar del
código, mirá si el dato ya estaba.

### El backend

**El bot guarda por su cuenta.** `telegram-bot.js` tiene su propio
`saveTransaction()` y **no pasa** por `insertTransactions()` de `api.js`. Todo
lo que se aplique al guardar (ordenar la descripción, categorías aprendidas,
tarjeta por defecto) hay que ponerlo en los dos lados o Telegram queda afuera.

**Ojo con tapar variables del módulo.** `var cat = ...` adentro de una función
tapa al `var cat = require('./categorizer.js')` de arriba, y como `var` se
eleva, la llamada explota con "Cannot read properties of undefined".

**Dos listas de recarga que se van separando.** Había una lista de qué
volver a pedir al cambiar de pestaña y otra al volver a la pestaña del
navegador, parecidas pero distintas: la segunda se olvidaba de Gastos fijos,
Inversiones y las cuotas, así que esas pantallas se quedaban con datos viejos
y no había forma de darse cuenta. Ahora hay una sola, `refrescar()`, que usan
el botón de actualizar y el regreso a la pestaña.

**Los avisos se consumen al calcularlos.** Las funciones de `alertas.js` llaman
a `esNuevo()`, que marca el aviso como enviado. Si una pantalla las usa, abrirla
apaga el aviso de Telegram del día. Por eso existe `alertas-pantalla.js`, que
calcula lo mismo sin escribir nada.

**Una casilla que solo prende y nunca apaga.** El PATCH de tarjetas hacía
`if (req.body.es_default)`, así que destildar «por defecto» no hacía nada. La
primera tarjeta que cargabas quedaba fija y **todos** los gastos le caían
encima: Camila paga casi todo con débito y no tenía forma de zafar, cada gasto
le entraba al resumen de crédito. Ahora hay un selector explícito en Tarjetas
—«Con qué pagás casi siempre», con «Débito o efectivo» como opción— y el
endpoint acepta `card_id: null`.

**Una acción que aparece sola cuando "ya tenés lo necesario" no existe.**
El botón «Mover plata» de Ahorro estaba detrás de `lista.length > 1`: con una
sola cuenta —que es como empezás— no había **ningún** botón para mover plata,
y el texto de abajo te hablaba igual de mover plata entre cuentas. Emanuel
concluyó, con razón, que la app solo le dejaba mover el total. Si una acción
necesita algo previo, mostrala igual y ofrecé crear ese algo ahí mismo.

**Ojo con lo que devuelve cada POST.** `POST /cuentas` devolvía la **lista
entera** en vez de la cuenta creada. Nadie lo usaba, así que no molestaba,
hasta que hubo que crear una cuenta para usarla enseguida: el id venía
`undefined` y el traspaso salía sin destino. Ahora devuelve la creada, como el
resto de los POST.

**Deduplicar contando, no preguntando.** El importador usaba "¿existe uno
igual?" y perdía movimientos legítimamente repetidos (dos cafés iguales el mismo
día). Hay que contar cuántos hay y cuántos trae el archivo.

**Tickers de cripto repetidos.** CoinMarketCap devuelve un array cuando el
símbolo está repetido (hay decenas de monedas "W", "RWA", "PIXEL") y el orden no
es estable. Hay que elegir por `cmc_rank` / capitalización, si no el patrimonio
varía 4x entre cargas.

**Los bonos cotizan cada 100 nominales, no por unidad.** Vale para bonos,
letras y ONs; las acciones y los CEDEARs sí van por unidad. Si tenés 100.000
nominales de AL30 a 84.350, no tenés 8.435 millones: tenés `cantidad x precio
/ 100`. Sin esa división el patrimonio se va **100 veces** para arriba. La
cuenta vive en un solo lado a propósito: `mercado.valuar()`.

**La moneda de una especie NO se puede adivinar por el ticker.** La tentación
es "si termina en D es en dólares" (AL30 / AL30D / AL30C). Pero **YPFD es una
acción en pesos**, y entre los CEDEARs hay AMD, HD, MCD, GILD, JD y uno que se
llama C. Adivinando, el patrimonio se multiplica o se divide por mil y no se
nota. Por eso la moneda la elige la persona al cargar el activo y se guarda en
`portfolio_assets.currency`.

Para chequear que las dos cosas están bien hay un truco lindo: cargá la misma
tenencia en su versión pesos y en su versión dólares (AL30 y AL30D, mismos
nominales). Los dos valores en pesos tienen que dar casi igual — la diferencia
es solo el spread del MEP. Si dan 100x o 1500x distinto, se rompió la lámina o
la conversión.

**La cartera se valúa EN PESOS.** Toda la app guarda y muestra pesos, y el
botón ARS/US$ convierte solo al dibujar. `/api/portfolio` devolvía dólares
cuando solo había cripto; si volviera a hacerlo, el mismo número se
convertiría dos veces.

**La ganancia se mide solo sobre lo que tiene precio de compra.** Si un activo
sin costo cargado suma su valor al P&L, aparece como ganancia pura: la cartera
decía +110% cuando en realidad no sabíamos a cuánto se había comprado.

Ojo con la condición: un activo sin costo cargado tiene costo **0, no nulo**.
Con `cost != null` la fila mostraba toda la tenencia como ganancia. Va `cost`
a secas, en los dos lados: el total y cada activo.

**Se tiene que poder editar lo que se carga.** El precio de compra solo se
pedía al dar de alta el activo; si te lo salteabas, la ganancia quedaba en «—»
para siempre y no había forma de arreglarlo. La API ya tenía el PATCH: lo que
faltaba era la pantalla.

**El orden de las reglas de categorización manda.** Gana la primera que
coincide, y se busca como subcadena: `dia` pega dentro de `dias`. Por eso
`Gustitos` va después de `Delivery` (para que "rappi" siga siendo Delivery) y
las palabras cortas o ambiguas son peligrosas.

**El disco de Render.** Si no está montado en `/data`, los datos se borran en
cada deploy. Se verifica creando algo, redesplegando y viendo si sobrevive.

### El frontend

**`.nav-pc` heredaba `position: fixed`.** La barra lateral no se parecía en nada
al diseño y el motivo no estaba en el layout: heredaba el `position: fixed;
bottom: 0` de `.nav`, la barra del celular. Si algo "no se parece al diseño",
fijate qué está heredando antes de reescribir el componente.

**Los hijos de una grilla no se achican solos.** Arrancan con `min-width: auto`,
así que un texto largo o un monto grande ensanchan la columna y aparece scroll
horizontal a 320px. Hay que ponerles `min-width: 0` (está en `shell.css`).

**Un modal más alto que la pantalla deja el botón afuera.** El overlay centra
con flex; si el formulario no entra, el botón de guardar queda fuera de la vista
y no hay forma de llegar. `.dialogo` lleva `max-height: calc(100dvh - 40px)` +
`overflow-y: auto`, y `.dialogo-botones` va `sticky` abajo.

**Una acción pendiente que no se limpia abre modales solos.** Los botones del
encabezado (`+ Nuevo…`) viven en `App` y las pantallas los reciben por props. Si
la acción queda guardada, al volver el `useEffect` la ve al montarse y abre el
formulario. Se limpia en `irA()`, **antes** de cambiar de pestaña: los efectos
de los hijos corren antes que los del padre.

**`transform` de CSS vs atributo `transform` de SVG.** Si el elemento tiene
`transform="rotate(...)"` y además una animación CSS que usa `transform`, el CSS
gana y el dibujo se va volando. La rotación va en un `<g>` y la animación en el
hijo.

**Una animación con `both` y retardo arranca invisible.** El anillo de la rueda
se veía como un disco lleno porque el centro tenía `opacity: 0` durante el
retardo. Lo que tapa algo no puede desvanecerse.

**Un monto en dólares no se suma sin convertir.** El total de «Suscripciones
por mes» hacía `sum + s.amount` a secas, y como las suscripciones en dólares
se guardan EN DÓLARES, Netflix a US$10,11 sumaba **diez pesos con once**. El
total daba $59.212 cuando eran $74.678.

Lo difícil de ver: **la fila de al lado ya convertía bien** («≈ $15.476»), así
que la pantalla se contradecía a sí misma sin que saltara a la vista. El
server lo hacía bien; era solo el frontend. Al sumar montos, fijate siempre si
la lista puede tener más de una moneda.

**Corré el linter: `cd client && npm run lint`.** Estuvo roto un tiempo
(faltaba `@babel/core` en `node_modules`) y por eso nadie lo usaba. Una
variable que quedó huérfana después de un refactor —`setSaldo`, tras sacar su
`useState`— compiló igual y explotó recién al apretar el botón. `vite build`
NO caza esto; `no-undef` sí, en un segundo.

Quedan avisos preexistentes de `react-refresh` y `react-hooks` que no son
bugs; lo que no puede aparecer nunca es un `no-undef`.

**Reemplazar en un archivo grande pega en la primera coincidencia.** Puse una
consulta nueva en `/networth` buscando `var cartera = await valuarCartera(...)`,
que aparece **también** en `/portfolio` y está antes. El código quedó en el
endpoint equivocado y `/networth` empezó a tirar 500 en producción: sin él no
hay cotización del dólar, así que se apagó el botón US$, los dólares dejaron
de convertirse y Patrimonio quedó vacío. Un solo reemplazo mal ubicado rompió
media app. Verificá **después** del último cambio, no antes.

**Patrimonio e Inversiones arrancan tapadas.** Son las dos que muestran
cuánta plata tenés en total, o sea lo más privado: alcanza con que alguien
pase por al lado. Se destapan con el botón «Mostrar» y **se vuelven a tapar
solas al salir de la sección**, porque el `key={tab}` del contenedor las
remonta y el estado del componente `Privado` vuelve a arrancar en false. Eso
es a propósito: si quedara destapado dejaría de servir.

`Privado` reusa la clase `.oculto` del botón de la barra. Como el selector es
`.oculto .monto-sensible`, ponerla en cualquier envoltorio de adentro tapa lo
que haya abajo — no hizo falta CSS nuevo.

**Ocultar saldos: lo que no está marcado, se ve.** El botón tapa lo que tenga
`.monto-sensible`, y era fácil olvidárselo al agregar una pantalla: había 8
secciones mostrando montos igual. Se chequea solo recorriendo la app con el
modo prendido y buscando texto con pinta de plata que no esté tapado.

**Los íconos por categoría tienen que coincidir exactamente.** `ICONOS` en
`comunes.jsx` y `EMOJIS` en `telegram-bot.js` se indexan por el nombre de
`CATEGORIES`. Escribir "Educación" con tilde cuando la categoría es "Educacion"
no falla: simplemente sale el ícono genérico. Al agregar una categoría,
verificá que las dos listas la tengan.

**El texto que se muestra puede tener caracteres combinantes.** `⃠` (U+20E0) se
dibuja *encima* de la letra anterior: "⃠ Ocultar" se veía como una O tachada.
Si un ícono de texto se ve raro, revisá que no sea combinante.

---

## Cómo trabajar acá

- **Verificá con capturas reales**, no con "debería andar". Playwright está
  instalado: sacá screenshots a 1440px, iPhone 13 (390) y 320px, en claro y
  oscuro, y **miralas**. Varios bugs (hojas voladoras, barra desbordada, signo
  perdido, botón fuera de pantalla, anillo lleno) aparecieron solo mirando.
- Chequeá siempre: sin scroll horizontal a 320px, sin errores de consola, modo
  oscuro completo, y que ninguna pantalla abra un modal sola al entrar.
- Los scripts de prueba van con nombres tipo `t12.mjs` — están en `.gitignore`
  y **hay que borrarlos** antes de commitear.
- Español rioplatense en todo lo que ve el usuario. Comentarios del código
  también en español.
- Emanuel prefiere que le expliques el porqué, no solo el qué. Y que le avises
  cuando algo es decisión suya (plata, borrar cosas, publicar).
