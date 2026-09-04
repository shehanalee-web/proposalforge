import { useCallback, useState } from 'react'
import {
  addProposalUpload,
  cancelProposal,
  deleteProposalUpload,
  replaceProposalUpload,
  requestProposalSignature,
  updateProposalPayment,
} from '../services/proposalService.js'
import { UPLOAD_ACTOR } from '../models/upload.js'

/**
 * Studio management writes for client onboarding (files, approval, signature,
 * payment). Clients never call this hook.
 */
export function useProposalClientWorkspace({ proposalId, onProposalChange }) {
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

  const addFiles = useCallback(
    async (files) => {
      let latest = null
      for (const file of files) {
        latest = await run(() =>
          addProposalUpload(proposalId, file, { actor: UPLOAD_ACTOR.STUDIO }),
        )
        if (!latest) break
      }
      return latest
    },
    [run, proposalId],
  )

  const replaceFile = useCallback(
    (uploadId, file) =>
      run(() =>
        replaceProposalUpload(proposalId, uploadId, file, {
          actor: UPLOAD_ACTOR.STUDIO,
        }),
      ),
    [run, proposalId],
  )

  const removeFile = useCallback(
    (uploadId) => run(() => deleteProposalUpload(proposalId, uploadId)),
    [run, proposalId],
  )

  const cancel = useCallback(
    () => run(() => cancelProposal(proposalId)),
    [run, proposalId],
  )

  const requestSignature = useCallback(
    () => run(() => requestProposalSignature(proposalId)),
    [run, proposalId],
  )

  const savePayment = useCallback(
    (patch) => run(() => updateProposalPayment(proposalId, patch)),
    [run, proposalId],
  )

  return {
    busy,
    error,
    addFiles,
    replaceFile,
    removeFile,
    cancel,
    requestSignature,
    savePayment,
  }
}
