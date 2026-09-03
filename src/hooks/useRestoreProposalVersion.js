import { useCallback, useState } from 'react'
import { restoreProposalVersion } from '../services/proposalService.js'

/**
 * Restore a past proposal version on demand.
 *
 * Restore appends a new latest version instead of rewriting history.
 *
 * @returns {{
 *   restore: (
 *     id: string,
 *     versionId: string,
 *   ) => Promise<import('../models/proposal.js').Proposal | null>,
 *   submitting: boolean,
 *   error: Error | null,
 * }}
 */
export function useRestoreProposalVersion() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const restore = useCallback(async (id, versionId) => {
    setSubmitting(true)
    setError(null)

    try {
      return await restoreProposalVersion(id, versionId)
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { restore, submitting, error }
}
