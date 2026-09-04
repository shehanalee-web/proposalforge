import { STORAGE_PROVIDER } from './providers.js'
import { ValidationError } from '../services/errors.js'

export const LOCAL_UPLOAD_MAX_BYTES = 48 * 1024 * 1024

async function readJson(response) {
  return response.json().catch(() => ({}))
}

/**
 * Local disk adapter. Bytes live under `/uploads/proposals/…`.
 * Metadata never lives here — callers store that on the proposal.
 */
export const localStorageAdapter = {
  id: STORAGE_PROVIDER.LOCAL,

  async put({ proposalId, uploadId, file }) {
    const response = await fetch('/api/proposal-files', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Proposal-Id': proposalId,
        'X-Upload-Id': uploadId,
        'X-File-Name': encodeURIComponent(file.name?.trim() || 'file'),
      },
      body: file,
    })
    const payload = await readJson(response)
    if (!response.ok) {
      throw new ValidationError(payload.message || 'Could not store that file.', [
        { field: 'file', message: payload.message || 'Upload failed.' },
      ])
    }
    return {
      provider: STORAGE_PROVIDER.LOCAL,
      storageKey: payload.storageKey,
      url: payload.url,
      sizeBytes: payload.sizeBytes,
      mimeType: payload.mimeType,
    }
  },

  async remove({ proposalId, uploadId }) {
    const response = await fetch(
      `/api/proposal-files/${encodeURIComponent(uploadId)}?proposalId=${encodeURIComponent(proposalId)}`,
      { method: 'DELETE' },
    )
    if (response.status === 404) return
    if (!response.ok) {
      const payload = await readJson(response)
      throw new ValidationError(payload.message || 'Could not delete that file.', [
        { field: 'file', message: payload.message || 'Delete failed.' },
      ])
    }
  },
}
