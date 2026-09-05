import { UNRESOLVED_FACT } from './types.js'

const AMOUNT = /(?:\$|USD|EUR|GBP)\s?[\d,]+(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/gi
const PERCENT = /\b\d+(?:\.\d+)?%/g
const DURATION = /\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b/gi
const WARRANTY = /\b(?:warranty|warranted)\b[^.!?\n]{0,40}\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b/gi
const CERTIFICATION = /\b(?:ISO\s?\d{3,5}|certified|certification|accredited)\b/gi
const GUARANTEE = /\b(?:guarantee|guaranteed|unconditional)\b/gi

function collect(text, pattern) {
  const matches = String(text ?? '').match(pattern)
  return matches ? [...new Set(matches.map((value) => value.trim()))] : []
}

function flattenDraft(draft = {}) {
  const parts = [
    draft.title,
    ...(draft.assumptions ?? []),
    ...(draft.exclusions ?? []),
    ...(draft.sections ?? []).flatMap((section) =>
      (section.blocks ?? []).flatMap((block) => [
        block.heading,
        block.body,
        ...(block.items ?? []).flatMap((item) => [item.title, item.body, item.date, item.amount]),
      ]),
    ),
  ]
  return parts.map((value) => String(value ?? '')).join('\n')
}

function factBlob(ledger) {
  return (ledger?.facts ?? []).map((entry) => entry.value).join('\n')
}

function unsupported(label, found, allowedBlob) {
  return found.filter((value) => {
    const needle = value.replace(/\s+/g, ' ').trim()
    if (!needle) return false
    if (allowedBlob.includes(needle)) return false
    if (needle === UNRESOLVED_FACT) return false
    return true
  }).map((value) => ({
    code: label,
    value,
    message: `Generated ${label.replace(/_/g, ' ')} "${value}" was not supplied as a fact and needs review.`,
  }))
}

/**
 * Mark unsupported factual claims for review. Never silently delete them.
 *
 * @param {object} draft
 * @param {object} ledger
 */
export function validateGeneratedFacts(draft, ledger) {
  const text = flattenDraft(draft)
  const allowed = factBlob(ledger)
  const issues = [
    ...unsupported('currency_amount', collect(text, AMOUNT), allowed),
    ...unsupported('percentage', collect(text, PERCENT), allowed),
    ...unsupported('duration', collect(text, DURATION), allowed),
    ...unsupported('warranty_period', collect(text, WARRANTY), allowed),
    ...unsupported('certification', collect(text, CERTIFICATION), allowed),
    ...unsupported('guarantee', collect(text, GUARANTEE), allowed),
  ]

  return {
    reviewRequired: issues.length > 0,
    issues,
  }
}

export function collectGenerationWarnings({ proposalInputs = {}, knowledgeItems = [], review } = {}) {
  const warnings = []
  if (!String(proposalInputs.timeline ?? '').trim()) {
    warnings.push({
      code: 'missing_timeline',
      message: 'Timeline was not provided.',
      action: 'Add a schedule in the editor before sending.',
    })
  }
  if (!String(proposalInputs.pricing ?? '').trim()) {
    warnings.push({
      code: 'missing_pricing',
      message: 'Pricing was not provided.',
      action: 'Enter confirmed fees in the pricing block. Do not guess.',
    })
  }
  const hasWarranty =
    Boolean(String(proposalInputs.warranty ?? '').trim()) ||
    knowledgeItems.some((item) => item.type === 'warranty')
  if (!hasWarranty) {
    warnings.push({
      code: 'missing_warranty',
      message: 'No approved warranty language was found.',
      action: 'Add warranty language from Company Knowledge or leave it unresolved.',
    })
  }
  warnings.push({
    code: 'ai_wording_review',
    message: 'AI-generated wording requires review.',
    action: 'Read each section in the editor before sending to the client.',
  })
  for (const issue of review?.issues ?? []) {
    warnings.push({
      code: issue.code,
      message: issue.message,
      action: 'Confirm or remove the unsupported claim before sending.',
    })
  }
  return warnings
}
