import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { fetchWorkflowOverview } from '../services/workflowService.js'

export function useWorkflowOverview() {
  const task = useCallback(() => fetchWorkflowOverview(), [])
  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: null,
  })
  return { overview: data, loading, error, refetch }
}
