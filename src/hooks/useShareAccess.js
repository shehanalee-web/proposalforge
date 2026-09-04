import { useCallback, useState } from 'react'
import {
  rotateShareToken,
  updateShareAccess,
} from '../services/proposalService.js'

export function useShareAccess() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (task) => {
    setSubmitting(true)
    setError(null)
    try {
      return await task()
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  const update = useCallback(
    (id, patch) => run(() => updateShareAccess(id, patch)),
    [run],
  )

  const rotate = useCallback(
    (id) => run(() => rotateShareToken(id)),
    [run],
  )

  return { update, rotate, submitting, error }
}
