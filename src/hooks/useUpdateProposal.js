import { useCallback, useState } from 'react'
import { updateProposal } from '../services/proposalService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Update a proposal on demand.
 *
 * Unlike the read hooks, this does not fire a request on mount. Call `update`
 * from a submit handler. Validation failures are split into `fieldErrors` so
 * a form can highlight individual inputs without importing the service layer.
 *
 * @returns {{
 *   update: (
 *     id: string,
 *     changes: Partial<import('../models/proposal.js').Proposal>,
 *   ) => Promise<import('../models/proposal.js').Proposal | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useUpdateProposal() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const update = useCallback(async (id, changes) => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      return await updateProposal(id, changes)
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

  return { update, submitting, error, fieldErrors, reset }
}
