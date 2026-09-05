import { COACH_ACTION, COACH_ACTION_LABELS } from './types.js'
import { COACH_MODE_LABELS, resolveCoachMode } from './modes.js'

function line(label, value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return `${label}: ${text}`
}

function actionInstruction(action) {
  switch (action) {
    case COACH_ACTION.EXPLAIN_DEEPER:
      return 'Explain in more depth why this finding matters and how a practitioner would repair it. Stay educational.'
    case COACH_ACTION.ALTERNATIVES:
      return 'Suggest two or three generic approaches to repair this kind of gap. Label them as generic. Do not invent project facts.'
    case COACH_ACTION.IMPROVE_SECTION:
      return 'Give rewrite advice for this section only. Describe how to improve it. Do not output a full replacement proposal. Do not invent numbers, dates, deliverables, or prices.'
    case COACH_ACTION.SALES:
      return 'Explain this finding in sales language: buyer uncertainty, evaluation, and approval. Do not claim guaranteed wins.'
    case COACH_ACTION.TECHNICAL:
      return 'Explain this finding in technical language: outputs, boundaries, and implementation clarity.'
    default:
      return 'Explain the finding, why it matters, and what to do next. Teach; do not chat.'
  }
}

/**
 * Minimum coaching prompt. Unrelated proposal content is not included.
 *
 * @param {object} [input]
 */
export function buildCoachPrompt(input = {}) {
  const item = input.item ?? {}
  const proposal = input.proposal ?? {}
  const mode = resolveCoachMode(input.mode)
  const action = String(input.action ?? COACH_ACTION.ASK)
  const tone = String(input.companyTone ?? input.company?.tone ?? '').trim()
  const voice = String(input.brandVoice ?? input.company?.voice ?? '').trim()
  const hasVoice = Boolean(tone || voice)

  const systemPrompt = [
    'You are an experienced proposal professional coaching the author of a live business proposal.',
    'Teach, explain, and guide. Do not act like a generic chatbot.',
    'Do not invent project facts, pricing, timelines, deliverables, quantities, or client details.',
    'If a fact is missing, say so and keep the advice generic.',
    'Do not email, message, or send anything to a client. This is author-facing coaching only.',
    hasVoice
      ? `Respect the company's configured tone and brand voice. Do not replace them with a generic AI personality.`
      : 'No company voice profile is available. Use neutral professional language. Do not pretend a voice profile exists.',
    'Write concise paragraphs. No markdown fences unless the user needs a short labelled example.',
    actionInstruction(action),
  ].join(' ')

  const meta = [
    line('Coaching mode', COACH_MODE_LABELS[mode] || mode),
    line('Requested action', COACH_ACTION_LABELS[action] || action),
    line('Proposal title', proposal.title),
    line('Proposal type', input.proposalType || proposal.projectType),
    line('Industry', input.industry || proposal.projectType),
    line('Client', input.client || proposal.clientName),
    line('Company', input.companyName || proposal.company),
    hasVoice ? line('Company tone', tone) : line('Company tone', 'Not configured'),
    hasVoice ? line('Brand voice', voice) : line('Brand voice', 'Not configured'),
    line('Source engine', item.sourceEngine),
    line('Finding type', item.findingType || item.code),
    line('Severity', item.severity),
    line('Affected section', item.sectionLabel || item.section),
    line('Title', item.title),
    line('What is happening', item.explanation),
    line('Why it matters', item.whyItMatters),
    line('Risk if ignored', item.riskIfIgnored),
    line('Recommended next step', item.recommendation),
    line('Why it was flagged', item.flaggedBecause),
    line('What good looks like', item.goodExample),
    line('Current section content', input.sectionText || '(empty or not sent)'),
    line('Intelligence note', input.intelligenceNote),
    line('Consistency note', input.consistencyNote),
  ].filter(Boolean)

  const userPrompt = [
    'Coach the author on this existing finding. Use only the context below.',
    'Do not introduce new proposal facts.',
    meta.join('\n'),
  ].join('\n\n')

  return { systemPrompt, userPrompt }
}
