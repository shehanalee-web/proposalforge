import { useCallback, useState } from 'react'
import { sendProposal } from '../services/proposalService.js'

/**
 * Deliver a proposal email through the mail provider.
 */
export function useSendProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(async (id, options = {}) => {
    setSubmitting(true)
    setError(null)

    try {
      return await sendProposal(id, options)
    } catch (caught) {
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { send, submitting, error, setError }
}
