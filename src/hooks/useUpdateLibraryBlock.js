import { useCallback, useState } from 'react'
import { updateLibraryBlock } from '../services/libraryBlockService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}
  for (const entry of errors) {
    fields[entry.field] = entry.message
  }
  return fields
}

export function useUpdateLibraryBlock() {
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
      return await updateLibraryBlock(id, changes)
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
