import { useCallback, useMemo } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { fetchWorkflowMap } from '../services/workflowService.js'
import { WORKFLOW_STATUS } from '../workflow/types.js'

export function useWorkflowMap(proposalIds = []) {
  const key = Array.isArray(proposalIds) ? proposalIds.join(',') : ''
  const task = useCallback(() => {
    const ids = key ? key.split(',') : []
    if (!ids.length) return Promise.resolve([])
    return fetchWorkflowMap({ proposalIds: ids })
  }, [key])

  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: key.length > 0,
    initialData: [],
  })

  const byProposalId = useMemo(() => {
    const map = new Map()
    for (const item of data ?? []) map.set(item.proposalId, item)
    return map
  }, [data])

  function statusOf(proposalId) {
    return byProposalId.get(proposalId)?.status ?? WORKFLOW_STATUS.DRAFT
  }

  return { workflows: data ?? [], byProposalId, statusOf, loading, error, refetch }
}
