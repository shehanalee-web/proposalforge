import { useCallback, useState } from 'react'
import { deleteTemplate } from '../services/templateService.js'

/**
 * Delete a template on demand.
 *
 * @returns {{
 *   remove: (id: string) => Promise<boolean>,
 *   submitting: boolean,
 *   error: Error | null,
 * }}
 */
export function useDeleteTemplate() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const remove = useCallback(async (id) => {
    setSubmitting(true)
    setError(null)

    try {
      await deleteTemplate(id)
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
