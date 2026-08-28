import { useCallback } from 'react'
import { fetchBrandKit } from '../services/brandKitService.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load the workspace Company Identity.
 *
 * @returns {{
 *   kit: import('../models/brandKit.js').BrandKit | null,
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useBrandKit() {
  const task = useCallback(() => fetchBrandKit(), [])

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: null,
  })

  return { kit: data, loading, error, refetch }
}
