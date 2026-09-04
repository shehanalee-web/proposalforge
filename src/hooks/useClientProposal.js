import { useCallback } from 'react'
import { loadPortalProposal } from '../services/portalService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load a proposal for the client portal by share token.
 *
 * Opening the portal records a view. Passing a falsy token skips the request.
 * Goes through the portal service so clients never hit studio update APIs.
 *
 * @param {string | null | undefined} token
 */
export function useClientProposal(token) {
  const task = useCallback(async () => {
    const loaded = await loadPortalProposal(token)
    return loaded.proposal
  }, [token])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(token),
    initialData: null,
  })

  return {
    proposal: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
    setProposal: setData,
  }
}
