import { useCallback, useState } from 'react'
import {
  addStudioComment,
  setProposalThreadPinned,
  setProposalThreadResolved,
} from '../services/proposalService.js'

/**
 * Studio collaboration writes. Updates the loaded proposal in place.
 */
export function useProposalCollaboration({ proposalId, onProposalChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (task) => {
      if (!proposalId) return null
      setBusy(true)
      setError(null)
      try {
        const proposal = await task()
        onProposalChange?.(proposal)
        return proposal
      } catch (caught) {
        setError(caught)
        return null
      } finally {
        setBusy(false)
      }
    },
    [proposalId, onProposalChange],
  )

  const addComment = useCallback(
    (input) => run(() => addStudioComment(proposalId, input)),
    [run, proposalId],
  )

  const setResolved = useCallback(
    (commentId, resolved) =>
      run(() => setProposalThreadResolved(proposalId, commentId, resolved)),
    [run, proposalId],
  )

  const setPinned = useCallback(
    (commentId, pinned) =>
      run(() => setProposalThreadPinned(proposalId, commentId, pinned)),
    [run, proposalId],
  )

  return {
    busy,
    error,
    addComment,
    setResolved,
    setPinned,
  }
}
