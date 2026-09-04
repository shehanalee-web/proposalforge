import { FINDING_SEVERITY_LABELS } from '../insights/ids.js'
import { buildImproveContext } from './context.js'

function line(label, value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return `${label}: ${text}`
}

function shapeInstructions(plan) {
  switch (plan.dataShape) {
    case 'timeline-items':
      return 'Return data.items as 3–5 milestones with title, date, and body. Do not invent calendar dates the proposal never stated — use relative phases (Week 1, Week 2) only when the current section has no dates.'
    case 'deliverable-items':
      return 'Return data.items as concrete deliverables with title and body. Do not add products, files, or quantities that are not implied by the current section or finding.'
    case 'append':
      return 'Return append as a short terms paragraph to add. Do not rewrite existing terms.'
    case 'signature':
      return 'Return a short previewBody describing the acceptance step. Leave data empty.'
    case 'move':
      return 'Return previewBody explaining the reorder only. Do not change prices.'
    default:
      return 'Return data.body as the replacement executive-summary paragraph. Also set summary to the same text.'
  }
}

/**
 * Single prompt assembler. Providers must pass these strings through
 * unchanged.
 *
 * @param {object} [input]
 * @returns {{ systemPrompt: string, userPrompt: string, context: object }}
 */
export function buildImprovementPrompt(input = {}) {
  const context = buildImproveContext(input)
  const { finding, plan, section, extras } = context
  const severity = FINDING_SEVERITY_LABELS[finding.severity] || finding.severity

  const systemPrompt = [
    'You are a senior proposal consultant rewriting one section of a live business proposal.',
    'Write like a careful human practitioner: clear, specific, and commercially useful.',
    'Never sound AI-generated. No clichés, no marketing fluff, no filler adjectives.',
    'Improve only the requested section. Preserve the document’s formatting style.',
    'Never invent facts, pricing, timelines, deliverables, or technical specifications that are not supported by the supplied section or metadata.',
    'If the source is silent, keep language general rather than fabricating numbers, dates, materials, or scope.',
    'Respect company tone, brand voice, proposal type, and the client’s context when they are provided.',
    'Return a single JSON object only, with keys previewTitle, previewBody, data, append, and summary.',
    'previewBody is the human-readable draft the editor will show before insert.',
  ].join(' ')

  const meta = [
    line('Proposal title', context.title),
    line('Proposal type', context.projectType),
    line('Industry', context.industry),
    line('Client', context.client),
    line('Company', context.company),
    line('Language', context.language),
    line('Company tone', context.companyTone),
    line('Brand voice', context.brandVoice),
    line('Current section', section.label),
    line('Nearby headings', section.headings.join('; ')),
    line('Current section text', section.text || '(empty)'),
    line('Health finding', finding.title || finding.code),
    line('Severity', severity),
    line('Why it matters', finding.message),
    line('Improvement objective', finding.suggestion),
    extras.memory ? line('Proposal memory', extras.memory) : null,
    extras.brandKit ? line('Brand kit', extras.brandKit) : null,
    extras.crm ? line('CRM context', extras.crm) : null,
  ].filter(Boolean)

  const userPrompt = [
    'Rewrite the current section to resolve the health finding.',
    shapeInstructions(plan),
    'Do not include markdown fences or commentary outside JSON.',
    meta.join('\n'),
  ].join('\n\n')

  return { systemPrompt, userPrompt, context }
}
