import { blockPlainText } from '../insights/document.js'
import { planPatchForFinding } from './patchPlan.js'

const MAX_SECTION_CHARS = 2400
const MAX_NEARBY = 2

function clip(value, limit = MAX_SECTION_CHARS) {
  const text = String(value ?? '').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trim()}…`
}

function headingOf(block) {
  const data = block?.data ?? {}
  return String(data.heading || data.kicker || data.title || '').trim()
}

/**
 * Only the affected section, nearby headings, and proposal metadata.
 * Extra roadmap context (brand, CRM, RAG, catalog) is accepted on `options`
 * and forwarded when present — the prompt builder stays the only assembler.
 *
 * @param {{
 *   proposal?: object,
 *   finding?: object,
 *   blocks?: object[],
 *   company?: object,
 *   client?: object,
 *   options?: object,
 * }} input
 */
export function buildImproveContext(input = {}) {
  const proposal = input.proposal ?? {}
  const finding = input.finding ?? {}
  const blocks = Array.isArray(input.blocks) ? input.blocks : []
  const company = input.company ?? {}
  const client = input.client ?? {}
  const options = input.options ?? {}
  const plan = planPatchForFinding(finding)

  const index = blocks.findIndex((block) => block.type === plan.blockType)
  const target = index >= 0 ? blocks[index] : null
  const nearby = []
  if (index >= 0) {
    for (let offset = -MAX_NEARBY; offset <= MAX_NEARBY; offset += 1) {
      if (offset === 0) continue
      const block = blocks[index + offset]
      const heading = headingOf(block)
      if (heading) nearby.push(heading)
    }
  }

  const extras = {}
  const extraKeys = [
    'memory',
    'brandKit',
    'crm',
    'clientHistory',
    'knowledge',
    'catalog',
    'pricing',
    'services',
    'caseStudies',
    'testimonials',
    'templates',
    'language',
    'workspace',
  ]
  for (const key of extraKeys) {
    if (options[key] != null && options[key] !== '') extras[key] = options[key]
  }

  return {
    title: String(proposal.title ?? '').trim() || 'Untitled proposal',
    projectType: String(proposal.projectType ?? '').trim() || 'General',
    industry: String(options.industry ?? proposal.projectType ?? '').trim() || 'General',
    client: String(client.name ?? client.clientName ?? proposal.clientName ?? '').trim(),
    company: String(company.name ?? company.company ?? proposal.company ?? '').trim(),
    language: String(options.language ?? extras.language ?? 'English').trim() || 'English',
    companyTone: String(options.companyTone ?? company.tone ?? '').trim(),
    brandVoice: String(options.brandVoice ?? company.voice ?? company.brandVoice ?? '').trim(),
    section: {
      type: plan.blockType,
      label: plan.label,
      text: clip(blockPlainText(target ?? {})),
      headings: nearby,
    },
    finding: {
      code: finding.code ?? '',
      title: finding.title ?? '',
      severity: finding.severity ?? '',
      message: finding.message ?? '',
      suggestion: finding.suggestion ?? '',
    },
    plan,
    extras,
  }
}

export function slimBlocksForFinding(blocks, finding) {
  const list = Array.isArray(blocks) ? blocks : []
  const plan = planPatchForFinding(finding)
  const index = list.findIndex((block) => block.type === plan.blockType)
  if (index < 0) {
    return list.filter((block) => block.type === plan.blockType).slice(0, 1)
  }

  const start = Math.max(0, index - MAX_NEARBY)
  const end = Math.min(list.length, index + MAX_NEARBY + 1)
  return list.slice(start, end)
}
