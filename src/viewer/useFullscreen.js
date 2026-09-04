import { useCallback, useEffect, useState } from 'react'

export function useFullscreen(ref) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function onChange() {
      setActive(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    const node = ref?.current ?? document.documentElement
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await node.requestFullscreen()
      }
    } catch {
      /* Fullscreen can be denied by the browser — UI still works. */
    }
  }, [ref])

  return { active, toggle }
}
