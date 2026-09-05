import { useCallback } from 'react'
import { fetchCompanyKnowledge } from '../services/knowledgeService.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { useAsyncData } from './useAsyncData.js'

export function useCompanyKnowledge({
  companyId = DEFAULT_COMPANY_ID,
  query,
  categories,
  status,
  includeArchived = true,
} = {}) {
  const task = useCallback(
    () =>
      fetchCompanyKnowledge({
        companyId,
        query,
        categories,
        status,
        includeArchived,
      }),
    [companyId, query, categories, status, includeArchived],
  )

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    initialData: [],
  })

  return { items: data ?? [], loading, error, refetch, setData }
}
