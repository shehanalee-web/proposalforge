import {
  hasPricing,
  hasProjectType,
  isDraftReady,
  makeProposalDraft,
  matchProjectType,
  mergeProposalDraft,
  suggestTitle,
} from '../models/proposalDraft.js'

/**
 * Mocked one-question-at-a-time assistant for the AI Proposal Wizard.
 *
 * Replies are local and scripted. Swap `replyToUser` later for a model call
 * without changing the chat UI or ProposalDraft shape.
 */

const OPTIONAL_FIELDS = new Set(['terms'])

const SKIP_PATTERN = /^(skip|n\/a|na|none|not sure yet)\.?$/i

export const QUESTION_ORDER = Object.freeze([
  'industry',
  'company',
  'projectType',
  'deliverables',
  'pricing',
  'timeline',
  'style',
  'terms',
])

const QUESTIONS = {
  industry: 'What industry is this proposal for?',
  company: 'Which company or client is this for?',
  projectType: 'What kind of project is it?',
  deliverables:
    "What's the scope — the main deliverables and pieces of work?",
  pricing: "What's the estimated budget or fee?",
  timeline: "What's the timeline — duration, phases, or a deadline?",
  style:
    'What tone or style should the proposal have? Clean and corporate, editorial, technical, warm and studio-like — whatever fits.',
  terms:
    'Any commercial terms to capture — payment, revisions, validity? You can skip this.',
}

const OPENING =
  "Hi — I'll draft a proposal with you, one question at a time. The preview on the right fills in as we go. What industry is this for?"

function messageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `msg-${crypto.randomUUID()}`
  }

  return `msg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function assistant(text) {
  return { id: messageId(), role: 'assistant', text }
}

function user(text) {
  return { id: messageId(), role: 'user', text }
}

function questionText(field) {
  return QUESTIONS[field]
}

function isSkip(text, field) {
  const value = text.trim()
  if (!OPTIONAL_FIELDS.has(field)) return false
  if (SKIP_PATTERN.test(value)) return true
  if (field === 'terms' && /^(no|nope|nothing)\.?$/i.test(value)) return true
  return false
}

function splitList(text) {
  return text
    .split(/\n|;|•|\u2022|(?:,|\band\b)/i)
    .map((part) => part.replace(/^[\s\-–—*]+/, '').trim())
    .filter((part) => part.length > 1)
}

function extractPricing(text) {
  const dollar = text.match(/\$\s*([\d,]+(?:\.\d+)?)/)
  if (dollar) return Number(dollar[1].replace(/,/g, '')) || 0

  const thousand = text.match(/\b([\d]+(?:\.\d+)?)\s*k\b/i)
  if (thousand) return Math.round(Number(thousand[1]) * 1000) || 0

  const labeled = text.match(
    /(?:budget|fee|price|cost|quote|estimate|retainer|usd)\s*(?:of|is|at|:)?\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
  )
  if (labeled) return Number(labeled[1].replace(/,/g, '')) || 0

  const suffix = text.match(/([\d,]+(?:\.\d+)?)\s*(?:usd|dollars?)\b/i)
  if (suffix) return Number(suffix[1].replace(/,/g, '')) || 0

  const bare = text.trim().match(/^\$?\s*([\d,]+)(?:\.\d+)?\s*(?:usd|dollars?)?$/i)
  if (bare) return Number(bare[1].replace(/,/g, '')) || 0

  return 0
}

function extractTimeline(text) {
  const range = text.match(
    /(\d+\s*(?:-|–|to)\s*\d+\s*(?:days?|weeks?|months?))/i,
  )
  if (range) return range[1].replace(/\s+/g, ' ')

  const duration = text.match(
    /(\d+(?:\.\d+)?\s*(?:days?|weeks?|months?|quarters?))/i,
  )
  if (duration) return duration[1].replace(/\s+/g, ' ')

  const deadline = text.match(
    /(?:by|before|deadline[:\s]+|due[:\s]+)([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?|Q[1-4]\s*\d{2,4})/i,
  )
  if (deadline) return deadline[0].replace(/\s+/g, ' ')

  return ''
}

function extractExtras(text) {
  const patch = {}
  const amount = extractPricing(text)
  const timeline = extractTimeline(text)

  if (amount > 0) {
    patch.pricing = { amount }
  }

  if (timeline) {
    patch.timeline = timeline
  }

  return patch
}

function interpretAnswer(field, text, draft) {
  const extras = extractExtras(text)
  const patch = { ...extras }

  if (!field) {
    if (Object.keys(patch).length === 0) {
      patch.notes = [draft.notes, text.trim()].filter(Boolean).join('\n')
    }
    return patch
  }

  if (isSkip(text, field)) {
    return patch
  }

  const value = text.trim()

  if (field === 'industry') {
    patch.industry = value
    return patch
  }

  if (field === 'company') {
    patch.company = value
    patch.client = value
    return patch
  }

  if (field === 'projectType') {
    patch.projectType = matchProjectType(value)
    return patch
  }

  if (field === 'deliverables') {
    const items = splitList(value)
    patch.deliverables = items.length > 0 ? items : [value]
    return patch
  }

  if (field === 'timeline') {
    patch.timeline = extras.timeline || value
    return patch
  }

  if (field === 'pricing') {
    const amount = extras.pricing?.amount || extractPricing(value)
    patch.pricing = {
      amount,
      notes: amount ? draft.pricing?.notes || '' : value,
    }
    return patch
  }

  if (field === 'style') {
    patch.style = value
    return patch
  }

  if (field === 'terms') {
    patch.terms = value
    return patch
  }

  return patch
}

function isFieldFilled(draft, field) {
  if (field === 'industry') return Boolean(draft.industry?.trim())
  if (field === 'company') return Boolean(draft.company?.trim() || draft.client?.trim())
  if (field === 'projectType') return hasProjectType(draft)
  if (field === 'deliverables') return (draft.deliverables?.length ?? 0) > 0
  if (field === 'timeline') return Boolean(draft.timeline?.trim())
  if (field === 'pricing') return hasPricing(draft) || Boolean(draft.pricing?.notes?.trim())
  if (field === 'style') return Boolean(draft.style?.trim())
  if (field === 'terms') return Boolean(draft.terms?.trim())
  return false
}

export function nextPendingField(draft, skippedFields = []) {
  const skipped = new Set(skippedFields)

  for (const field of QUESTION_ORDER) {
    if (skipped.has(field)) continue
    if (!isFieldFilled(draft, field)) return field
  }

  return null
}

function acknowledge(field, draft) {
  if (field === 'industry' && draft.industry) {
    return `Noted — ${draft.industry}.`
  }

  if (field === 'company' && (draft.company || draft.client)) {
    return `This is for ${draft.company || draft.client}.`
  }

  if (field === 'projectType' && draft.projectType) {
    return `${draft.projectType} — I'll use that as the project type.`
  }

  if (field === 'deliverables' && draft.deliverables.length > 0) {
    return `Scope captured: ${draft.deliverables.join(', ')}.`
  }

  if (field === 'timeline' && draft.timeline) {
    return `Timeline is ${draft.timeline}.`
  }

  if (field === 'pricing' && hasPricing(draft)) {
    return `I'll estimate ${draft.pricing.amount.toLocaleString('en-US')} ${draft.pricing.currency}.`
  }

  if (field === 'style' && draft.style) {
    return `The proposal will feel ${draft.style}.`
  }

  if (field === 'terms' && draft.terms) {
    return "I'll keep those terms with the draft."
  }

  return 'Thanks.'
}

function wrapUp(draft) {
  const name = draft.client || draft.company || 'the client'
  return `I have enough to draft this for ${name}. Opening the editor with a full proposal you can edit.`
}

function composeReply(draft, field, nextField, skipped) {
  if (!field) {
    return isDraftReady(draft)
      ? wrapUp(draft)
      : 'Noted. Tell me a bit more about the company, the project, or the scope.'
  }

  if (!skipped && !OPTIONAL_FIELDS.has(field) && !isFieldFilled(draft, field)) {
    return `I still need that to draft the proposal. ${questionText(field)}`
  }

  const parts = []

  if (skipped) {
    parts.push('No problem — we can leave that blank for now.')
  } else {
    parts.push(acknowledge(field, draft))
  }

  if (nextField) {
    parts.push(questionText(nextField))
    return parts.join(' ')
  }

  parts.push(wrapUp(draft))
  return parts.join(' ')
}

export function createWizardSession() {
  return {
    draft: makeProposalDraft(),
    pendingField: 'industry',
    skippedFields: [],
    messages: [assistant(OPENING)],
  }
}

export function isConversationComplete(session) {
  return session.pendingField === null && isDraftReady(session.draft)
}

/**
 * Apply a user reply to the mocked wizard. Pure — the UI owns delays
 * and can already have appended the user message.
 *
 * @param {{ draft: import('../models/proposalDraft.js').ProposalDraft, pendingField: string | null, skippedFields?: string[], messages: object[] }} session
 * @param {string} userText
 * @param {{ includeUser?: boolean }} [options]
 */
export function replyToUser(session, userText, options = {}) {
  const text = userText.trim()
  if (!text) return session

  const field = session.pendingField
  const skipped = Boolean(field) && isSkip(text, field)
  const skippedFields = [...(session.skippedFields ?? [])]

  if (skipped && field && !skippedFields.includes(field)) {
    skippedFields.push(field)
  }

  const patch = interpretAnswer(field, text, session.draft)
  const draft = mergeProposalDraft(session.draft, patch)
  const nextField = nextPendingField(draft, skippedFields)
  const reply = composeReply(draft, field, nextField, skipped)
  const extras =
    options.includeUser === false ? [assistant(reply)] : [user(text), assistant(reply)]

  return {
    draft,
    pendingField: nextField,
    skippedFields,
    messages: [...session.messages, ...extras],
  }
}

export function wizardCanGenerate(session) {
  return isDraftReady(session.draft)
}

export { isDraftReady, suggestTitle }
