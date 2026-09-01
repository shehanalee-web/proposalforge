import { useEffect, useId, useRef, useState } from 'react'
import { ValidationError } from '../../services/errors.js'
import { uploadAsset, IMAGE_FILE_ACCEPT } from '../../services/assetService.js'
import { isImageFile, isImageMime } from '../../utils/imageThumbnail.js'
import styles from './ImageUpload.module.css'

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function looksLikeImageUrl(url) {
  if (!url) return false
  if (url.startsWith('blob:') || url.startsWith('data:image')) return true
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)
}

function filesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return []

  if (dataTransfer.files?.length) {
    return [...dataTransfer.files]
  }

  const items = dataTransfer.items
  if (!items) return []

  return [...items]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean)
}

function isTypingTarget(node) {
  if (!node || typeof node !== 'object') return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
}

/**
 * Unified media field. Authors drop, click, paste or pick a local file.
 * The returned URL is stored on the record — remote URLs already on a
 * proposal continue to preview and can be replaced or removed.
 */
function ImageUpload({
  id,
  label = 'Image',
  value = '',
  onChange,
  disabled = false,
  accept = IMAGE_FILE_ACCEPT,
  variant = 'image',
  size = 'image',
  tone = 'default',
  fileName = '',
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef(null)
  const surfaceRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [armed, setArmed] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [localPreview, setLocalPreview] = useState(null)

  const url = typeof value === 'string' ? value : ''
  const uploading = progress !== null && progress < 100
  const showImage =
    variant === 'image' && Boolean(localPreview || (url && looksLikeImageUrl(url)))
  const hasFile = Boolean(url || localPreview)
  const handleFilesRef = useRef(null)

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  useEffect(() => {
    if (!armed || disabled) return undefined

    function onWindowPaste(event) {
      if (isTypingTarget(event.target)) return
      const files = filesFromDataTransfer(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      handleFilesRef.current?.(files)
    }

    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [armed, disabled])

  function openPicker() {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  async function handleFiles(files) {
    const file = files.find((candidate) => candidate instanceof Blob)
    if (!file || disabled || uploading) return

    if (variant === 'image' && !isImageFile(file) && !isImageMime(file.type)) {
      setError('Use a JPEG, PNG, GIF, WebP or SVG image.')
      return
    }

    setError(null)
    setProgress(0)

    if (localPreview) URL.revokeObjectURL(localPreview)
    const preview = isImageFile(file) ? URL.createObjectURL(file) : null
    setLocalPreview(preview)

    try {
      const asset = await uploadAsset(file, { onProgress: setProgress })
      onChange(asset.url, asset)
      setLocalPreview(null)
      if (preview) URL.revokeObjectURL(preview)
    } catch (caught) {
      setLocalPreview(null)
      if (preview) URL.revokeObjectURL(preview)
      const message =
        caught instanceof ValidationError
          ? caught.errors[0]?.message || caught.message
          : caught.message || 'Could not upload that file.'
      setError(message)
    } finally {
      setProgress(null)
    }
  }

  useEffect(() => {
    handleFilesRef.current = handleFiles
  })

  function handleDrop(event) {
    event.preventDefault()
    setDragOver(false)
    handleFiles(filesFromDataTransfer(event.dataTransfer))
  }

  function handlePaste(event) {
    const files = filesFromDataTransfer(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    handleFiles(files)
  }

  function handleRemove(event) {
    event.stopPropagation()
    if (disabled || uploading) return
    setError(null)
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(null)
    onChange('', null)
  }

  const previewSrc = localPreview || url
  const displayName = fileName || (url ? 'Uploaded file' : '')
  const sizeClass = size !== 'image' ? styles[`size${capitalize(size)}`] : ''
  const toneClass = tone !== 'default' ? styles[`tone${capitalize(tone)}`] : ''
  const surfaceClass = [
    styles.surface,
    sizeClass,
    toneClass,
    dragOver ? styles.surfaceActive : '',
    disabled ? styles.surfaceDisabled : '',
    showImage || url ? styles.surfaceFilled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={styles.root}
      onMouseEnter={() => setArmed(true)}
      onMouseLeave={() => setArmed(false)}
    >
      {label ? (
        <span className={styles.label} id={`${inputId}-label`}>
          {label}
        </span>
      ) : null}

      <div
        ref={surfaceRef}
        tabIndex={disabled ? -1 : 0}
        className={surfaceClass}
        aria-labelledby={label ? `${inputId}-label` : undefined}
        aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
        aria-disabled={disabled || uploading}
        onFocus={() => setArmed(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setArmed(false)
          }
        }}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className={styles.input}
          accept={accept}
          disabled={disabled || uploading}
          onChange={(event) => {
            handleFiles([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />

        {showImage && previewSrc ? (
          <img src={previewSrc} alt="" className={styles.preview} />
        ) : url ? (
          <p className={styles.fileName}>{displayName}</p>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {variant === 'file' ? 'Drop a file here' : 'Drop an image here'}
            </p>
            <p className={styles.emptyHint} id={`${inputId}-hint`}>
              Click to browse, or paste from the clipboard
            </p>
          </div>
        )}

        {uploading ? (
          <div className={styles.progress} aria-live="polite">
            <span className={styles.progressBar} style={{ width: `${progress}%` }} />
            <span className={styles.progressLabel}>Uploading {progress}%</span>
          </div>
        ) : null}

        {hasFile && !uploading ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={(event) => {
                event.stopPropagation()
                openPicker()
              }}
              disabled={disabled}
            >
              Replace
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={handleRemove}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default ImageUpload
