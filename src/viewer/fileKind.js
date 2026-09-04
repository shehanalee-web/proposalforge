const KINDS = [
  { kind: 'image', icon: 'fileImage', label: 'Image', test: /\.(png|jpe?g|gif|webp|svg|avif)$/i },
  { kind: 'pdf', icon: 'filePdf', label: 'PDF', test: /\.pdf$/i },
  { kind: 'video', icon: 'fileVideo', label: 'Video', test: /\.(mp4|mov|webm|m4v)$/i },
  { kind: 'zip', icon: 'fileZip', label: 'ZIP', test: /\.(zip|rar|7z)$/i },
  { kind: 'cad', icon: 'fileCad', label: 'CAD', test: /\.(dwg|dxf|step|stp|iges|igs)$/i },
]

export function getFileKind(name = '', mimeType = '', url = '') {
  const haystack = `${name} ${url}`.toLowerCase()
  const mime = mimeType.toLowerCase()

  if (mime.startsWith('image/')) return { kind: 'image', icon: 'fileImage', label: 'Image' }
  if (mime === 'application/pdf') return { kind: 'pdf', icon: 'filePdf', label: 'PDF' }
  if (mime.startsWith('video/')) return { kind: 'video', icon: 'fileVideo', label: 'Video' }
  if (mime.includes('zip') || mime.includes('compressed')) {
    return { kind: 'zip', icon: 'fileZip', label: 'ZIP' }
  }

  const match = KINDS.find((entry) => entry.test.test(haystack))
  return match ?? { kind: 'file', icon: 'blockAttachments', label: 'File' }
}
