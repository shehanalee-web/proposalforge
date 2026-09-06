import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import {
  createLivingInteraction,
  fetchLivingInteractions,
} from '../services/interactionService.js'
import { LIVING_CAPABILITIES } from '../living/types.js'

/**
 * Living share-token H12 interactions. Does not write proposal.comments.
 */
export function useLivingInteractions(shareToken) {
  const token = String(shareToken ?? '').trim()
  const enabled = Boolean(token && LIVING_CAPABILITIES.h12Interactions)

  const task = useCallback(async () => {
    if (!enabled) return { interactions: [], targets: [], portal: null, living: null }
    return fetchLivingInteractions(token)
  }, [enabled, token])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled,
    initialData: { interactions: [], targets: [], portal: null, living: null },
  })

  const submit = useCallback(
    async (body) => {
      if (!enabled) {
        throw new Error('Living interactions are not available.')
      }
      const interaction = await createLivingInteraction(token, body)
      await refetch()
      return interaction
    },
    [enabled, token, refetch],
  )

  return {
    enabled,
    interactions: data?.interactions ?? [],
    targets: data?.targets ?? [],
    portal: data?.portal ?? null,
    living: data?.living ?? null,
    loading,
    error,
    refetch,
    submit,
  }
}
