import { useCallback, useRef, useState } from 'react'

/**
 * Local undo/redo stack. Snapshots are caller-owned objects.
 * Not persisted — ready for a future API without layout changes.
 *
 * @param {number} [capacity]
 */
export function useHistoryStack(capacity = 80) {
  const pastRef = useRef([])
  const futureRef = useRef([])
  const applyingRef = useRef(false)
  const [, tick] = useState(0)

  const bump = () => tick((n) => n + 1)

  const push = useCallback(
    (snapshot) => {
      if (applyingRef.current) return
      pastRef.current = [...pastRef.current.slice(-(capacity - 1)), snapshot]
      futureRef.current = []
      bump()
    },
    [capacity],
  )

  const undo = useCallback((present) => {
    if (pastRef.current.length === 0) return null
    const previous = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [present, ...futureRef.current]
    applyingRef.current = true
    bump()
    return previous
  }, [])

  const redo = useCallback((present) => {
    if (futureRef.current.length === 0) return null
    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current, present]
    applyingRef.current = true
    bump()
    return next
  }, [])

  const finishApply = useCallback(() => {
    applyingRef.current = false
  }, [])

  return {
    push,
    undo,
    redo,
    finishApply,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    applying: applyingRef,
  }
}
