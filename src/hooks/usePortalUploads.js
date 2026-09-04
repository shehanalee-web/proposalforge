import { useCallback, useState } from 'react'
import {
  addPortalUpload,
  deletePortalUpload,
  replacePortalUpload,
} from '../services/portalService.js'

/**
 * Client-portal proposal file writes. Updates flow through onProposalChange
 * so drawers stay mounted.
 */
export function usePortalUploads({ token, onProposalChange }) {
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

  const addFiles = useCallback(
    async (files) => {
      let latest = null
      for (const file of files) {
        latest = await run(() => addPortalUpload(token, file))
        if (!latest) break
      }
      return latest
    },
    [run, token],
  )

  const replaceFile = useCallback(
    (uploadId, file) => run(() => replacePortalUpload(token, uploadId, file)),
    [run, token],
  )

  const removeFile = useCallback(
    (uploadId) => run(() => deletePortalUpload(token, uploadId)),
    [run, token],
  )

  return { busy, error, addFiles, replaceFile, removeFile }
}
