/**
 * PDF-only helpers. Display formatting for currency and dates stays in
 * utils/format.js so the on-screen UI and the document stay consistent.
 */

export const PDF_AUDIENCE = Object.freeze({
  STUDIO: 'studio',
  CLIENT: 'client',
})

export function formatProposalNumber(id) {
  if (!id) return '—'

  return String(id).replace(/^prop-/i, 'PROP-').toUpperCase()
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function toPdfFilename(proposal, options = {}) {
  const slug = slugify(proposal.title)
  const number = formatProposalNumber(proposal.id).toLowerCase()
  const version = options.versionNumber ?? proposal.currentVersion
  const versionPart = version ? `-v${version}` : ''

  return `${slug || number || 'proposal'}${versionPart}.pdf`
}
