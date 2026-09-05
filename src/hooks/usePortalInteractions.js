import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { createPublicInteraction, fetchPublicInteractions } from '../services/interactionService.js'

export function usePortalInteractions(portalId) {
  const task = useCallback(async () => {
    if (!portalId) return { interactions: [], targets: [], portal: null }
    return fetchPublicInteractions(portalId)
  }, [portalId])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(portalId),
    initialData: { interactions: [], targets: [], portal: null },
  })

  const submit = useCallback(
    async (body) => {
      const interaction = await createPublicInteraction(portalId, body)
      await refetch()
      return interaction
    },
    [portalId, refetch],
  )

  return {
    interactions: data?.interactions ?? [],
    targets: data?.targets ?? [],
    portal: data?.portal ?? null,
    loading,
    error,
    refetch,
    submit,
  }
}
