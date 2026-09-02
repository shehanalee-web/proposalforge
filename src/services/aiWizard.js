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

/**
 * Longer phrases first so “project type” wins over “project”.
 * Used to detect labelled bulk pastes and to strip those labels from values.
 */
const FIELD_LABEL_DEFS = [
  ['project type', 'projectType'],
  ['project', 'projectType'],
  ['deliverables', 'deliverables'],
  ['deliverable', 'deliverables'],
  ['scope', 'deliverables'],
  ['industry', 'industry'],
  ['sector', 'industry'],
  ['vertical', 'industry'],
  ['company', 'company'],
  ['client', 'company'],
  ['organisation', 'company'],
  ['organization', 'company'],
  ['firm', 'company'],
  ['budget', 'pricing'],
  ['pricing', 'pricing'],
  ['fee', 'pricing'],
  ['price', 'pricing'],
  ['cost', 'pricing'],
  ['estimate', 'pricing'],
  ['timeline', 'timeline'],
  ['duration', 'timeline'],
  ['deadline', 'timeline'],
  ['schedule', 'timeline'],
  ['style', 'style'],
  ['tone', 'style'],
  ['terms', 'terms'],
].sort((a, b) => b[0].length - a[0].length)

const LABEL_BODY = FIELD_LABEL_DEFS.map(([label]) =>
  label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
).join('|')

const LABEL_TOKEN = new RegExp(
  `(^|[\\n\\r;]+|\\s+)(${LABEL_BODY})(?:\\s*[:\\-–—]\\s*|\\s+)`,
  'gi',
)

const LABEL_AT_START = new RegExp(`^(${LABEL_BODY})(?:\\s*[:\\-–—]\\s*|\\s+)`, 'i')

const LABEL_TO_FIELD = new Map(
  FIELD_LABEL_DEFS.map(([label, field]) => [label.toLowerCase(), field]),
)

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

function normalizeLabel(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function fieldFromLabel(label) {
  return LABEL_TO_FIELD.get(normalizeLabel(label)) ?? null
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
    /(?:budget|fee|price|cost|quote|estimate|usd)\s*(?:of|is|at|:)?\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
  )
  if (labeled) return Number(labeled[1].replace(/,/g, '')) || 0

  const suffix = text.match(/([\d,]+(?:\.\d+)?)\s*(?:usd|dollars?)\b/i)
  if (suffix) return Number(suffix[1].replace(/,/g, '')) || 0

  const bare = text.trim().match(/^\$?\s*([\d,]+)(?:\.\d+)?\s*(?:usd|dollars?)?$/i)
  if (bare) return Number(bare[1].replace(/,/g, '')) || 0

  return 0
}

function extractCurrency(text) {
  const match = String(text).match(/\b(USD|EUR|GBP|AED|AUD|CAD)\b/i)
  return match ? match[1].toUpperCase() : ''
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

function stripListPrefix(line) {
  return line.replace(/^(?:[-–—*•]|\d+[.)])\s+/, '').trim()
}

function stripLeadingLabel(chunk) {
  const trimmed = String(chunk ?? '').trim()
  if (!trimmed) return { field: null, value: '' }

  const match = trimmed.match(LABEL_AT_START)
  if (!match) return { field: null, value: trimmed }

  const field = fieldFromLabel(match[1])
  const value = trimmed.slice(match[0].length).trim()
  return { field, value: value || trimmed }
}

/**
 * Pull labelled pairs out of a paste: “Industry SaaS Company Northwind…”
 * or newline forms like “Industry: SaaS”.
 *
 * @param {string} text
 * @returns {{ field: string, value: string }[]}
 */
export function parseLabeledAnswers(text) {
  const source = String(text ?? '')
  if (!source.trim()) return []

  const matches = []
  const pattern = new RegExp(LABEL_TOKEN.source, LABEL_TOKEN.flags)
  let match = pattern.exec(source)

  while (match) {
    const field = fieldFromLabel(match[2])
    if (field) {
      matches.push({
        field,
        valueStart: match.index + match[0].length,
        index: match.index,
      })
    }
    match = pattern.exec(source)
  }

  if (matches.length === 0) return []

  const pairs = []

  for (let i = 0; i < matches.length; i += 1) {
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length
    const value = source.slice(matches[i].valueStart, end).trim()
    if (!value) continue
    pairs.push({ field: matches[i].field, value })
  }

  return pairs
}

function looksLikeLabeledBulk(text, pairs) {
  if (!pairs || pairs.length < 2) return false
  const trimmed = text.trim()
  if (LABEL_AT_START.test(trimmed)) return true

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const labeledLines = lines.filter((line) => LABEL_AT_START.test(line))
  return labeledLines.length >= 2
}

/**
 * Split a pasted message into candidate answers for remaining wizard fields.
 *
 * Newlines and semicolons win. Sentence splits only apply when every piece
 * looks like a short discrete answer — a long terms paragraph stays one value.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitIntoAnswers(text) {
  const trimmed = text.trim()
  if (!trimmed) return []

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => stripListPrefix(line))
    .filter(Boolean)

  if (lines.length >= 2) return lines

  const semis = trimmed
    .split(/\s*;\s*/)
    .map((part) => stripListPrefix(part))
    .filter(Boolean)

  if (semis.length >= 2) return semis

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.replace(/[.!?]+$/, '').trim())
    .filter(Boolean)

  if (
    sentences.length >= 2 &&
    sentences.every((part) => part.length <= 80 && part.split(/\s+/).length <= 14)
  ) {
    return sentences
  }

  return [trimmed]
}

function assignField(field, chunk, draft) {
  const value = chunk.trim()
  if (!value) return {}

  if (field === 'industry') return { industry: value }
  if (field === 'company') return { company: value, client: value }
  if (field === 'projectType') return { projectType: matchProjectType(value) }
  if (field === 'deliverables') {
    const items = splitList(value)
    return { deliverables: items.length > 0 ? items : [value] }
  }
  if (field === 'pricing') {
    const amount = extractPricing(value)
    const currency = extractCurrency(value)
    return {
      pricing: {
        amount,
        ...(currency ? { currency } : {}),
        notes: amount ? draft.pricing?.notes || '' : value,
      },
    }
  }
  if (field === 'timeline') return { timeline: extractTimeline(value) || value }
  if (field === 'style') return { style: value }
  if (field === 'terms') return { terms: value }
  return {}
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

function requiredFieldsFilled(draft, skippedFields = []) {
  const skipped = new Set(skippedFields)
  return QUESTION_ORDER.filter((field) => !OPTIONAL_FIELDS.has(field)).every(
    (field) => skipped.has(field) || isFieldFilled(draft, field),
  )
}

export function nextPendingField(draft, skippedFields = []) {
  const skipped = new Set(skippedFields)

  if (requiredFieldsFilled(draft, skippedFields)) return null

  for (const field of QUESTION_ORDER) {
    if (skipped.has(field)) continue
    if (!isFieldFilled(draft, field)) return field
  }

  return null
}

function currentIndex(session) {
  if (Number.isInteger(session.questionIndex)) {
    return Math.max(0, session.questionIndex)
  }

  const fromField = QUESTION_ORDER.indexOf(session.pendingField)
  return fromField >= 0 ? fromField : QUESTION_ORDER.length
}

function applyAnswer(draft, skippedFields, field, value) {
  const chunk = String(value ?? '').trim()
  if (!field || !chunk) {
    return { draft, skipped: false, applied: false }
  }

  if (isSkip(chunk, field)) {
    if (!skippedFields.includes(field)) skippedFields.push(field)
    return { draft, skipped: true, applied: true }
  }

  if (OPTIONAL_FIELDS.has(field) === false && SKIP_PATTERN.test(chunk)) {
    return { draft, skipped: false, applied: false }
  }

  return {
    draft: mergeProposalDraft(draft, assignField(field, chunk, draft)),
    skipped: false,
    applied: true,
  }
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

  if (field === 'pricing' && draft.pricing?.notes) {
    return `I'll keep “${draft.pricing.notes}” as the budget note.`
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
  return `I have enough to draft this for ${name}. Generate the proposal whenever you're ready.`
}

function summarizeParsed(draft) {
  const name = draft.client || draft.company
  const lead = []

  if (draft.projectType && name) {
    lead.push(`I'll draft a ${draft.projectType} proposal for ${name}`)
  } else if (name) {
    lead.push(`I'll draft this for ${name}`)
  } else if (draft.projectType) {
    lead.push(`I'll draft a ${draft.projectType} proposal`)
  } else {
    lead.push("I've captured those details")
  }

  if (draft.industry) {
    lead.push(`in ${draft.industry}`)
  }

  const details = []
  if (draft.deliverables.length > 0) {
    details.push(draft.deliverables.join(', '))
  }
  if (hasPricing(draft)) {
    details.push(
      `${draft.pricing.currency} ${draft.pricing.amount.toLocaleString('en-US')}`,
    )
  } else if (draft.pricing?.notes) {
    details.push(draft.pricing.notes)
  }
  if (draft.timeline) details.push(draft.timeline)
  if (draft.style) details.push(`${draft.style} in tone`)
  if (draft.terms) details.push(draft.terms)

  let text = lead.join(' ')
  if (details.length > 0) {
    text += ` — ${details.join(', ')}.`
  } else {
    text += '.'
  }

  return text
}

function composeReply(draft, filled, nextField, currentField) {
  if (filled.length === 0) {
    return `I still need that to draft the proposal. ${questionText(currentField)}`
  }

  const parts = []
  const stored = filled.filter((entry) => !entry.skipped)
  const skippedOnly = filled.length === 1 && filled[0].skipped

  if (skippedOnly) {
    parts.push('No problem — we can leave that blank for now.')
  } else if (stored.length > 1) {
    parts.push(summarizeParsed(draft))
  } else if (stored[0]) {
    parts.push(acknowledge(stored[0].field, draft))
  }

  if (nextField) {
    parts.push(questionText(nextField))
    return parts.join(' ')
  }

  if (stored.length > 1) {
    parts.push('Generate the proposal whenever you\'re ready.')
  } else {
    parts.push(wrapUp(draft))
  }

  return parts.join(' ')
}

function replaceLastUserWithAnswers(messages, displayValues) {
  const texts = displayValues.filter(Boolean)
  if (texts.length === 0) return messages

  let lastUser = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      lastUser = i
      break
    }
  }

  const head = lastUser >= 0 ? messages.slice(0, lastUser) : messages
  return [...head, ...texts.map((text) => user(text))]
}

export function createWizardSession() {
  return {
    draft: makeProposalDraft(),
    questionIndex: 0,
    pendingField: QUESTION_ORDER[0],
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
 * A single unlabelled chunk updates only the active field.
 * Labelled bulk input maps each label onto the matching ProposalDraft field
 * (labels are stripped). Unlabelled multi-line pastes fill remaining fields
 * in order. Either way, required fields being complete stops further questions.
 *
 * @param {{ draft: import('../models/proposalDraft.js').ProposalDraft, pendingField: string | null, questionIndex?: number, skippedFields?: string[], messages: object[] }} session
 * @param {string} userText
 * @param {{ includeUser?: boolean }} [options]
 */
export function replyToUser(session, userText, options = {}) {
  const text = userText.trim()
  if (!text) return session

  const index = currentIndex(session)

  if (index >= QUESTION_ORDER.length && requiredFieldsFilled(session.draft, session.skippedFields)) {
    const extras =
      options.includeUser === false
        ? [assistant("I've updated the draft with that. Generate the proposal whenever you're ready.")]
        : [
            user(text),
            assistant("I've updated the draft with that. Generate the proposal whenever you're ready."),
          ]

    return {
      ...session,
      draft: mergeProposalDraft(session.draft, {
        notes: [session.draft.notes, text].filter(Boolean).join('\n'),
      }),
      pendingField: null,
      questionIndex: QUESTION_ORDER.length,
      messages: [...session.messages, ...extras],
    }
  }

  const remaining = QUESTION_ORDER.slice(index)
  const labeled = parseLabeledAnswers(text)
  const skippedFields = [...(session.skippedFields ?? [])]
  let draft = session.draft
  const filled = []
  const displayValues = []

  if (looksLikeLabeledBulk(text, labeled) || (labeled.length === 1 && LABEL_AT_START.test(text.trim()))) {
    for (const pair of labeled) {
      const result = applyAnswer(draft, skippedFields, pair.field, pair.value)
      draft = result.draft
      if (!result.applied) continue
      filled.push({ field: pair.field, skipped: result.skipped })
      if (!result.skipped) displayValues.push(pair.value)
    }
  } else {
    const chunks = splitIntoAnswers(text).map((chunk) => {
      const stripped = stripLeadingLabel(chunk)
      return stripped.value || chunk
    })
    const answers =
      chunks.length > remaining.length
        ? [
            ...chunks.slice(0, remaining.length - 1),
            chunks.slice(remaining.length - 1).join('\n'),
          ]
        : chunks

    for (let offset = 0; offset < answers.length; offset += 1) {
      const field = remaining[offset]
      if (!field) break
      const chunk = answers[offset]
      const result = applyAnswer(draft, skippedFields, field, chunk)
      draft = result.draft
      if (!result.applied) {
        if (offset === 0) break
        break
      }
      filled.push({ field, skipped: result.skipped })
      if (!result.skipped) displayValues.push(chunk)
    }
  }

  const nextField = nextPendingField(draft, skippedFields)
  const nextIndex = nextField
    ? QUESTION_ORDER.indexOf(nextField)
    : QUESTION_ORDER.length
  const reply = composeReply(draft, filled, nextField, remaining[0] ?? QUESTION_ORDER[0])

  let messages = session.messages
  if (options.includeUser === false) {
    messages = replaceLastUserWithAnswers(messages, displayValues.length > 0 ? displayValues : [text])
    messages = [...messages, assistant(reply)]
  } else {
    messages = [
      ...messages,
      ...(displayValues.length > 0 ? displayValues : [text]).map((value) => user(value)),
      assistant(reply),
    ]
  }

  return {
    draft,
    questionIndex: nextIndex,
    pendingField: nextField,
    skippedFields,
    messages,
  }
}

export function wizardCanGenerate(session) {
  return isDraftReady(session.draft)
}

export { isDraftReady, suggestTitle }
