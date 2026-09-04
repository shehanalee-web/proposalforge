import { useCallback, useState } from 'react'
import {
  addPortalComment,
  editPortalComment,
  requestPortalChanges,
  resolvePortalThread,
} from '../services/portalService.js'

/**
 * Client-portal collaboration writes. Updates flow through onProposalChange
 * so the drawer is not unmounted by a full refetch.
 */
export function usePortalComments({ token, onProposalChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (task) => {
      if (!token) return null
      setBusy(true)
      setError(null)
      try {
        const result = await task()
        onProposalChange?.(result.proposal)
        return result.proposal
      } catch (caught) {
        setError(caught)
        return null
      } finally {
        setBusy(false)
      }
    },
    [token, onProposalChange],
  )

  const addComment = useCallback(
    (message, parentId = null) =>
      run(() => addPortalComment(token, { message, parentId })),
    [run, token],
  )

  const editComment = useCallback(
    (commentId, message) =>
      run(() => editPortalComment(token, commentId, message)),
    [run, token],
  )

  const resolveThread = useCallback(
    (commentId) => run(() => resolvePortalThread(token, commentId)),
    [run, token],
  )

  const requestChanges = useCallback(
    (input) => run(() => requestPortalChanges(token, input)),
    [run, token],
  )

  return {
    busy,
    error,
    addComment,
    editComment,
    resolveThread,
    requestChanges,
  }
}
