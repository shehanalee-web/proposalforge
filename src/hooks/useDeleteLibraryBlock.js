import { useCallback, useState } from 'react'
import { deleteLibraryBlock } from '../services/libraryBlockService.js'

export function useDeleteLibraryBlock() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const remove = useCallback(async (id) => {
    setSubmitting(true)
    setError(null)
    try {
      await deleteLibraryBlock(id)
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
