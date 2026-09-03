import { useCallback, useState } from 'react'
import { deleteService } from '../services/serviceService.js'

/**
 * Delete a service on demand. Existing proposals keep the name they were
 * created with.
 */
export function useDeleteService() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const remove = useCallback(async (id) => {
    setSubmitting(true)
    setError(null)

    try {
      await deleteService(id)
      return true
    } catch (caught) {
      setError(caught)
      return false
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { remove, submitting, error }
}
