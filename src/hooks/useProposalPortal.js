import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import { NotFoundError } from '../services/errors.js'
import {
  createProposalPortalApi,
  fetchProposalPortal,
  publishProposalPortalApi,
  revokeProposalPortalApi,
} from '../services/proposalPortalService.js'

export function useProposalPortal(proposalId, actorId = DEFAULT_ACTOR_ID) {
  const task = useCallback(async () => {
    if (!proposalId) return null
    try {
      return await fetchProposalPortal({ proposalId, actorId })
    } catch (error) {
      if (error instanceof NotFoundError) return null
      throw error
    }
  }, [proposalId, actorId])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(proposalId),
    initialData: null,
  })

  const run = useCallback(
    async (fn) => {
      const result = await fn()
      const portal = result?.portal ?? result
      setData(portal)
      return result
    },
    [setData],
  )

  return {
    portal: data,
    loading,
    error,
    refetch,
    setPortal: setData,
    actorId,
    create: () => run(() => createProposalPortalApi({ proposalId, actorId })),
    publish: (body = {}) => run(() => publishProposalPortalApi({ proposalId, actorId, ...body })),
    revoke: () => run(() => revokeProposalPortalApi({ proposalId, actorId })),
  }
}
