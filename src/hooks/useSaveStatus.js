import { useCallback, useEffect, useState } from 'react'

/**
 * UI-only save status. Does not talk to a backend.
 *
 * States: idle | unsaved | saving | saved | preparing
 */
export function useSaveStatus() {
  const [status, setStatus] = useState('idle')
  const [savedAt, setSavedAt] = useState(null)

  const markDirty = useCallback(() => {
    setStatus((current) => (current === 'saving' ? current : 'unsaved'))
  }, [])

  const markSaving = useCallback(() => setStatus('saving'), [])
  const markPreparing = useCallback(() => setStatus('preparing'), [])

  const markSaved = useCallback(() => {
    setSavedAt(Date.now())
    setStatus('saved')
  }, [])

  useEffect(() => {
    if (status !== 'saved') return undefined
    const id = window.setTimeout(() => setStatus('idle'), 4000)
    return () => window.clearTimeout(id)
  }, [status])

  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'unsaved'
        ? 'Unsaved changes'
        : status === 'preparing'
          ? 'Preparing sync…'
          : status === 'saved'
            ? 'Saved just now'
            : savedAt
              ? 'Saved'
              : 'All changes saved'

  return { status, label, savedAt, markDirty, markSaving, markSaved, markPreparing }
}
