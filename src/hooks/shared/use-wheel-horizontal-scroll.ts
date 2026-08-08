import { useEffect, useRef } from 'react'

/**
 * Redireciona a roda do mouse (só vertical, sem trackpad/touch) para scroll
 * horizontal num carrossel. Usa listener nativo não-passivo via useEffect —
 * o onWheel sintético do React é passivo por padrão desde o React 17 e
 * preventDefault() ali é ignorado silenciosamente, deixando a página rolar
 * verticalmente junto (double-scroll) em vez de só o carrossel.
 */
export function useWheelHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function handleWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el!.scrollWidth <= el!.clientWidth) return
      e.preventDefault()
      el!.scrollLeft += e.deltaY
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  return ref
}
