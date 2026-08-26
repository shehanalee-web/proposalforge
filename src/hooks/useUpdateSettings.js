import { useCallback, useState } from 'react'
import { updateSettings } from '../services/settingsService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Save studio settings on demand.
 *
 * @returns {{
 *   update: (input: Partial<import('../models/settings.js').Settings>) =>
 *     Promise<import('../models/settings.js').Settings | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useUpdateSettings() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const update = useCallback(async (input) => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      return await updateSettings(input)
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
