import { useCallback } from 'react'
import { fetchProposals } from '../services/proposalService.js'
import { useAsyncData } from './useAsyncData.js'

const EMPTY_RESULT = { items: [], total: 0 }

/**
 * Load a list of proposals.
 *
 * Options are destructured into primitives before being used as dependencies,
 * so callers can pass an inline object literal without causing a refetch on
 * every render.
 *
 * @param {import('../services/proposalService.js').ListOptions} [options]
 * @returns {{
 *   proposals: import('../models/proposal.js').Proposal[],
 *   total: number,
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useProposals(options = {}) {
  const { status, search, sortBy, sortOrder, page, pageSize } = options

  const task = useCallback(
    () => fetchProposals({ status, search, sortBy, sortOrder, page, pageSize }),
    [status, search, sortBy, sortOrder, page, pageSize],
  )

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: EMPTY_RESULT,
  })

  return {
    proposals: data.items,
    total: data.total,
    loading,
    error,
    refetch,
  }
}
