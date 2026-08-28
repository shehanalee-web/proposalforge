/**
 * Download a template as JSON for backup or sharing.
 *
 * @param {import('../models/template.js').ProposalTemplate} template
 */
export function exportTemplate(template) {
  const slug = String(template.title ?? 'template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'template'

  const blob = new Blob([`${JSON.stringify(template, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${slug}.json`
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
