# Finanzas

App de gastos personales, pensada para el celular. Varias personas, cada una con
sus propios datos.

---

## Entrar

| | |
|---|---|
| Desde esta PC | http://localhost:3001 |
| Desde el celular | http://192.168.1.16:3001 |

Cada uno entra con su usuario y contraseña. Nadie ve los datos de nadie.

### Usuarios

| Usuario | Notas |
|---|---|
| `emanuel` | Administrador. Ve todo: cripto, suscripciones, patrimonio. |
| `sofia` | Versión simple: solo lo esencial. |

Las contraseñas **no se escriben acá**: quedarían guardadas en el historial del
repositorio para siempre. Si no te acordás de alguna, se cambia así:

```
node crear-usuario.js  →  ver la ayuda
```

o desde la app: **Ajustes → Cambiar contraseña**. Para reiniciar la de otra
persona, borrás su usuario en Ajustes y lo creás de nuevo.

Para sumar gente: Ajustes → Sumar una persona (solo el administrador).
O desde la consola:

```
node crear-usuario.js pedro "Pedro" suClave123
```

Agregá `--simple` para la versión reducida, `--admin` para que pueda crear usuarios.

---

## Botones

- `iniciar.bat` — arranca la app, sin ventanas de consola.
- `parar.bat` — la apaga.
- `instalar-inicio-automatico.bat` — que arranque sola al prender la PC (correlo una vez).

Para desactivar el arranque automático, borrá "Finanzas" de:
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`

---

## Ponerla en el celular como una app

1. Abrí `http://192.168.1.16:3001` en el navegador del celular.
2. **iPhone:** Compartir → "Agregar a inicio". **Android:** ⋮ → "Instalar app".

Queda con ícono propio y sin barra del navegador. Requiere estar en la misma WiFi
que la PC, y que la PC esté prendida.

---

## Telegram

Cada persona conecta su Telegram una sola vez:

1. En la app: **Ajustes → Conectar Telegram → Pedir código**.
2. Al bot, escribirle: `/vincular 123456` (con el número que dio la app).

Listo. Desde ahí el bot sabe de quién son los gastos.

### Cómo se le habla

Entiende cómo hablamos:

```
Disco 15400                    →  gasto de $15.400
gasté 5 lucas en el súper      →  gasto de $5.000
un palo y medio el alquiler    →  gasto de $1.500.000
15k netflix                    →  gasto de $15.000
+250 lucas sueldo              →  ingreso de $250.000
```

También podés mandarle **la foto de un ticket**: saca el comercio, el total y el
detalle de productos.

Si tenés un presupuesto puesto para esa categoría, en la misma respuesta te dice
cuánto te queda, y te avisa si te estás pasando.

Comandos: `/resumen` `/metas` `/fijos` `/ultimos` `/borrar 12` `/ayuda`

---

## Qué hace

- **Presupuestos** por categoría, con aviso al 80% y cuando te pasás.
- **Metas de ahorro** con barra de progreso.
- **Gastos fijos**: las suscripciones se cargan solas el día que se cobran, sin
  duplicar. Si vence una promo, pasa a cobrar el precio normal.
- **Patrimonio neto**: pesos + cripto convertida a dólar blue.
- **Categorización automática** con IA.
- **Importar resúmenes** en CSV, Excel o PDF.

---

## Ponerla en un servidor (Render)

Esto resuelve lo importante: verla desde cualquier lado, que ande con la PC
apagada, y habilita WhatsApp más adelante.

Ya está preparado: `Dockerfile` y `.dockerignore`. Como ya tenés plan Pro en
Render ($25/mes con miembros ilimitados), sumar esta app cuesta el cómputo del
servicio: **un Starter siempre prendido, unos US$7/mes**, más centavos de disco.
No hace falta tarjeta nueva.

Pasos:

1. Subí esta carpeta a un repositorio de GitHub (sin `data/`, sin `.env`).
2. En Render: **New → Web Service**, apuntá al repo. Detecta el Dockerfile.
3. Elegí instancia **Starter** (no la gratis: la gratis se duerme y el bot dejaría
   de escuchar).
4. Agregá un **disco persistente** de 1 GB montado en `/data`.
5. Variables de entorno: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CMC_API_KEY`,
   `NODE_ENV=production`.
6. Deploy.

Para llevarte tus datos: subí `data/finanzas.db` al disco del servicio.

> Un solo servicio alcanza para todas las personas. **No armes uno por cabeza** —
> el login ya separa los datos, y así pagás una sola instancia.

---

## Preguntas frecuentes

**¿Dónde están mis datos?**
En `data/finanzas.db`. Copiá esa carpeta y tenés todo respaldado.

**¿Y los datos viejos?**
En el Escritorio, en `emanuel-finance-BACKUP-2026-08-01`.

**Algo no anda.**
Mirá `logs/finanzas.log`.

**¿Se puede usar fuera de casa?**
Todavía no: la app vive en tu PC y se ve dentro de tu WiFi. El bot de Telegram sí
anda desde cualquier lado. Se resuelve con el paso de Render.

---

## Qué hay en esta carpeta

| Archivo | Para qué |
|---|---|
| `abrir.bat` | Abrir la app en el navegador (la arranca si hace falta) |
| `iniciar.bat` / `parar.bat` | Prender y apagar |
| `instalar-inicio-automatico.bat` | Que arranque sola con la PC (una sola vez) |
| `iniciar-mac.command` | Arrancarla en una Mac |
| `crear-usuario.js` | Crear usuarios desde la consola |
| `escritorio-original.html` | **Copia congelada del diseño de escritorio**, para pasársela a un diseñador |
| `dashboard-para-rediseno.html` | Lo mismo, pero las pantallas de celular |
| `DISENO.md` | Inventario de clases CSS y restricciones, para quien rediseñe |
| `Dockerfile` | Para desplegar en Render |
| `server/` `client/` | El código |
| `data/` | Tu base de datos (no se sube a GitHub) |
| `herramientas/` | Scripts de uso ocasional: regenerar las copias congeladas, migrar datos |

> ⚠️ **No corras la app vieja del Escritorio-a-Inicio (`Usuario\emanuel-finance`) al
> mismo tiempo que esta.** Las dos usan el puerto 3001 y Windows deja que convivan
> (una por IPv4 y otra por IPv6), así que no sabés cuál te está contestando. Peor:
> los dos bots de Telegram se pelean por el mismo token y un gasto puede terminar
> guardado en la base equivocada. Esa carpeta queda solo como referencia de diseño.

---

## Detalles técnicos

- Un solo proceso Node: web + API + bot de Telegram.
- SQLite, un archivo. Todos los datos separados por `user_id`.
- Contraseñas con scrypt (viene en Node). Sesión en cookie httpOnly, 30 días.
- Frontend React compilado en `client/dist`. Si tocás algo: `cd client && npm run build`.
- `migrar.js` trae datos de la app vieja. `crear-usuario.js` crea usuarios.
