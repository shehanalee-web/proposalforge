import { useCallback } from 'react'
import { fetchLibraryBlocks } from '../services/libraryBlockService.js'
import { useAsyncData } from './useAsyncData.js'

export function useLibraryBlocks() {
  const task = useCallback(() => fetchLibraryBlocks(), [])
  const { data, loading, error, refetch } = useAsyncData(task, {
    initialData: [],
  })

  return { blocks: data, loading, error, refetch }
}
