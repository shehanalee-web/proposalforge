/**
 * PDF-only helpers. Display formatting for currency and dates stays in
 * utils/format.js so the on-screen UI and the document stay consistent.
 */

export function formatProposalNumber(id) {
  if (!id) return '—'

  return String(id).replace(/^prop-/i, 'PROP-').toUpperCase()
}

export function toPdfFilename(proposal) {
  const slug = String(proposal.title ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const number = formatProposalNumber(proposal.id).toLowerCase()

  return `${slug || number || 'proposal'}.pdf`
}
