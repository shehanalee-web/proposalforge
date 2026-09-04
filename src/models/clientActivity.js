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
  EDITED: 'edited',
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
  DOWNLOADED: 'downloaded',
  SIGNATURE_REQUESTED: 'signature_requested',
  SIGNED: 'signed',
  PAYMENT_COMPLETED: 'payment_completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
})

export const CLIENT_ACTIVITY_TYPES = Object.freeze(
  Object.values(CLIENT_ACTIVITY_TYPE),
)

export const CLIENT_ACTIVITY_LABELS = Object.freeze({
  [CLIENT_ACTIVITY_TYPE.PREPARED]: 'Created',
  [CLIENT_ACTIVITY_TYPE.EDITED]: 'Edited',
  [CLIENT_ACTIVITY_TYPE.SENT]: 'Sent',
  [CLIENT_ACTIVITY_TYPE.VIEWED]: 'Viewed',
  [CLIENT_ACTIVITY_TYPE.ACCEPTED]: 'Accepted',
  [CLIENT_ACTIVITY_TYPE.DECLINED]: 'Declined',
  [CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED]: 'Changes requested',
  [CLIENT_ACTIVITY_TYPE.COMMENTED]: 'Comment added',
  [CLIENT_ACTIVITY_TYPE.REPLIED]: 'Reply added',
  [CLIENT_ACTIVITY_TYPE.FILE_UPLOADED]: 'File uploaded',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED]: 'Questionnaire started',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED]: 'Questionnaire submitted',
  [CLIENT_ACTIVITY_TYPE.APPROVED]: 'Approved',
  [CLIENT_ACTIVITY_TYPE.DOWNLOADED]: 'Downloaded',
  [CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED]: 'Signature requested',
  [CLIENT_ACTIVITY_TYPE.SIGNED]: 'Signed',
  [CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED]: 'Payment received',
  [CLIENT_ACTIVITY_TYPE.EXPIRED]: 'Expired',
  [CLIENT_ACTIVITY_TYPE.CANCELLED]: 'Cancelled',
  [CLIENT_ACTIVITY_TYPE.ARCHIVED]: 'Archived',
})

export const CLIENT_ACTIVITY_ICON = Object.freeze({
  [CLIENT_ACTIVITY_TYPE.PREPARED]: 'activityCreated',
  [CLIENT_ACTIVITY_TYPE.EDITED]: 'activityEdited',
  [CLIENT_ACTIVITY_TYPE.SENT]: 'activityEmail',
  [CLIENT_ACTIVITY_TYPE.VIEWED]: 'activityViewed',
  [CLIENT_ACTIVITY_TYPE.ACCEPTED]: 'activityAccepted',
  [CLIENT_ACTIVITY_TYPE.DECLINED]: 'activityDeclined',
  [CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED]: 'activityEdited',
  [CLIENT_ACTIVITY_TYPE.COMMENTED]: 'message',
  [CLIENT_ACTIVITY_TYPE.REPLIED]: 'message',
  [CLIENT_ACTIVITY_TYPE.FILE_UPLOADED]: 'upload',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED]: 'clipboard',
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED]: 'clipboard',
  [CLIENT_ACTIVITY_TYPE.APPROVED]: 'activityAccepted',
  [CLIENT_ACTIVITY_TYPE.DOWNLOADED]: 'activityDownloaded',
  [CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED]: 'pen',
  [CLIENT_ACTIVITY_TYPE.SIGNED]: 'pen',
  [CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED]: 'card',
  [CLIENT_ACTIVITY_TYPE.EXPIRED]: 'clock',
  [CLIENT_ACTIVITY_TYPE.CANCELLED]: 'activityDeclined',
  [CLIENT_ACTIVITY_TYPE.ARCHIVED]: 'activityArchived',
})

export const ACTIVITY_AUDIENCE = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

const DERIVED_ONCE = Object.freeze([
  CLIENT_ACTIVITY_TYPE.PREPARED,
  CLIENT_ACTIVITY_TYPE.EDITED,
  CLIENT_ACTIVITY_TYPE.SENT,
  CLIENT_ACTIVITY_TYPE.VIEWED,
  CLIENT_ACTIVITY_TYPE.ACCEPTED,
  CLIENT_ACTIVITY_TYPE.DECLINED,
  CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED,
  CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED,
  CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED,
  CLIENT_ACTIVITY_TYPE.EXPIRED,
  CLIENT_ACTIVITY_TYPE.CANCELLED,
  CLIENT_ACTIVITY_TYPE.ARCHIVED,
  CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED,
  CLIENT_ACTIVITY_TYPE.SIGNED,
  CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED,
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
    detail: proposal.title ? `“${proposal.title}” was created.` : '',
  })

  if (proposal.updatedAt && proposal.updatedAt !== proposal.createdAt) {
    addDerived(CLIENT_ACTIVITY_TYPE.EDITED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.STUDIO,
      detail: 'Proposal content was updated.',
    })
  }

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
    detail: 'Viewed from the client link.',
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

  if (proposal.status === PROPOSAL_STATUS.EXPIRED) {
    addDerived(CLIENT_ACTIVITY_TYPE.EXPIRED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.STUDIO,
      detail: 'The proposal expired.',
    })
  }

  if (proposal.status === PROPOSAL_STATUS.CANCELLED) {
    addDerived(CLIENT_ACTIVITY_TYPE.CANCELLED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.STUDIO,
      detail: 'The studio cancelled this proposal.',
    })
  }

  if (proposal.status === PROPOSAL_STATUS.ARCHIVED) {
    addDerived(CLIENT_ACTIVITY_TYPE.ARCHIVED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.STUDIO,
      detail: 'The proposal was archived.',
    })
  }

  if (proposal.signature?.status === 'waiting' || proposal.signature?.requestedAt) {
    addDerived(
      CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED,
      proposal.signature.requestedAt || proposal.updatedAt,
      {
        actor: PORTAL_ACTOR.STUDIO,
        detail: proposal.signature.signer
          ? `Signature requested from ${proposal.signature.signer}.`
          : 'Signature requested.',
      },
    )
  }

  if (proposal.signature?.status === 'signed') {
    addDerived(
      CLIENT_ACTIVITY_TYPE.SIGNED,
      proposal.signature.signedAt || proposal.updatedAt,
      {
        actor: PORTAL_ACTOR.CLIENT,
        detail: 'The proposal was signed.',
      },
    )
  }

  if (proposal.payment?.status === 'paid') {
    addDerived(CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED, proposal.updatedAt, {
      actor: PORTAL_ACTOR.CLIENT,
      detail: 'Payment was recorded.',
    })
  }

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
