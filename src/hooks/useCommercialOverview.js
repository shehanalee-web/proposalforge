import { useCallback } from 'react'
import { fetchCommercialOverview } from '../services/proposalService.js'
import { useAsyncData } from './useAsyncData.js'

const EMPTY = {
  queues: {
    needsFollowUp: [],
    expiringSoon: [],
    awaitingSignature: [],
    awaitingPayment: [],
    recentlyViewed: [],
    recent: [],
  },
  recentActivity: [],
  stats: {
    viewed: 0,
    awaitingSignature: 0,
    awaitingPayment: 0,
    followUp: 0,
    expiring: 0,
  },
}

export function useCommercialOverview() {
  const task = useCallback(() => fetchCommercialOverview(), [])
  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: EMPTY,
  })

  return { overview: data, loading, error, refetch }
}
