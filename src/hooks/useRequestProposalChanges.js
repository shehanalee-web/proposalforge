import { useCallback, useState } from 'react'
import { requestProposalChanges } from '../services/proposalService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Save client feedback and request a revision.
 *
 * @returns {{
 *   requestChanges: (
 *     token: string,
 *     comment: string,
 *   ) => Promise<import('../models/proposal.js').Proposal | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useRequestProposalChanges() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const requestChanges = useCallback(async (token, comment) => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      return await requestProposalChanges(token, comment)
    } catch (caught) {
      if (caught instanceof ValidationError) {
        setFieldErrors(toFieldMap(caught.errors))
      }

      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { requestChanges, submitting, error, fieldErrors, reset }
}
