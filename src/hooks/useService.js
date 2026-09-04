import { useCallback } from 'react'
import { fetchServiceById } from '../services/serviceService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load one service by id.
 *
 * @param {string | null | undefined} id
 */
export function useService(id) {
  const task = useCallback(() => fetchServiceById(id), [id])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(id),
    initialData: null,
  })

  return {
    service: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
  }
}
