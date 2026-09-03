import { useCallback, useState } from 'react'
import { createService } from '../services/serviceService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Create a service on demand.
 */
export function useCreateService() {
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
      return await createService(input)
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
