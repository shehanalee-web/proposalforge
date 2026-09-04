import { useCallback, useState } from 'react'
import { signPortalProposal } from '../services/portalService.js'

export function useSignProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const sign = useCallback(async (token, input = {}) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await signPortalProposal(token, input)
      return result.proposal
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { sign, submitting, error }
}
