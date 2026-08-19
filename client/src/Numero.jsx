/**
 * Un número que sube solo hasta su valor.
 *
 * Cuando los datos se refrescan, el monto no aparece de golpe: cuenta desde
 * el valor anterior hasta el nuevo. Se nota lo que cambió y cuánto.
 *
 * Detalles que importan:
 *  - La primera vez arranca en 0; después, desde el valor que ya mostraba,
 *    así al cambiar de mes se ve el salto de uno a otro.
 *  - Usa requestAnimationFrame y no un setInterval: no se desincroniza con
 *    la pantalla ni sigue corriendo en una pestaña oculta.
 *  - Si la persona pidió menos animaciones en el sistema, no anima.
 */
import { useEffect, useRef, useState } from 'react'
import { money } from './comunes.jsx'

const DURACION = 650

/* Empieza rápido y frena al final: se lee mejor el número al llegar. */
function suavizar(t) {
  return 1 - Math.pow(1 - t, 3)
}

export default function Numero({ valor, formato = money, opciones, className, ...resto }) {
  const objetivo = Number(valor) || 0
  // Arranca en 0 a propósito: así al entrar a una pantalla el número sube.
  // Si arrancara en su valor final, el efecto solo se vería al cambiar de mes.
  const [actual, setActual] = useState(0)
  const desdeRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const desde = desdeRef.current
    if (desde === objetivo) return

    const menosAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (menosAnimacion) {
      desdeRef.current = objetivo
      setActual(objetivo)
      return
    }

    const arranque = performance.now()

    function paso(ahora) {
      const t = Math.min((ahora - arranque) / DURACION, 1)
      const v = desde + (objetivo - desde) * suavizar(t)
      // El último cuadro pone el valor exacto: sin esto queda un redondeo raro.
      setActual(t === 1 ? objetivo : v)
      if (t < 1) rafRef.current = requestAnimationFrame(paso)
      else desdeRef.current = objetivo
    }

    rafRef.current = requestAnimationFrame(paso)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Si nos desmontan a mitad, el próximo arranque parte de acá.
      desdeRef.current = objetivo
    }
  }, [objetivo])

  return <span className={className} {...resto}>{formato(actual, opciones)}</span>
}
