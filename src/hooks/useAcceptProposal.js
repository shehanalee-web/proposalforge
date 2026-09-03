import { useCallback, useState } from 'react'
import { acceptProposal } from '../services/proposalService.js'

/**
 * Accept a proposal from the client portal.
 *
 * @returns {{
 *   accept: (token: string) => Promise<import('../models/proposal.js').Proposal | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   reset: () => void,
 * }}
 */
export function useAcceptProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const accept = useCallback(async (token) => {
    setSubmitting(true)
    setError(null)

    try {
      return await acceptProposal(token)
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { accept, submitting, error, reset }
}
