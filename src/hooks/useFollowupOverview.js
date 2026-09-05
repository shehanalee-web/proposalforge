import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import { fetchFollowups } from '../services/followupService.js'

const EMPTY = {
  dueToday: 0,
  overdue: 0,
  waitingForClient: 0,
  expiring: 0,
  clientFeedback: 0,
  open: 0,
  nextAction: null,
  followups: [],
}

export function useFollowupOverview(actorId = DEFAULT_ACTOR_ID) {
  const task = useCallback(() => fetchFollowups({ actorId }), [actorId])
  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: EMPTY,
  })
  return { overview: data ?? EMPTY, loading, error, refetch }
}
