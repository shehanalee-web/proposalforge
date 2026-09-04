import { useCallback, useState } from 'react'
import { payPortalProposal } from '../services/portalService.js'

export function usePayProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const pay = useCallback(async (token, input = {}) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await payPortalProposal(token, input)
      return result.proposal
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { pay, submitting, error }
}
