import { useCallback } from 'react'
import { fetchLibraryBlockById } from '../services/libraryBlockService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

export function useLibraryBlock(id) {
  const task = useCallback(() => fetchLibraryBlockById(id), [id])
  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(id),
    initialData: null,
  })

  return {
    block: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
  }
}
