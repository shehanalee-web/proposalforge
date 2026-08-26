import { useCallback } from 'react'
import { fetchSettings } from '../services/settingsService.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load the studio profile.
 *
 * @returns {{
 *   settings: import('../models/settings.js').Settings | null,
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useSettings() {
  const task = useCallback(() => fetchSettings(), [])

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: null,
  })

  return { settings: data, loading, error, refetch }
}
