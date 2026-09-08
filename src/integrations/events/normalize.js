/**
 * H16.2 — Domain emission → AutomationEvent normalization.
 *
 * Reads domain facts; never mutates them. Provider webhook payloads rejected.
 */

import {
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_SOURCE_DOMAIN,
} from './types.js'
import {
  makeAutomationEvent,
  makeAutomationIdempotencyKey,
  sanitizeAutomationPayload,
} from './schema.js'
import { findLivingEngagementEventById } from '../../living/eventStore.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

function reject(reason, detail = {}) {
  return {
    ok: false,
    status: AUTOMATION_INTAKE_STATUS.REJECTED,
    reason,
    event: null,
    detail,
  }
}

function ignore(reason, detail = {}) {
  return {
    ok: false,
    status: AUTOMATION_INTAKE_STATUS.IGNORED,
    reason,
    event: null,
    detail,
  }
}

function acceptDraft(draft) {
  try {
    const event = makeAutomationEvent({
      ...draft,
      intake: {
        status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
        reason: null,
      },
    })
    return {
      ok: true,
      status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
      reason: null,
      event,
    }
  } catch (error) {
    return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT, {
      message: error?.message || 'Malformed automation event.',
    })
  }
}

function livingTypeToAutomationType(type) {
  const raw = asString(type).trim()
  if (!raw) return null
  if (raw.includes('.')) return `living.${raw}`
  return `living.${raw}`
}

function normalizeLiving(input = {}) {
  const bus = input.busEvent && typeof input.busEvent === 'object' ? input.busEvent : input
  const payload =
    bus.payload && typeof bus.payload === 'object' ? bus.payload : bus
  const type = asString(bus.type || input.type).trim()
  if (!type) return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)

  const livingEventId =
    asOptionalId(payload.eventId) ||
    asOptionalId(payload.id) ||
    asOptionalId(bus.eventId) ||
    asOptionalId(input.sourceEventId)

  if (!livingEventId) {
    return reject(AUTOMATION_INTAKE_REASON.MISSING_SOURCE_IDENTITY, {
      message: 'Living intake requires persisted living event id.',
    })
  }

  const stored = findLivingEngagementEventById(livingEventId)
  const meta =
    stored?.metadata && typeof stored.metadata === 'object' ? stored.metadata : {}

  // Prefer server-persisted living event companyId over any caller claim.
  const companyId =
    asOptionalId(stored?.companyId) ||
    asOptionalId(input.companyId) ||
    asOptionalId(payload.companyId) ||
    asOptionalId(bus.companyId)
  if (!companyId) return reject(AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED)

  const automationType = livingTypeToAutomationType(type)
  const closeId =
    asOptionalId(payload.closeId) || asOptionalId(meta.closeId)
  const entityType = closeId ? 'commercial_close' : 'living_event'
  const entityId =
    closeId ||
    asOptionalId(stored?.proposalId) ||
    asOptionalId(payload.proposalId) ||
    livingEventId

  return acceptDraft({
    type: automationType,
    companyId,
    occurredAt: stored?.at || bus.at || payload.at || input.occurredAt,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.LIVING,
      entityType,
      entityId,
      eventId: livingEventId,
    },
    correlation: {
      proposalId:
        asOptionalId(stored?.proposalId) ||
        asOptionalId(bus.proposalId) ||
        asOptionalId(payload.proposalId),
      sessionId:
        asOptionalId(stored?.sessionId) || asOptionalId(payload.sessionId),
      closeId,
      followupId: null,
      shareToken:
        asOptionalId(stored?.shareToken) ||
        asOptionalId(bus.shareToken) ||
        asOptionalId(payload.shareToken),
      actorId: asOptionalId(payload.actorId) || asOptionalId(meta.actorId),
    },
    sourceEventIdentity: livingEventId,
    payload: sanitizeAutomationPayload({
      livingType: type,
      blockId:
        asOptionalId(stored?.blockId) ||
        asOptionalId(bus.blockId) ||
        asOptionalId(payload.blockId),
      offerId: asOptionalId(stored?.offerId) || asOptionalId(payload.offerId),
      from: asOptionalId(payload.from) || asOptionalId(meta.from),
      to: asOptionalId(payload.to) || asOptionalId(meta.to),
      method: asOptionalId(payload.method) || asOptionalId(meta.method),
      requestId: asOptionalId(payload.requestId) || asOptionalId(meta.requestId),
      source: asOptionalId(payload.source) || asOptionalId(meta.source),
    }),
  })
}

function normalizeFollowup(input = {}) {
  const raw = input.rawEvent && typeof input.rawEvent === 'object' ? input.rawEvent : input
  const type = asString(raw.type || input.type).trim()
  if (!type) return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)

  const companyId =
    asOptionalId(input.companyId) || asOptionalId(raw.companyId)
  if (!companyId) return reject(AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED)

  const followupId = asOptionalId(raw.followupId) || asOptionalId(raw.id)
  const proposalId = asOptionalId(raw.proposalId)
  const sourceEventIdentity =
    asOptionalId(raw.eventId) ||
    (followupId ? `${type}:${followupId}` : null) ||
    (proposalId ? `${type}:proposal:${proposalId}` : null)

  if (!sourceEventIdentity) {
    return reject(AUTOMATION_INTAKE_REASON.MISSING_SOURCE_IDENTITY)
  }

  const automationType = type.startsWith('followup.')
    ? type
    : `followup.${type.replace(/^followup\./, '')}`

  return acceptDraft({
    type: automationType,
    companyId,
    occurredAt: raw.at || raw.createdAt || input.occurredAt,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.FOLLOWUP,
      entityType: 'followup',
      entityId: followupId || proposalId,
      eventId: asOptionalId(raw.eventId),
    },
    correlation: {
      proposalId,
      sessionId: null,
      closeId: asOptionalId(raw.closeId),
      followupId,
      shareToken: null,
      actorId: asOptionalId(raw.actorId) || asOptionalId(raw.ownerActorId),
    },
    sourceEventIdentity,
    payload: sanitizeAutomationPayload({
      followupType: type,
      title: asString(raw.title).trim().slice(0, 200) || null,
      reason: asOptionalId(raw.reason),
      signalKey: asOptionalId(raw.signalKey),
    }),
  })
}

function normalizeWorkflow(input = {}) {
  const raw = input.rawEvent && typeof input.rawEvent === 'object' ? input.rawEvent : input
  const type = asString(raw.type || input.type).trim()
  if (!type) return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)

  const companyId =
    asOptionalId(input.companyId) || asOptionalId(raw.companyId)
  if (!companyId) return reject(AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED)

  const eventId = asOptionalId(raw.id) || asOptionalId(raw.eventId)
  if (!eventId) return reject(AUTOMATION_INTAKE_REASON.MISSING_SOURCE_IDENTITY)

  const automationType = type.startsWith('workflow.')
    ? type
    : `workflow.${type.replace(/^workflow\./, '')}`

  return acceptDraft({
    type: automationType,
    companyId,
    occurredAt: raw.createdAt || raw.at || input.occurredAt,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.WORKFLOW,
      entityType: 'workflow',
      entityId:
        asOptionalId(raw.workflowId) ||
        asOptionalId(raw.proposalId) ||
        eventId,
      eventId,
    },
    correlation: {
      proposalId: asOptionalId(raw.proposalId),
      sessionId: null,
      closeId: null,
      followupId: null,
      shareToken: null,
      actorId: asOptionalId(raw.actorId),
    },
    sourceEventIdentity: eventId,
    payload: sanitizeAutomationPayload({
      workflowType: type,
      from: asOptionalId(raw.from),
      to: asOptionalId(raw.to),
    }),
  })
}

function normalizePortal(input = {}) {
  const raw = input.rawEvent && typeof input.rawEvent === 'object' ? input.rawEvent : input
  const type = asString(raw.type || input.type).trim()
  if (!type) return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)

  const companyId =
    asOptionalId(input.companyId) || asOptionalId(raw.companyId)
  if (!companyId) return reject(AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED)

  const eventId = asOptionalId(raw.id) || asOptionalId(raw.eventId)
  const portalId = asOptionalId(raw.portalId) || asOptionalId(raw.id)
  const proposalId = asOptionalId(raw.proposalId)
  const sourceEventIdentity =
    eventId ||
    (portalId ? `${type}:${portalId}` : null) ||
    (proposalId ? `${type}:proposal:${proposalId}` : null)

  if (!sourceEventIdentity) {
    return reject(AUTOMATION_INTAKE_REASON.MISSING_SOURCE_IDENTITY)
  }

  const automationType = type.startsWith('portal.')
    ? type
    : `portal.${type.replace(/^portal\./, '')}`

  return acceptDraft({
    type: automationType,
    companyId,
    occurredAt: raw.createdAt || raw.at || input.occurredAt,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.PORTAL,
      entityType: 'portal',
      entityId: portalId || proposalId,
      eventId: eventId,
    },
    correlation: {
      proposalId,
      sessionId: null,
      closeId: null,
      followupId: null,
      shareToken: asOptionalId(raw.shareToken),
      actorId: asOptionalId(raw.actorId),
    },
    sourceEventIdentity,
    payload: sanitizeAutomationPayload({
      portalType: type,
    }),
  })
}

function normalizeInteraction(input = {}) {
  const raw = input.rawEvent && typeof input.rawEvent === 'object' ? input.rawEvent : input
  const type = asString(raw.type || input.type).trim()
  if (!type) return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)

  // Engagement mirrors (comment_added etc.) are canonical on living.
  // If an interaction emission incorrectly uses a living engagement type, ignore.
  if (
    type === 'comment_added' ||
    type === 'change_requested' ||
    type === 'question_answered' ||
    type.startsWith('living.')
  ) {
    return ignore(AUTOMATION_INTAKE_REASON.CANONICAL_SOURCE_ELSEWHERE, {
      canonical: AUTOMATION_SOURCE_DOMAIN.LIVING,
    })
  }

  const companyId =
    asOptionalId(input.companyId) || asOptionalId(raw.companyId)
  if (!companyId) return reject(AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED)

  const interactionId =
    asOptionalId(raw.interactionId) || asOptionalId(raw.id)
  const eventId = asOptionalId(raw.eventId) || asOptionalId(raw.activityId)
  const sourceEventIdentity =
    eventId ||
    (interactionId ? `${type}:${interactionId}` : null)

  if (!sourceEventIdentity) {
    return reject(AUTOMATION_INTAKE_REASON.MISSING_SOURCE_IDENTITY)
  }

  const automationType = type.startsWith('interaction.')
    ? type
    : `interaction.${type.replace(/^interaction\./, '')}`

  return acceptDraft({
    type: automationType,
    companyId,
    occurredAt: raw.createdAt || raw.at || input.occurredAt,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.INTERACTION,
      entityType: 'interaction',
      entityId: interactionId,
      eventId: eventId,
    },
    correlation: {
      proposalId: asOptionalId(raw.proposalId),
      sessionId: asOptionalId(raw.sessionId),
      closeId: null,
      followupId: null,
      shareToken: asOptionalId(raw.shareToken),
      actorId: asOptionalId(raw.actorId),
    },
    sourceEventIdentity,
    payload: sanitizeAutomationPayload({
      interactionType: type,
      kind: asOptionalId(raw.kind),
    }),
  })
}

/**
 * Normalize a domain emission into an AutomationEvent draft result.
 *
 * @param {object} input
 */
export function normalizeDomainEvent(input = {}) {
  if (input == null || typeof input !== 'object') {
    return reject(AUTOMATION_INTAKE_REASON.MALFORMED_EVENT)
  }

  const domain = asString(
    input.sourceDomain || input.domain || input.source?.domain,
  ).trim()

  // Raw H15.6 provider ingress is never authoritative for H16 intake.
  if (
    domain === 'provider' ||
    domain === 'provider_webhook' ||
    input.providerPayload != null ||
    input.rawVerified != null ||
    (input.providerEventId != null && input.rawBody != null)
  ) {
    return reject(AUTOMATION_INTAKE_REASON.PROVIDER_WEBHOOK_FORBIDDEN)
  }

  if (!domain) return reject(AUTOMATION_INTAKE_REASON.UNSUPPORTED_DOMAIN)

  switch (domain) {
    case AUTOMATION_SOURCE_DOMAIN.LIVING:
      return normalizeLiving(input)
    case AUTOMATION_SOURCE_DOMAIN.FOLLOWUP:
      return normalizeFollowup(input)
    case AUTOMATION_SOURCE_DOMAIN.WORKFLOW:
      return normalizeWorkflow(input)
    case AUTOMATION_SOURCE_DOMAIN.PORTAL:
      return normalizePortal(input)
    case AUTOMATION_SOURCE_DOMAIN.INTERACTION:
      return normalizeInteraction(input)
    case AUTOMATION_SOURCE_DOMAIN.ACTIVITY:
      return ignore(AUTOMATION_INTAKE_REASON.CANONICAL_SOURCE_ELSEWHERE, {
        message: 'Studio activity intake deferred; living/domain events are canonical.',
      })
    case AUTOMATION_SOURCE_DOMAIN.COMMERCIAL_CLOSE:
      // Close facts arrive via living close.* audit events, not a parallel close bus.
      return ignore(AUTOMATION_INTAKE_REASON.CANONICAL_SOURCE_ELSEWHERE, {
        canonical: AUTOMATION_SOURCE_DOMAIN.LIVING,
      })
    case 'provider':
    case 'provider_webhook':
      return reject(AUTOMATION_INTAKE_REASON.PROVIDER_WEBHOOK_FORBIDDEN)
    default:
      return reject(AUTOMATION_INTAKE_REASON.UNSUPPORTED_DOMAIN)
  }
}

export { makeAutomationIdempotencyKey }
