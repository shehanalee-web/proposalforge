import { useCallback, useState } from 'react'
import { updateTemplate } from '../services/templateService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Update a template on demand.
 *
 * @returns {{
 *   update: (
 *     id: string,
 *     changes: Partial<import('../models/template.js').ProposalTemplate>,
 *   ) => Promise<import('../models/template.js').ProposalTemplate | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useUpdateTemplate() {
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
      return await updateTemplate(id, changes)
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
