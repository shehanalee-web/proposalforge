import { useCallback } from 'react'
import { fetchProposalById } from '../services/proposalService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load a single proposal by id.
 *
 * Passing a falsy id is valid and skips the request entirely, which covers
 * screens where the id is not known yet.
 *
 * `notFound` is surfaced separately so components can show a "missing" state
 * without importing the service layer's error classes.
 *
 * @param {string | null | undefined} id
 * @returns {{
 *   proposal: import('../models/proposal.js').Proposal | null,
 *   loading: boolean,
 *   error: Error | null,
 *   notFound: boolean,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useProposal(id) {
  const task = useCallback(() => fetchProposalById(id), [id])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(id),
    initialData: null,
  })

  return {
    proposal: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
  }
}
