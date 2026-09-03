import { useCallback } from 'react'
import { fetchServices } from '../services/serviceService.js'
import { useAsyncData } from './useAsyncData.js'

/**
 * Load every service in the workspace library, by name.
 *
 * @returns {{
 *   services: import('../models/service.js').Service[],
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useServices() {
  const task = useCallback(() => fetchServices(), [])

  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: [],
  })

  return { services: data, loading, error, refetch }
}
