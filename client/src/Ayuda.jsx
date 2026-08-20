/**
 * El tutorial: te va marcando la pantalla paso a paso.
 *
 * Cómo funciona: cada paso apunta a algo que existe de verdad en la pantalla
 * (un botón, una tarjeta). Se le hace un agujero a la penumbra justo encima y
 * el cartel se acomoda al lado. No es un video ni un dibujo: es la app.
 *
 * Se muestra solo la primera vez que entrás a cada sección, y desde ahí queda
 * a mano en el botón «?» de arriba. Se puede saltear en cualquier momento, y
 * saltear no es lo mismo que terminarlo: las dos cosas cuentan como visto,
 * porque nadie quiere que le vuelvan a explicar lo mismo.
 *
 * Si un paso apunta a algo que no está (una sección vacía todavía no tiene
 * lista), el paso igual se muestra, centrado y sin agujero. Preferimos eso a
 * hacer desaparecer una explicación.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const VISTAS = 'manguito.tutorialesVistos'

/** Qué secciones ya vio la persona. */
function leerVistos() {
  try {
    return JSON.parse(localStorage.getItem(VISTAS) || '{}')
  } catch {
    return {}
  }
}

function marcarVisto(tab) {
  try {
    localStorage.setItem(VISTAS, JSON.stringify({ ...leerVistos(), [tab]: true }))
  } catch {
    /* si no hay localStorage, el tutorial se muestra siempre: no es grave */
  }
}

export function yaLoVio(tab) {
  return Boolean(leerVistos()[tab])
}

/** Olvidar todo, para poder volver a verlos desde Ajustes. */
export function olvidarTutoriales() {
  try {
    localStorage.removeItem(VISTAS)
  } catch {
    /* nada que hacer */
  }
}

/* ------------------------------------------------------------- los pasos */

/**
 * Un paso: qué dice y a qué le apunta.
 *
 * `apunta` es un selector CSS. Si no aparece nada, el paso se muestra igual
 * en el medio de la pantalla.
 */
export const GUIAS = {
  home: [
    {
      titulo: 'Esto es tu mes, de un vistazo',
      texto: 'Arriba está lo que te quedó: lo que entró menos lo que salió. Si está en verde, este mes ahorraste.',
      apunta: '.titular, .hero',
    },
    {
      titulo: 'Anotá tu primer movimiento',
      texto: 'Todo empieza acá. Ponés cuánto y qué fue, y Manguito le busca la categoría solo. No hace falta que la elijas.',
      apunta: '.btn-nuevo, .nav-cel button',
    },
    {
      titulo: 'A dónde se te va la plata',
      texto: 'Cuando tengas unos cuantos gastos cargados, acá vas a ver en qué se te va. Suele ser la parte que sorprende.',
      apunta: '.resumen-torta, .card',
    },
    {
      titulo: 'También por Telegram',
      texto: 'No hace falta entrar acá para anotar: le escribís al bot «2500 café» y queda cargado. Tocá «Conectar» y te guío paso a paso. Si ya lo conectaste, esto no aparece.',
      // Solo existe mientras no lo conectaste. Si ya está, el paso se muestra
      // igual pero centrado, que es lo correcto: la explicación sigue siendo
      // cierta aunque no haya nada que señalar.
      apunta: '.tg-invita',
    },
  ],

  movs: [
    {
      titulo: 'Todo lo que anotaste',
      texto: 'Cada gasto y cada ingreso, del más nuevo al más viejo. Tocá cualquiera para corregirlo o borrarlo.',
      apunta: '.list, .card',
    },
    {
      titulo: 'Si la categoría quedó mal, cambiala',
      texto: 'Tocá la categoría y elegí otra. Lo importante: Manguito se lo acuerda. La próxima vez que anotes lo mismo, ya lo pone bien.',
      apunta: '.tag-editable, .list, .card',
    },
  ],

  gastos: [
    {
      titulo: 'En qué se te va',
      texto: 'Los gastos del mes agrupados por categoría, de mayor a menor. Sirve para ver de dónde recortar.',
      apunta: '.card',
    },
  ],

  tarjetas: [
    {
      titulo: 'Cuándo cierra y cuánto debés',
      texto: 'La tarjeta no va por mes calendario: va de cierre a cierre. Acá ves cuánto llevás gastado en el período que está abierto.',
      apunta: '.card',
    },
    {
      titulo: 'El gasto cuenta el día que comprás',
      texto: 'Aunque lo pagues el mes que viene. Es lo correcto: si comprás en agosto, gastaste en agosto.',
    },
    {
      titulo: 'Pagar el resumen no es un gasto nuevo',
      texto: 'Las compras ya están cargadas una por una. Si además anotáramos el pago, el mes contaría el doble. Por eso el pago solo se marca como pagado.',
    },
  ],

  ahorro: [
    {
      titulo: 'Dónde está tu plata',
      texto: 'La app sabía cuánto tenías, pero no dónde. Acá la repartís: lo del día a día, lo que apartaste y lo que pusiste a rendir.',
      apunta: '.kpis',
    },
    {
      titulo: 'Mover plata NO es gastarla',
      texto: 'Pasar plata de una cuenta a otra no aparece en tus gastos del mes, porque no gastaste nada: la cambiaste de lugar.',
      apunta: 'button.chip',
    },
    {
      titulo: 'Podés mover una parte',
      texto: 'No tenés que mover todo el saldo. Escribí el monto que quieras: podés poner 300.000 con los puntos, como lo escribís normalmente.',
    },
  ],

  invest: [
    {
      titulo: 'Tu cartera a precio de mercado',
      texto: 'Acciones argentinas, CEDEARs, bonos, letras, ONs y cripto. Los precios son de verdad y se actualizan solos cada minuto.',
      apunta: '.hero',
    },
    {
      titulo: 'Cuánto ganaste de verdad',
      texto: 'Lo que pusiste, lo que vale hoy y la diferencia. Para que salga bien hace falta que cargues el precio al que compraste.',
      apunta: '.kpis',
    },
    {
      titulo: 'Si falta el precio de compra, ponelo',
      texto: 'Tocá «Editar» en cualquier activo. Sin ese dato no se puede decir si ganás o perdés, así que lo dejamos en blanco en vez de inventarlo.',
      apunta: '.activo-acciones, .activo-falta',
    },
    {
      titulo: 'Ojo con los bonos',
      texto: 'Los bonos, las letras y las ONs se cargan por valor nominal, que es lo que dice tu broker. Cotizan cada 100 nominales y esa cuenta la hacemos nosotros.',
    },
  ],

  presu: [
    {
      titulo: 'Ponele un techo a cada categoría',
      texto: 'Decidís cuánto querés gastar por mes en Comida, Transporte, lo que sea. La barra se va llenando y te avisa antes de pasarte.',
      apunta: '.card',
    },
  ],

  metas: [
    {
      titulo: 'Para qué estás ahorrando',
      texto: 'Ponés cuánto querés juntar y le vas sumando. Sirve para que el ahorro tenga un para qué y no sea solo un número.',
      apunta: '.card',
    },
  ],

  subs: [
    {
      titulo: 'Lo que se paga solo todos los meses',
      texto: 'Netflix, el alquiler, el gimnasio. Los cargás una vez y se anotan solos el día que se cobran.',
      apunta: '.card',
    },
    {
      titulo: 'Las de dólares se convierten cada mes',
      texto: 'Una suscripción de US$15 no te sale lo mismo en marzo que en agosto. Por eso se guarda en dólares y se pasa a pesos al cambio del día.',
    },
  ],

  patrimonio: [
    {
      titulo: 'Todo lo que tenés, junto',
      texto: 'Los pesos de tus cuentas más las inversiones a precio de mercado. Es el número más honesto de la app.',
      apunta: '.titular',
    },
    {
      titulo: 'De qué está hecho',
      texto: 'La rueda muestra cuánto pesa cada cosa. Si algo no se puede cotizar, no lo sumamos: preferimos que falte antes que inventarlo.',
      apunta: '.patrimonio-grid, .card',
    },
  ],

  pnl: [
    {
      titulo: 'Cómo venís mes a mes',
      texto: 'Lo que entró contra lo que salió, mes por mes. Sirve para ver si la cosa mejora o empeora, más allá de un mes puntual.',
      apunta: '.card',
    },
  ],

  alertas: [
    {
      titulo: 'Lo que conviene que mires',
      texto: 'Presupuestos que se te van, resúmenes por vencer, gastos raros. Lo mismo que te llega por Telegram, pero acá no se borra al leerlo.',
      apunta: '.card',
    },
  ],

  arbol: [
    {
      titulo: 'Tu árbol crece si anotás',
      texto: 'Cada movimiento que cargás le suma. No es un adorno: la app sirve si está al día, y esto es para acordarse.',
      apunta: '.arbol-caja, .card',
    },
  ],

  ajustes: [
    {
      titulo: 'Conectá Telegram',
      texto: 'Es la forma más cómoda de anotar: le escribís al bot y listo. Pedís el código acá y se lo mandás.',
      apunta: '.ajustes-cols .card',
    },
    {
      titulo: 'Bajate tus datos cuando quieras',
      texto: 'Son tuyos. Te llevás todo en un archivo y lo podés volver a subir acá mismo.',
    },
    {
      titulo: 'Si algo nuevo no aparece',
      texto: 'Mirá la tarjeta Versión antes de asustarte: el servidor no se actualiza solo, hay que apretar Manual Deploy.',
    },
  ],
}

/** ¿Hay tutorial para esta sección? */
export function hayGuia(tab) {
  return Boolean(GUIAS[tab] && GUIAS[tab].length)
}

/* ---------------------------------------------------------- el recorrido */

const MARGEN = 8

export default function Guia({ tab, onCerrar }) {
  const pasos = GUIAS[tab] || []
  const [i, setI] = useState(0)
  const [hueco, setHueco] = useState(null)
  const cartelRef = useRef(null)
  const [cartel, setCartel] = useState({ top: 0, left: 0 })

  const paso = pasos[i]

  // Buscamos a qué le apunta este paso y lo traemos a la vista.
  useLayoutEffect(() => {
    if (!paso) return

    function ubicar() {
      const el = paso.apunta ? document.querySelector(paso.apunta) : null
      if (!el) { setHueco(null); return }
      const r = el.getBoundingClientRect()
      // Un elemento de alto cero o fuera de pantalla no sirve de blanco.
      if (r.width < 4 || r.height < 4) { setHueco(null); return }
      setHueco({
        top: r.top - MARGEN,
        left: r.left - MARGEN,
        width: r.width + MARGEN * 2,
        height: r.height + MARGEN * 2,
      })
    }

    const el = paso.apunta ? document.querySelector(paso.apunta) : null
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })

    // Después del scroll suave hay que volver a medir, si no el agujero
    // queda donde estaba el elemento antes de moverse.
    ubicar()
    const t = setTimeout(ubicar, 420)
    window.addEventListener('resize', ubicar)
    window.addEventListener('scroll', ubicar, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', ubicar)
      window.removeEventListener('scroll', ubicar, true)
    }
  }, [paso, i])

  // El cartel va al lado del agujero, pero sin salirse de la pantalla.
  useLayoutEffect(() => {
    const caja = cartelRef.current
    if (!caja) return
    const ancho = caja.offsetWidth
    const alto = caja.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (!hueco) {
      setCartel({ top: Math.max((vh - alto) / 2, 12), left: Math.max((vw - ancho) / 2, 12) })
      return
    }

    // Abajo del elemento si entra; si no, arriba.
    const abajo = hueco.top + hueco.height + 12
    const arriba = hueco.top - alto - 12
    const top = abajo + alto < vh - 12 ? abajo : arriba > 12 ? arriba : Math.max((vh - alto) / 2, 12)

    let left = hueco.left + hueco.width / 2 - ancho / 2
    left = Math.min(Math.max(left, 12), Math.max(vw - ancho - 12, 12))

    setCartel({ top, left })
  }, [hueco, i])

  // Con el teclado: Escape sale, las flechas avanzan.
  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape') terminar()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') siguiente()
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  function terminar() {
    // Saltear también cuenta como visto: si lo cerraste, no querés verlo de nuevo.
    marcarVisto(tab)
    onCerrar()
  }

  function siguiente() {
    if (i + 1 < pasos.length) setI(i + 1)
    else terminar()
  }

  if (!paso) return null

  return (
    <div className="guia" role="dialog" aria-label="Cómo se usa esta sección">
      {/* La penumbra. Cuando hay a qué apuntar, el agujero se hace con una
          sombra enorme alrededor del recuadro: mucho más simple que recortar. */}
      {hueco ? (
        <div
          className="guia-foco"
          style={{ top: hueco.top, left: hueco.left, width: hueco.width, height: hueco.height }}
          onClick={terminar}
        />
      ) : (
        <div className="guia-penumbra" onClick={terminar} />
      )}

      <div className="guia-cartel" ref={cartelRef} style={{ top: cartel.top, left: cartel.left }}>
        <div className="guia-pasos">
          {pasos.map((_, n) => (
            <span key={n} className={n === i ? 'ahora' : n < i ? 'hecho' : ''} />
          ))}
        </div>

        <h3>{paso.titulo}</h3>
        <p>{paso.texto}</p>

        <div className="guia-botones">
          <button className="guia-saltear" onClick={terminar}>
            {i === 0 ? 'Ya sé usarlo' : 'Cerrar'}
          </button>
          <div className="guia-avanzar">
            {i > 0 && (
              <button className="guia-btn" onClick={() => setI(i - 1)}>Atrás</button>
            )}
            <button className="guia-btn principal" onClick={siguiente}>
              {i + 1 < pasos.length ? `Siguiente (${i + 1}/${pasos.length})` : 'Listo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
