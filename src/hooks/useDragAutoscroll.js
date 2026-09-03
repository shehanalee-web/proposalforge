import { useEffect, useRef } from 'react'

/**
 * Scrolls the nearest scroll parent when dragging near the viewport edge.
 */
export function useDragAutoscroll(active) {
  const frame = useRef(0)
  const yRef = useRef(0)

  useEffect(() => {
    if (!active) return undefined

    function onMove(event) {
      yRef.current = event.clientY
    }

    function tick() {
      const y = yRef.current
      const edge = 72
      const max = 22

      if (y < edge) {
        window.scrollBy({ top: -max, behavior: 'auto' })
      } else if (y > window.innerHeight - edge) {
        window.scrollBy({ top: max, behavior: 'auto' })
      }

      frame.current = requestAnimationFrame(tick)
    }

    window.addEventListener('dragover', onMove)
    frame.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('dragover', onMove)
      cancelAnimationFrame(frame.current)
    }
  }, [active])
}
