import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import {
  assignFollowupApi,
  completeFollowupApi,
  createFollowupApi,
  dismissFollowupApi,
  fetchProposalFollowups,
  scheduleFollowupApi,
  startFollowupApi,
} from '../services/followupService.js'

const EMPTY = { followups: [], nextAction: null, summary: null }

export function useProposalFollowups(proposalId, actorId = DEFAULT_ACTOR_ID) {
  const task = useCallback(async () => {
    if (!proposalId) return EMPTY
    return fetchProposalFollowups({ proposalId, actorId })
  }, [proposalId, actorId])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(proposalId),
    initialData: EMPTY,
  })

  const run = useCallback(
    async (fn) => {
      await fn()
      return refetch()
    },
    [refetch],
  )

  return {
    followups: data?.followups ?? [],
    nextAction: data?.nextAction ?? null,
    summary: data?.summary ?? null,
    loading,
    error,
    refetch,
    setFollowups: setData,
    actorId,
    start: (followupId) => run(() => startFollowupApi({ followupId, actorId })),
    complete: (followupId) => run(() => completeFollowupApi({ followupId, actorId })),
    dismiss: (followupId) => run(() => dismissFollowupApi({ followupId, actorId })),
    assign: (followupId, ownerActorId) =>
      run(() => assignFollowupApi({ followupId, actorId, ownerActorId })),
    schedule: (followupId, dueAt) =>
      run(() => scheduleFollowupApi({ followupId, actorId, dueAt })),
    create: (body) =>
      run(() => createFollowupApi({ ...body, proposalId, actorId })),
  }
}
