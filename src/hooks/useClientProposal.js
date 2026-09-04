import { useCallback } from 'react'
import { loadPortalProposal } from '../services/portalService.js'
import { NotFoundError } from '../services/errors.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load a proposal for the client portal by share token.
 *
 * Opening the portal records a view once access checks pass.
 * Passing a falsy token or `enabled: false` skips the request.
 *
 * @param {string | null | undefined} token
 * @param {{ password?: string, email?: string }} [credentials]
 * @param {boolean} [enabled]
 */
export function useClientProposal(token, credentials = {}, enabled = true) {
  const password = credentials.password ?? ''
  const email = credentials.email ?? ''

  const task = useCallback(async () => {
    const loaded = await loadPortalProposal(token, { password, email })
    return loaded.proposal
  }, [token, password, email])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(token) && enabled,
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
