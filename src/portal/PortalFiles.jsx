import { useState } from 'react'
import Icon from '../components/Icon/Icon.jsx'
import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { canMutateClientFiles } from '../models/approval.js'
import { isPreviewableUpload, UPLOAD_KIND } from '../models/upload.js'
import { usePortalUploads } from '../hooks/usePortalUploads.js'
import { usePortal } from './PortalContext.jsx'
import { UploadDropzone, UploadFileRow, UploadProgress } from '../uploads/UploadDropzone.jsx'
import styles from './PortalQuestionnaire.module.css'
import fileStyles from './PortalFiles.module.css'

function PortalFiles({ onClose, onProposalChange }) {
  const { proposal, token } = usePortal()
  const flow = usePortalUploads({ token, onProposalChange })
  const canMutate = canMutateClientFiles(proposal)
  const uploads = proposal.uploads ?? []
  const [pending, setPending] = useState([])
  const [preview, setPreview] = useState(null)

  async function handleFiles(files) {
    setPending(files.map((file) => ({ name: file.name, value: 28 })))
    const saved = await flow.addFiles(files)
    setPending((current) =>
      current.map((item) => ({ ...item, value: 100 })),
    )
    window.setTimeout(() => setPending([]), 220)
    return saved
  }

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.backdrop} aria-label="Close files" onClick={onClose} />
      <aside className={`${styles.drawer} ${fileStyles.drawer}`} aria-label="Proposal files">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Onboarding</p>
            <h2 className={styles.title}>Files</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close files">
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className={fileStyles.scroll}>
          {canMutate ? (
            <UploadDropzone disabled={flow.busy} onFiles={handleFiles} />
          ) : (
            <p className={fileStyles.lock}>
              <Icon name="lock" size={13} />
              This proposal is locked. Files can still be downloaded.
            </p>
          )}

          {pending.map((item) => (
            <UploadProgress key={item.name} label={item.name} value={item.value} />
          ))}

          {flow.error ? (
            <p className={styles.banner} role="alert">
              {flow.error.message}
            </p>
          ) : null}

          {uploads.length === 0 && pending.length === 0 ? (
            <p className={fileStyles.empty}>
              No files yet. Drop logos, drawings, or references for this proposal only.
            </p>
          ) : (
            <div>
              {uploads.map((upload) => (
                <UploadFileRow
                  key={upload.id}
                  upload={upload}
                  canMutate={canMutate}
                  busy={flow.busy}
                  onPreview={setPreview}
                  onReplace={(item, file) => flow.replaceFile(item.id, file)}
                  onDelete={(item) => flow.removeFile(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {preview && isPreviewableUpload(preview) ? (
        <ViewerDialog
          open
          title={preview.name}
          description="Preview stays on this proposal. Nothing is added to the studio library."
          onClose={() => setPreview(null)}
        >
          {preview.kind === UPLOAD_KIND.IMAGE ? (
            <img className={fileStyles.preview} src={preview.url} alt={preview.name} />
          ) : (
            <iframe className={fileStyles.frame} title={preview.name} src={preview.url} />
          )}
        </ViewerDialog>
      ) : null}
    </div>
  )
}

export default PortalFiles
