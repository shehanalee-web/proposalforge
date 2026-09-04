import { useState } from 'react'
import {
  formatUploadSize,
  isPreviewableUpload,
  PROPOSAL_UPLOAD_ACCEPT,
  uploadIconName,
} from '../models/upload.js'
import Icon from '../components/Icon/Icon.jsx'
import styles from './UploadDropzone.module.css'

function filesFromList(list) {
  return [...(list ?? [])].filter(Boolean)
}

export function UploadDropzone({
  disabled = false,
  accept = PROPOSAL_UPLOAD_ACCEPT,
  onFiles,
  label = 'Drop files here or browse',
  hint = 'Images, PDF, Office, CAD, video, and archives up to 48 MB.',
}) {
  const [over, setOver] = useState(false)

  function emit(fileList) {
    const files = filesFromList(fileList)
    if (!files.length || disabled) return
    onFiles?.(files)
  }

  return (
    <label
      className={`${styles.drop} ${over ? styles.over : ''} ${disabled ? styles.disabled : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        emit(event.dataTransfer?.files)
      }}
    >
      <span className={styles.dropIcon}>
        <Icon name="upload" size={16} />
      </span>
      <span className={styles.dropTitle}>{label}</span>
      <span className={styles.dropHint}>{hint}</span>
      <input
        className={styles.input}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files)
          event.target.value = ''
        }}
      />
    </label>
  )
}

export function UploadFileRow({
  upload,
  canMutate = false,
  busy = false,
  onReplace,
  onDelete,
  onPreview,
}) {
  const previewable = isPreviewableUpload(upload)

  return (
    <article className={styles.row}>
      <span className={styles.fileIcon}>
        <Icon name={uploadIconName(upload.kind)} size={15} />
      </span>
      <div className={styles.meta}>
        <p className={styles.name}>{upload.name}</p>
        <p className={styles.detail}>
          {formatUploadSize(upload.sizeBytes)}
          {upload.currentVersion > 1 ? ` · v${upload.currentVersion}` : ''}
          {upload.uploadedByName ? ` · ${upload.uploadedByName}` : ''}
        </p>
      </div>
      <div className={styles.actions}>
        {previewable && upload.url ? (
          <button type="button" className={styles.ghost} onClick={() => onPreview?.(upload)}>
            Preview
          </button>
        ) : null}
        {upload.url ? (
          <a className={styles.ghost} href={upload.url} download={upload.name}>
            Download
          </a>
        ) : null}
        {canMutate ? (
          <label className={styles.ghost}>
            Replace
            <input
              className={styles.input}
              type="file"
              accept={PROPOSAL_UPLOAD_ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onReplace?.(upload, file)
              }}
            />
          </label>
        ) : null}
        {canMutate ? (
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() => onDelete?.(upload)}
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function UploadProgress({ label, value }) {
  return (
    <div className={styles.progress} role="status">
      <div className={styles.progressMeta}>
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}
