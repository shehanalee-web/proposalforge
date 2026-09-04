import { useCallback, useState } from 'react'
import { deleteProposalVersion } from '../services/proposalService.js'

/**
 * Delete a draft version. Approved versions cannot be removed.
 */
export function useDeleteProposalVersion() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const removeVersion = useCallback(async (id, versionId) => {
    setSubmitting(true)
    setError(null)

    try {
      return await deleteProposalVersion(id, versionId)
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { removeVersion, submitting, error }
}
