import { useEffect, useState } from 'react'

export function useReadingProgress(targetRef) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const node = targetRef?.current
      const scrollRoot = document.documentElement
      const top = window.scrollY
      const height = (node?.scrollHeight ?? scrollRoot.scrollHeight) - window.innerHeight
      if (height <= 0) {
        setProgress(100)
        return
      }
      setProgress(Math.min(100, Math.max(0, (top / height) * 100)))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [targetRef])

  return progress
}
