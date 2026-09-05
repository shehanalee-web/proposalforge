import { useCallback } from 'react'
import { fetchKnowledgeItem } from '../services/knowledgeService.js'
import { NotFoundError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { useAsyncData } from './useAsyncData.js'

export function useKnowledgeItem(id, companyId = DEFAULT_COMPANY_ID) {
  const task = useCallback(() => fetchKnowledgeItem(companyId, id), [companyId, id])
  const { data, loading, error, refetch } = useAsyncData(task, {
    enabled: Boolean(id),
    initialData: null,
  })

  return {
    item: data,
    loading,
    error,
    notFound: error instanceof NotFoundError,
    refetch,
  }
}
