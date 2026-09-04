import { useCallback, useState } from 'react'
import { saveProposalVersion } from '../services/proposalService.js'

/**
 * Append a manual checkpoint of the current stored proposal.
 */
export function useSaveProposalVersion() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const saveVersion = useCallback(async (id) => {
    setSubmitting(true)
    setError(null)

    try {
      return await saveProposalVersion(id)
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { saveVersion, submitting, error }
}
