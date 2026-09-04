import { createRecordId } from './ids.js'
import { COMMENT_VISIBILITY } from './comment.js'
import { PORTAL_ACTOR } from './portalPermissions.js'
import { PROPOSAL_STATUS } from './proposal.js'
import { QUESTIONNAIRE_STATUS } from './questionnaire.js'

/**
 * Proposal activity timeline.
 *
 * Stored `activity` entries are the source of truth. Derived events fill
 * gaps on older records that predate this log. Future signature and payment
 * milestones append the same shape.
 */

export const CLIENT_ACTIVITY_TYPE = Object.freeze({
  PREPARED: 'prepared',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVISION_REQUESTED: 'revision_requested',
  COMMENTED: 'commented',
  REPLIED: 'replied',
  FILE_UPLOADED: 'file_uploaded',
  QUESTIONNAIRE_STARTED: 'questionnaire_started',
  QUESTIONNAIRE_SUBMITTED: 'questionnaire_submitted',
  APPROVED: 'approved',
  SIGNED: 'signed',
  PAYMENT_COMPLETED: 'payment_completed',
})

export const CLIENT_ACTIVITY_TYPES = Object.freeze(
  Object.values(CLIENT_ACTIVITY_TYPE),
)

export const CLIENT_ACTIVITY_LABELS = Object.freeze({
  [CLIENT_ACTIVITY_TYPE.PREPARED]: 'Proposal prepared',
  [CLIENT_ACTIVITY_TYPE.SENT]: 'Sent to client',
  [CLIENT_ACTIVITY_TYPE.VIEWED]: 'Opened',
  [CLIENT_ACTIVITY_TYPE.ACCEPTED]: 'Accepted',
  [CLIENT_ACTIVITY_TYPE.DECLINED]: 'Declined',
  [CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED]: 'Changes requested',
  [CLIENT_ACTIVITY_TYPE.COMMENTED]: 'Comment added',
  [CLIENT_ACTIVITY_TYPE.REPLIED]: 'Reply added',
  [CLIENT_ACTIVITY_TYPE.FILE_UPLOADED]: 'File uploaded',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED]: 'Questionnaire started',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED]: 'Questionnaire submitted',
  [CLIENT_ACTIVITY_TYPE.APPROVED]: 'Approved',
  [CLIENT_ACTIVITY_TYPE.SIGNED]: 'Signed',
  [CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED]: 'Payment completed',
})

export const ACTIVITY_AUDIENCE = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

const DERIVED_ONCE = Object.freeze([
  CLIENT_ACTIVITY_TYPE.PREPARED,
  CLIENT_ACTIVITY_TYPE.SENT,
  CLIENT_ACTIVITY_TYPE.VIEWED,
  CLIENT_ACTIVITY_TYPE.ACCEPTED,
  CLIENT_ACTIVITY_TYPE.DECLINED,
  CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED,
  CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED,
  CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED,
])

/**
 * @typedef {object} ProposalActivity
 * @property {string} id
 * @property {string | null} proposalId
 * @property {string} type
 * @property {string} actor
 * @property {object} metadata
 * @property {string} createdAt
 */

/**
 * @typedef {ProposalActivity & {
 *   at: string
 *   meta: object
 *   label: string
 *   detail: string
 *   derived: boolean
 * }} ClientActivityEvent
 */

/**
 * @param {Partial<ClientActivityEvent> & { at?: string, meta?: object }} [input]
 * @returns {ClientActivityEvent}
 */
export function makeActivityEvent(input = {}) {
  const type = CLIENT_ACTIVITY_TYPES.includes(input.type)
    ? input.type
    : CLIENT_ACTIVITY_TYPE.VIEWED
  const createdAt = input.createdAt ?? input.at ?? new Date().toISOString()
  const metadata = { ...(input.metadata ?? input.meta ?? {}) }
  const detail = input.detail ?? metadata.detail ?? ''
  if (detail && metadata.detail == null) metadata.detail = detail

  return {
    id: input.id ?? createRecordId('act'),
    proposalId: input.proposalId ?? null,
    type,
    actor: input.actor ?? PORTAL_ACTOR.CLIENT,
    metadata,
    createdAt,
    at: createdAt,
    meta: metadata,
    label: input.label ?? CLIENT_ACTIVITY_LABELS[type] ?? 'Update',
    detail,
    derived: Boolean(input.derived),
  }
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @param {string} type
 * @returns {boolean}
 */
export function hasActivityType(proposal, type) {
  return (proposal?.activity ?? []).some((event) => event.type === type)
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @param {Partial<ClientActivityEvent>} input
 * @returns {ClientActivityEvent[]}
 */
export function appendActivity(proposal, input) {
  const event = makeActivityEvent({
    ...input,
    proposalId: proposal?.id ?? input.proposalId ?? null,
    derived: false,
  })
  return [...(proposal?.activity ?? []), event]
}

/**
 * @param {ClientActivityEvent | ProposalActivity | null | undefined} event
 * @returns {boolean}
 */
export function isActivityVisibleToClient(event) {
  if (!event) return false
  const visibility = event.metadata?.visibility ?? event.meta?.visibility
  return visibility !== COMMENT_VISIBILITY.INTERNAL
}

function pushDerived(events, type, at, extra = {}) {
  if (!at) return
  events.push(
    makeActivityEvent({
      id: `derived-${type}`,
      type,
      at,
      derived: true,
      ...extra,
    }),
  )
}

/**
 * Build the timeline used by the portal, comments panel, and studio.
 *
 * Stored events win. Derived events cover legacy records that never wrote a
 * log. Pass `audience: 'client'` to hide internal-only rows.
 *
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @param {{ audience?: string }} [options]
 * @returns {ClientActivityEvent[]}
 */
export function buildProposalTimeline(proposal, options = {}) {
  if (!proposal) return []

  const stored = []
  if (Array.isArray(proposal.activity)) {
    stored.push(...proposal.activity.map((item) => makeActivityEvent(item)))
  }
  if (Array.isArray(proposal.clientActivity)) {
    stored.push(
      ...proposal.clientActivity.map((item) => makeActivityEvent(item)),
    )
  }

  const storedTypes = new Set(stored.map((event) => event.type))
  const derived = []

  function addDerived(type, at, extra) {
    if (DERIVED_ONCE.includes(type) && storedTypes.has(type)) return
    pushDerived(derived, type, at, extra)
  }

  addDerived(CLIENT_ACTIVITY_TYPE.PREPARED, proposal.createdAt, {
    actor: PORTAL_ACTOR.STUDIO,
    detail: proposal.title ? `“${proposal.title}” was prepared.` : '',
  })

  if (proposal.status !== PROPOSAL_STATUS.DRAFT) {
    addDerived(
      CLIENT_ACTIVITY_TYPE.SENT,
      proposal.updatedAt ?? proposal.createdAt,
      {
        actor: PORTAL_ACTOR.STUDIO,
        detail: proposal.clientName
          ? `Shared with ${proposal.clientName}.`
          : 'Shared with the client.',
      },
    )
  }

  addDerived(CLIENT_ACTIVITY_TYPE.VIEWED, proposal.lastViewedAt, {
    actor: PORTAL_ACTOR.CLIENT,
    detail: 'Opened from the client link.',
  })

  if (proposal.status === PROPOSAL_STATUS.ACCEPTED) {
    addDerived(
      CLIENT_ACTIVITY_TYPE.ACCEPTED,
      proposal.acceptedAt ?? proposal.updatedAt,
      {
        actor: PORTAL_ACTOR.CLIENT,
        detail: 'The proposal was accepted.',
      },
    )
  }

  if (proposal.status === PROPOSAL_STATUS.DECLINED) {
    addDerived(CLIENT_ACTIVITY_TYPE.DECLINED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.CLIENT,
      detail: 'The proposal was declined.',
    })
  }

  if (proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED) {
    addDerived(
      CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED,
      proposal.updatedAt,
      {
        actor: PORTAL_ACTOR.CLIENT,
        detail: proposal.clientFeedback?.trim() || 'Changes were requested.',
      },
    )
  }

  addDerived(
    CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED,
    proposal.questionnaire &&
      proposal.questionnaire.status !== QUESTIONNAIRE_STATUS.DRAFT
      ? proposal.questionnaire.updatedAt
      : null,
    {
      actor: PORTAL_ACTOR.CLIENT,
      detail: 'Discovery questionnaire started.',
    },
  )

  addDerived(
    CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED,
    proposal.questionnaire?.submittedAt,
    {
      actor: PORTAL_ACTOR.CLIENT,
      detail: 'Discovery questionnaire submitted.',
    },
  )

  let merged = [...stored, ...derived]
  if (options.audience === ACTIVITY_AUDIENCE.CLIENT) {
    merged = merged.filter(isActivityVisibleToClient)
  }

  merged.sort((a, b) => String(b.at).localeCompare(String(a.at)))

  const seen = new Set()
  return merged.filter((event) => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}
