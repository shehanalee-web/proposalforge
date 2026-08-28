import { useCallback, useState } from 'react'
import { updateBrandKit } from '../services/brandKitService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}

  for (const entry of errors) {
    fields[entry.field] = entry.message
  }

  return fields
}

/**
 * Save Company Identity on demand.
 *
 * @returns {{
 *   update: (input: Partial<import('../models/brandKit.js').BrandKit>) =>
 *     Promise<import('../models/brandKit.js').BrandKit | null>,
 *   submitting: boolean,
 *   error: Error | null,
 *   fieldErrors: Record<string, string>,
 *   reset: () => void,
 * }}
 */
export function useUpdateBrandKit() {
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
      return await updateBrandKit(input)
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
