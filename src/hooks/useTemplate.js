import { useCallback } from 'react'
import { fetchTemplateById } from '../services/templateService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load a single template by id.
 *
 * @param {string | null | undefined} id
 * @returns {{
 *   template: import('../models/template.js').ProposalTemplate | null,
 *   loading: boolean,
 *   error: Error | null,
 *   notFound: boolean,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useTemplate(id) {
  const task = useCallback(() => fetchTemplateById(id), [id])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(id),
    initialData: null,
  })

  return {
    template: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
  }
}
