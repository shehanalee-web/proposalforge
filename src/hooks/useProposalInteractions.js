import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import {
  acknowledgeInteractionApi,
  fetchStudioInteractions,
  resolveInteractionApi,
} from '../services/interactionService.js'

export function useProposalInteractions(proposalId, actorId = DEFAULT_ACTOR_ID) {
  const task = useCallback(async () => {
    if (!proposalId) return []
    return fetchStudioInteractions({ proposalId, actorId })
  }, [proposalId, actorId])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(proposalId),
    initialData: [],
  })

  const run = useCallback(
    async (fn) => {
      const result = await fn()
      await refetch()
      return result
    },
    [refetch],
  )

  return {
    interactions: data ?? [],
    loading,
    error,
    refetch,
    setInteractions: setData,
    actorId,
    acknowledge: (interactionId) =>
      run(() => acknowledgeInteractionApi({ interactionId, actorId })),
    resolve: (interactionId) => run(() => resolveInteractionApi({ interactionId, actorId })),
  }
}
