import { BLOCK_TYPE } from '../blocks/ids.js'
import { listEnabledBlocks } from '../blocks/instance.js'
import { UNRESOLVED_FACT } from '../generate/types.js'
import { PORTAL_STATUS } from './types.js'
import { presentPublicAccess } from './access.js'

const INTERNAL_KEYS = Object.freeze([
  'notes',
  'comments',
  'activity',
  'clientActivity',
  'versions',
  'currentVersion',
  'shareToken',
  'shareAccess',
  'generation',
  'approval',
  'signature',
  'payment',
  'analytics',
  'uploads',
  'uploadFolders',
  'questionnaire',
  'lastEmail',
  'health',
  'intelligence',
  'consistency',
  'coach',
  'improve',
  'tasks',
  'reviewerIds',
  'assigneeIds',
  'ownerId',
  'prompt',
  'prompts',
  'provider',
  'apiKey',
  'apiKeys',
  'knowledge',
  'knowledgeIds',
  'knowledgeIdsUsed',
])

function asText(value) {
  return value == null ? '' : String(value)
}

function headingOf(text) {
  return asText(text).trim().toLowerCase()
}

function isUnresolved(value) {
  return asText(value).trim() === UNRESOLVED_FACT
}

function enabledBlocks(proposal) {
  return listEnabledBlocks(proposal?.blocks ?? [])
}

function blockByType(proposal, type) {
  return enabledBlocks(proposal).filter((block) => block.type === type)
}

function sectionsFromProposal(proposal) {
  const fromBlocks = enabledBlocks(proposal)
    .filter(
      (block) =>
        block.type === BLOCK_TYPE.RICH_TEXT ||
        block.type === BLOCK_TYPE.EXECUTIVE_SUMMARY ||
        block.type === BLOCK_TYPE.COVER,
    )
    .map((block) => {
      if (block.type === BLOCK_TYPE.COVER) {
        return {
          heading: asText(block.data?.heading).trim() || 'Cover',
          body: [block.data?.kicker, block.data?.subheading].filter(Boolean).join('\n'),
        }
      }
      if (block.type === BLOCK_TYPE.EXECUTIVE_SUMMARY) {
        return {
          heading: 'Executive summary',
          body: asText(block.data?.body),
        }
      }
      return {
        heading: asText(block.data?.heading).trim() || 'Section',
        body: asText(block.data?.body),
      }
    })
    .filter((section) => section.body.trim() || section.heading)

  const fromLegacy = (Array.isArray(proposal?.sections) ? proposal.sections : [])
    .map((section) => ({
      heading: asText(section?.heading).trim() || 'Section',
      body: asText(section?.body),
    }))
    .filter((section) => section.body.trim() || section.heading)

  if (fromBlocks.length) return fromBlocks
  return fromLegacy
}

function namedSectionBody(proposal, names) {
  const wanted = names.map((name) => name.toLowerCase())
  for (const section of sectionsFromProposal(proposal)) {
    if (wanted.includes(headingOf(section.heading))) return asText(section.body)
  }
  return ''
}

function deliverablesFromProposal(proposal) {
  const fromBlocks = blockByType(proposal, BLOCK_TYPE.DELIVERABLES).flatMap((block) =>
    (block.data?.items ?? []).map((item) => ({
      title: asText(item.title),
      body: asText(item.body),
    })),
  )
  if (fromBlocks.length) return fromBlocks.filter((item) => item.title || item.body)

  const body = namedSectionBody(proposal, ['deliverables', 'scope'])
  if (body) return [{ title: 'Deliverables', body }]
  return []
}

function timelineFromProposal(proposal) {
  const fromBlocks = blockByType(proposal, BLOCK_TYPE.TIMELINE).flatMap((block) =>
    (block.data?.items ?? []).map((item) => ({
      title: asText(item.title),
      date: asText(item.date),
      body: asText(item.body),
    })),
  )
  if (fromBlocks.length) return fromBlocks.filter((item) => item.title || item.date || item.body)

  const body = namedSectionBody(proposal, ['timeline', 'schedule'])
  if (body) return [{ title: 'Timeline', date: '', body }]
  return []
}

function hasExplicitPricing(proposal) {
  const items = Array.isArray(proposal?.items) ? proposal.items : []
  if (items.length > 0) return true
  const pricingBlocks = blockByType(proposal, BLOCK_TYPE.PRICING)
  for (const block of pricingBlocks) {
    if ((block.data?.items ?? []).length > 0) return true
    if (asText(block.data?.notes).trim()) return true
  }
  if (Number(proposal?.amount) > 0) return true
  const named = namedSectionBody(proposal, ['pricing', 'investment', 'fees'])
  if (named) return true
  return false
}

function pricingFromProposal(proposal) {
  if (!hasExplicitPricing(proposal)) return null

  const pricingBlocks = blockByType(proposal, BLOCK_TYPE.PRICING)
  const blockItems = pricingBlocks.flatMap((block) => block.data?.items ?? [])
  const legacyItems = Array.isArray(proposal?.items) ? proposal.items : []
  const items = (blockItems.length ? blockItems : legacyItems).map((item) => ({
    description: asText(item.description ?? item.title),
    amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : null,
  }))

  const notes = pricingBlocks.map((block) => asText(block.data?.notes).trim()).filter(Boolean).join('\n')
  const named = namedSectionBody(proposal, ['pricing', 'investment', 'fees'])
  const amount = Number.isFinite(Number(proposal?.amount)) ? Number(proposal.amount) : null

  return {
    currency: asText(proposal?.currency).trim() || 'USD',
    amount,
    items,
    notes: notes || named,
    unresolved: isUnresolved(notes) || isUnresolved(named) || items.some((item) => isUnresolved(item.description)),
  }
}

function termsFromProposal(proposal) {
  const fromBlocks = blockByType(proposal, BLOCK_TYPE.TERMS)
    .map((block) => asText(block.data?.body).trim())
    .filter(Boolean)
  if (fromBlocks.length) return fromBlocks.join('\n\n')
  return asText(proposal?.terms)
}

function warrantyFromProposal(proposal) {
  return namedSectionBody(proposal, ['warranty', 'warranties', 'guarantee']) || ''
}

function exclusionsFromProposal(proposal) {
  return namedSectionBody(proposal, ['exclusions', 'out of scope', 'not included']) || ''
}

export function assertClientSafeView(view) {
  if (!view || view.kind !== 'client_portal_view') return false
  return INTERNAL_KEYS.every((key) => !(key in view))
}

/**
 * Client-safe projection. Built from scratch — never spreads the internal proposal.
 *
 * @param {object} proposal
 * @param {object} record portal record
 * @param {number | string} [now]
 */
export function presentClientPortalView(proposal, record, now = Date.now()) {
  const access = presentPublicAccess(record, now)
  const summary = asText(proposal?.summary)
  const view = {
    kind: 'client_portal_view',
    portalId: record?.id ?? '',
    proposalId: record?.proposalId ?? asText(proposal?.id),
    status: access?.status ?? PORTAL_STATUS.DRAFT,
    publishedAt: access?.publishedAt ?? null,
    expiresAt: access?.expiresAt ?? null,
    validUntil: proposal?.validUntil ?? null,
    title: asText(proposal?.title),
    clientName: asText(proposal?.clientName),
    company: asText(proposal?.company),
    projectType: asText(proposal?.projectType),
    summary,
    studioName: asText(proposal?.ownerName),
    currency: asText(proposal?.currency).trim() || 'USD',
    sections: sectionsFromProposal(proposal),
    deliverables: deliverablesFromProposal(proposal),
    timeline: timelineFromProposal(proposal),
    pricing: pricingFromProposal(proposal),
    exclusions: exclusionsFromProposal(proposal),
    warranty: warrantyFromProposal(proposal),
    terms: termsFromProposal(proposal),
  }

  return view
}

export function presentUnavailablePortal(reason, message) {
  return {
    kind: 'client_portal_unavailable',
    reason,
    message,
  }
}

export { INTERNAL_KEYS, UNRESOLVED_FACT }
