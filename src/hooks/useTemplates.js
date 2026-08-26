import { useCallback } from 'react'
import { fetchTemplates } from '../services/templateService.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load all proposal templates, newest first.
 *
 * @returns {{
 *   templates: import('../models/template.js').ProposalTemplate[],
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useTemplates() {
  const task = useCallback(() => fetchTemplates(), [])

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: [],
  })

  return { templates: data, loading, error, refetch }
}
