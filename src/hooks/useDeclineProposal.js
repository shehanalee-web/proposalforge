import { useCallback, useState } from 'react'
import { declinePortalProposal } from '../services/portalService.js'

export function useDeclineProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const decline = useCallback(async (token, input = {}) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await declinePortalProposal(token, input)
      return result.proposal
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { decline, submitting, error, reset }
}
