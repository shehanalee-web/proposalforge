import { useCallback, useState } from 'react'
import { createProposal } from '../services/proposalService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Create a proposal on demand.
 *
 * Unlike the read hooks, this does not fire a request on mount. Call `create`
 * from a submit handler. Validation failures are split into `fieldErrors` so
 * a form can highlight individual inputs without importing the service layer.
 *
 * @returns {{
 *   create: (input: Partial<import('../models/proposal.js').Proposal>) =>
 *     Promise<import('../models/proposal.js').Proposal | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useCreateProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const create = useCallback(async (input) => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      return await createProposal(input)
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

  return { create, submitting, error, fieldErrors, reset }
}
