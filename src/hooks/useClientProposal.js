import { useCallback } from 'react'
import { fetchClientProposal } from '../services/proposalService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load a proposal for the client portal by share token.
 *
 * Opening the portal records a view. Passing a falsy token skips the request.
 *
 * @param {string | null | undefined} token
 */
export function useClientProposal(token) {
  const task = useCallback(() => fetchClientProposal(token), [token])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(token),
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
