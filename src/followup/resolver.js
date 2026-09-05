import { INTERACTION_STATUS, INTERACTION_TYPE } from '../interactions/types.js'
import { PROPOSAL_STATUS } from '../models/proposal.js'
import { PORTAL_STATUS } from '../portal/types.js'
import { overdueTasks } from '../workflow/tasks.js'
import { WORKFLOW_STATUS } from '../workflow/types.js'
import { FOLLOWUP_POLICY, addMs, clockOf, isValidityExpired, isValidityExpiring, parseTime } from './policy.js'
import { FOLLOWUP_REASON_META, followupSignalKey, reasonLabel } from './reasons.js'
import { FOLLOWUP_REASON, FOLLOWUP_SOURCE } from './types.js'

const CLIENT_INTERACTION_TYPES = new Set([
  INTERACTION_TYPE.COMMENT,
  INTERACTION_TYPE.CHANGE_REQUEST,
  INTERACTION_TYPE.QUESTION,
  INTERACTION_TYPE.APPROVAL,
])

const CLOSED_LOST = new Set([
  PROPOSAL_STATUS.DECLINED,
  PROPOSAL_STATUS.CANCELLED,
  PROPOSAL_STATUS.ARCHIVED,
])

function asList(value) {
  return Array.isArray(value) ? value : []
}

function sentAt(proposal, workflow) {
  return (
    proposal?.lastEmail?.sentAt ||
    (workflow?.status === WORKFLOW_STATUS.SENT || workflow?.status === WORKFLOW_STATUS.VIEWED
      ? workflow.updatedAt
      : null) ||
    (proposal?.status === PROPOSAL_STATUS.SENT ? proposal.updatedAt || proposal.createdAt : null)
  )
}

function viewedAt(proposal, workflow, portal) {
  const stamps = [proposal?.lastViewedAt, proposal?.analytics?.lastViewedAt]
  if (workflow?.status === WORKFLOW_STATUS.VIEWED) stamps.push(workflow.updatedAt)
  if (portal?.status === PORTAL_STATUS.PUBLISHED && portal.lastViewedAt) {
    stamps.push(portal.lastViewedAt)
  }
  const times = stamps.map((item) => parseTime(item)).filter((item) => Number.isFinite(item))
  if (!times.length) return null
  return new Date(Math.max(...times)).toISOString()
}

function acceptedAt(proposal, workflow) {
  if (proposal?.acceptedAt) return proposal.acceptedAt
  if (proposal?.status === PROPOSAL_STATUS.ACCEPTED) {
    return proposal.updatedAt || proposal.createdAt
  }
  if (workflow?.status === WORKFLOW_STATUS.ACCEPTED) return workflow.updatedAt
  return null
}

function isSent(proposal, workflow) {
  if (!proposal) return false
  if (proposal.status === PROPOSAL_STATUS.SENT) return true
  if (proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED) return true
  return (
    workflow?.status === WORKFLOW_STATUS.SENT ||
    workflow?.status === WORKFLOW_STATUS.VIEWED ||
    workflow?.status === WORKFLOW_STATUS.ACCEPTED
  )
}

function isAccepted(proposal, workflow) {
  return (
    proposal?.status === PROPOSAL_STATUS.ACCEPTED || workflow?.status === WORKFLOW_STATUS.ACCEPTED
  )
}

function isExpired(proposal, workflow, now) {
  if (proposal?.status === PROPOSAL_STATUS.EXPIRED || workflow?.status === WORKFLOW_STATUS.EXPIRED) {
    return true
  }
  return isValidityExpired(proposal?.validUntil, now)
}

function isClosedLost(proposal, workflow) {
  if (CLOSED_LOST.has(proposal?.status)) return true
  return workflow?.status === WORKFLOW_STATUS.REJECTED
}

function openClientInteractions(interactions) {
  return asList(interactions).filter(
    (item) =>
      item?.status === INTERACTION_STATUS.OPEN && CLIENT_INTERACTION_TYPES.has(item?.type),
  )
}

function hasNewerClientResponse({ proposal, interactions, viewed }, now) {
  const viewTime = parseTime(viewed)
  if (!Number.isFinite(viewTime)) return false
  if (proposal?.status === PROPOSAL_STATUS.REVISION_REQUESTED) return true
  if (proposal?.status === PROPOSAL_STATUS.ACCEPTED || proposal?.status === PROPOSAL_STATUS.DECLINED) {
    return true
  }
  const accepted = parseTime(proposal?.acceptedAt)
  if (Number.isFinite(accepted) && accepted > viewTime) return true
  return asList(interactions).some((item) => {
    const created = parseTime(item?.createdAt)
    return Number.isFinite(created) && created > viewTime && created <= clockOf(now)
  })
}

function signal(reason, extras = {}) {
  const meta = FOLLOWUP_REASON_META[reason]
  return {
    reason,
    title: extras.title || meta.title,
    description: extras.description || '',
    priority: extras.priority || meta.priority,
    sourceType: extras.sourceType || meta.sourceType,
    sourceId: extras.sourceId || '',
    dueAt: extras.dueAt || null,
    ownerActorId: extras.ownerActorId || '',
    signalKey: followupSignalKey(reason, extras.signalSourceId ?? extras.sourceId),
  }
}

/**
 * Deterministic follow-up signals. Same inputs always produce the same set.
 * Does not mutate proposal, workflow, portal, or interaction records.
 */
export function evaluateFollowupSignals({
  proposal,
  workflow = null,
  portal = null,
  interactions = [],
  now = Date.now(),
} = {}) {
  if (!proposal?.id) return []

  const ownerActorId = String(workflow?.ownerId ?? '').trim()
  const viewed = viewedAt(proposal, workflow, portal)
  const sent = sentAt(proposal, workflow)
  const accepted = acceptedAt(proposal, workflow)
  const expired = isExpired(proposal, workflow, now)
  const lost = isClosedLost(proposal, workflow)
  const acceptedNow = isAccepted(proposal, workflow)
  const sentNow = isSent(proposal, workflow)
  const clock = clockOf(now)
  const signals = []

  const openInteractions = openClientInteractions(interactions)
  if (openInteractions.length) {
    const latest = [...openInteractions].sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt)),
    )[0]
    const types = [...new Set(openInteractions.map((item) => item.type))]
    signals.push(
      signal(FOLLOWUP_REASON.CLIENT_INTERACTION, {
        ownerActorId,
        sourceId: latest.id,
        signalSourceId: '',
        dueAt: latest.createdAt || toDue(clock),
        description:
          openInteractions.length === 1
            ? `Open client ${types[0].replace('_', ' ')} needs a studio response.`
            : `${openInteractions.length} open client interactions need a studio response.`,
      }),
    )
  }

  if (
    workflow?.status === WORKFLOW_STATUS.CHANGES_REQUESTED ||
    proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED
  ) {
    signals.push(
      signal(FOLLOWUP_REASON.CHANGES_REQUESTED, {
        ownerActorId,
        sourceId: workflow?.id || proposal.id,
        signalSourceId: '',
        sourceType: FOLLOWUP_SOURCE.WORKFLOW,
        dueAt: workflow?.updatedAt || proposal.updatedAt || toDue(clock),
        description: 'Existing workflow state indicates changes requested.',
      }),
    )
  }

  for (const task of overdueTasks(workflow, now)) {
    signals.push(
      signal(FOLLOWUP_REASON.OVERDUE_TASK, {
        ownerActorId: task.assigneeId || ownerActorId,
        sourceId: task.id,
        dueAt: task.dueAt,
        title: task.title ? `Complete overdue task` : FOLLOWUP_REASON_META[FOLLOWUP_REASON.OVERDUE_TASK].title,
        description: task.title
          ? `Workflow task “${task.title}” is overdue.`
          : 'A workflow task is overdue and needs attention.',
      }),
    )
  }

  if (acceptedNow && !lost) {
    signals.push(
      signal(FOLLOWUP_REASON.ACCEPTED_NEXT_STEP, {
        ownerActorId,
        sourceId: proposal.id,
        signalSourceId: '',
        dueAt: addMs(accepted || clock, FOLLOWUP_POLICY.acceptedHandoffAfterMs),
        description: 'Proposal has been accepted. Complete the next operational handoff.',
      }),
    )
  }

  if (!lost && !expired && !acceptedNow && sentNow && proposal.validUntil && isValidityExpiring(proposal.validUntil, now)) {
    signals.push(
      signal(FOLLOWUP_REASON.EXPIRING, {
        ownerActorId,
        sourceId: proposal.id,
        signalSourceId: '',
        dueAt: toDue(parseTime(proposal.validUntil)),
        description: `Proposal validity is approaching expiry (${proposal.validUntil}).`,
      }),
    )
  }

  if (!lost && !expired && !acceptedNow && sentNow && !viewed) {
    const elapsed = parseTime(sent)
    if (Number.isFinite(elapsed) && clock - elapsed >= FOLLOWUP_POLICY.neverOpenedAfterMs) {
      signals.push(
        signal(FOLLOWUP_REASON.NEVER_OPENED, {
          ownerActorId,
          sourceId: proposal.id,
          signalSourceId: '',
          dueAt: addMs(sent, FOLLOWUP_POLICY.neverOpenedAfterMs),
          description: 'Proposal has been sent but there is no evidence of a portal or client view.',
        }),
      )
    }
  }

  if (!lost && !expired && !acceptedNow && sentNow && viewed) {
    const viewTime = parseTime(viewed)
    const quiet =
      Number.isFinite(viewTime) &&
      clock - viewTime >= FOLLOWUP_POLICY.awaitingResponseAfterMs &&
      !hasNewerClientResponse({ proposal, interactions, viewed }, now)
    if (quiet) {
      signals.push(
        signal(FOLLOWUP_REASON.AWAITING_RESPONSE, {
          ownerActorId,
          sourceId: proposal.id,
          signalSourceId: '',
          dueAt: addMs(viewed, FOLLOWUP_POLICY.awaitingResponseAfterMs),
          description: `Viewed with no newer client response (${reasonLabel(FOLLOWUP_REASON.AWAITING_RESPONSE)}).`,
        }),
      )
    }
  }

  return signals.sort((left, right) => {
    if (left.reason !== right.reason) return left.reason.localeCompare(right.reason)
    return String(left.sourceId).localeCompare(String(right.sourceId))
  })
}

function toDue(value) {
  const time = parseTime(value)
  if (!Number.isFinite(time)) return null
  return new Date(time).toISOString()
}

export { followupSignalKey }
