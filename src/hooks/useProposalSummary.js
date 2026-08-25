import { useCallback } from 'react'
import { fetchProposalSummary } from '../services/proposalService.js'
import { useAsyncData } from './useAsyncData.js'

/** Held before the first response, so cards can render their layout at once. */
const EMPTY_SUMMARY = {
  total: 0,
  pipelineValue: 0,
  wonValue: 0,
  acceptanceRate: null,
  statusCounts: {},
  currency: 'USD',
}

/**
 * Load aggregate proposal figures.
 *
 * @returns {{
 *   summary: import('../services/proposalService.js').ProposalSummary,
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useProposalSummary() {
  const task = useCallback(() => fetchProposalSummary(), [])

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: EMPTY_SUMMARY,
  })

  return { summary: data, loading, error, refetch }
}
