# Guía de diseño — para rediseñar `client/src/index.css`

App de finanzas personales, en español rioplatense, **primero celular**.
Se usa parada en la calle, con una mano, para anotar un gasto en 5 segundos.

## Regla principal

**Cambiá los estilos, no los nombres de las clases.** La app (`App.jsx`) escribe
estos nombres; si los renombrás o agregás clases nuevas, deja de aplicarse el
estilo. Todo el rediseño tiene que entrar solo en `index.css`.

## Restricciones que no se pueden romper

| Qué | Por qué |
|---|---|
| Inputs con `font-size: 16px` | Con menos, iOS hace zoom solo al tocar el campo |
| Botones y zonas tocables ≥ 44px de alto | Dedo, no mouse |
| Nada de scroll horizontal a 320px de ancho | Es el celular más angosto que hay |
| Modo claro **y** oscuro, los dos definidos | Se usa de día y de noche |
| Respetar `env(safe-area-inset-*)` | La barra de gestos del iPhone tapa la navegación |
| `@media (prefers-reduced-motion)` apaga animaciones | Accesibilidad |
| Los montos con `font-variant-numeric: tabular-nums` | Si no, los números "bailan" al actualizarse |

## Tokens (variables) que ya existen

Definidos en `:root`, con su versión oscura en `@media (prefers-color-scheme: dark)`
y en `:root[data-theme='dark']`. **Los tres bloques tienen que quedar completos.**

```
--surface-0  fondo de la pantalla
--surface-1  fondo de las tarjetas
--surface-2  fondo de inputs
--border / --border-strong
--text-primary / --text-secondary / --text-muted
--accent        azul de acción (botones, barras)
--good          verde: plata que entra
--critical      rojo: plata que sale, errores
--radius / --radius-sm / --shadow
--safe-top / --safe-bottom / --nav-height
```

El verde y el rojo cargan significado (entra / sale). Se pueden cambiar de tono
pero no de rol.

## Estructura de la pantalla

```
.app
├── .topbar            nombre de la persona + mes (pegada arriba)
├── .screen            columna de tarjetas, max 720px, centrada
│   └── (tarjetas)
└── .nav               navegación fija abajo, 4 a 7 botones con emoji + texto
```

## Inventario de piezas

**Contenedores**
- `.card` — la tarjeta base, casi todo vive acá dentro
- `.card-title-row` — título + un botón chico a la derecha
- `.hero` — el número grande protagonista (saldo del mes, patrimonio)
  - `.hero .value.positive` verde / `.negative` rojo
- `.stat-row` + `.stat` — dos cuadraditos lado a lado (Entró / Salió)
  - `.stat .dot.in` / `.dot.out` — puntito de color

**Gráficos** (hechos a mano con divs, sin librerías)
- `.bars` > `.bar-row` > `.bar-head` (`.bar-name`, `.bar-value`) + `.bar-track` > `.bar-fill`
  — gasto por categoría, barras horizontales de un solo color
- `.months` > `.month-col` > `.month-bar` + `.month-label`
  — gasto por mes, barras verticales

**Presupuestos** — barra con semáforo
- `.budget` > `.budget-head` (`.budget-name`, `.budget-nums`) + `.budget-track` > `.budget-fill`
- `.budget-fill` tiene 3 estados: sin clase extra (ok), `.cerca` (80%+), `.pasado` (100%+)
- `.budget-left` — texto de cuánto queda, con los mismos 3 estados

**Metas de ahorro**
- `.goal` > `.goal-head` (`.goal-name`, `.goal-pct`) + `.goal-track` > `.goal-fill` + `.goal-meta`
- `.goal-fill.done` — meta cumplida
- `.goal-actions` — tres botones (sumar, sacar, borrar)
- `.celebrate` — animación cuando se completa una meta

**Listas**
- `.list` > `.item` > `.item-main` (`.item-desc`, `.item-meta`) + `.item-amount`
- `.item-amount.positive` — verde para ingresos
- `.tag` — pastilla chica (categoría, etiquetas)
- `.upcoming` > `.upcoming-day` (`.num`, `.txt`) — lo que se viene a cobrar
- `.networth-parts` > `.networth-part` — pesos vs cripto

**Formularios**
- `label.field` > `.field-label` + input
- `.amount-input` — el campo del monto, grande y centrado
- `.row-2` — dos campos lado a lado
- `.segmented` — selector Gasto / Ingreso
- `button.primary` (acción principal), `.ghost` (secundaria), `.danger` (borrar),
  `.chip` (pastilla tocable, usa `aria-pressed`)

**Login y bienvenida**
- `.login-wrap` > `.login-card` > `.login-logo`, `h1`, `.login-sub`, `.login-error`
- `.code-box` — código de 6 dígitos para vincular Telegram

**Varios**
- `.empty` > `.big` — estado vacío con emoji
- `.toast` / `.toast.error` — aviso flotante arriba de la navegación
- `.spinner` — cargando
- `.hint` — texto de ayuda chico
- `.user-row` — fila de persona en Ajustes
- `.divider`

## Animaciones actuales

`cardIn` (entrada escalonada de tarjetas), `heroIn` (el número grande sube),
`grow` / `growUp` (las barras crecen desde cero), `screenIn` (cambio de pantalla),
`celebrate` (meta cumplida), `rise` (toast), `spin`.

Se pueden reemplazar por otras, pero que sigan siendo sobrias: es una app que se
abre 10 veces por día, no una landing.

## Tono visual buscado

Serio y confiable, como una app de banco buena — no juguetona. Que el número
importante se lea de un vistazo, sin buscarlo. Lo demás, discreto.

## Cómo probar el resultado

```
cd client && npm run build
```

Después abrir en el celular, o en el navegador con la vista de dispositivo móvil
(F12 → ícono de celular), y revisar: iPhone 13 y un ancho de 320px, en claro y
en oscuro.
