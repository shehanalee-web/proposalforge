/**
 * Client-side thumbnail generation for uploaded images.
 *
 * Layouts still decide crop and display size. This only produces a small
 * preview for the uploader and library, so authors never type a URL or
 * resize by hand.
 */

export const THUMBNAIL_MAX_EDGE = 360

export function isImageMime(mimeType) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/')
}

export function isImageFile(file) {
  return file instanceof Blob && isImageMime(file.type)
}

/**
 * @param {Blob} file
 * @param {number} [maxEdge]
 * @returns {Promise<Blob | null>}
 */
export async function generateThumbnail(file, maxEdge = THUMBNAIL_MAX_EDGE) {
  if (!isImageFile(file)) return null
  if (file.type === 'image/svg+xml') return file

  const bitmap = await decodeImage(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    bitmap.close?.()
    return file
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      type,
      type === 'image/jpeg' ? 0.82 : undefined,
    )
  })
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadHtmlImage(objectUrl)
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read this image.'))
    image.src = src
  })
}
