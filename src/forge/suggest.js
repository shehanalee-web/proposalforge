import { FOLLOWUP_REASON } from '../followup/types.js'
import { FOLLOWUP_REASON_ACTIONS, FOLLOWUP_REASON_LABELS } from '../followup/statuses.js'
import { FOLLOWUP_PRIORITY } from '../followup/types.js'
import { FORGE_ACTION } from './types.js'

/**
 * Deterministic next-action suggestion from a Forge living summary.
 * Prefers working an existing open follow-up over creating duplicates.
 */
export function suggestForgeNextAction(summary) {
  if (!summary?.available) {
    return {
      kind: 'forge_suggestion',
      action: null,
      code: 'unavailable',
      title: 'Forge summary unavailable',
      description: 'Proposal context is missing.',
      createFollowup: false,
      updateFollowupId: null,
      reason: null,
      priority: FOLLOWUP_PRIORITY.MEDIUM,
      draftMessage: '',
    }
  }

  const open = summary.followups?.open ?? []
  if (open.length) {
    const primary = open[0]
    return {
      kind: 'forge_suggestion',
      action: FORGE_ACTION.UPDATE_FOLLOWUP,
      code: 'work_existing_followup',
      title: primary.title || FOLLOWUP_REASON_ACTIONS[primary.reason] || 'Work existing follow-up',
      description: `An open follow-up already exists (${FOLLOWUP_REASON_LABELS[primary.reason] || primary.reason}). Continue that item instead of creating a duplicate.`,
      createFollowup: false,
      updateFollowupId: primary.id,
      reason: primary.reason,
      priority: FOLLOWUP_PRIORITY.HIGH,
      draftMessage: draftMessageFor(summary, primary.reason),
    }
  }

  if (summary.interactions?.changeRequestCount > 0) {
    return buildCreateSuggestion({
      code: 'respond_to_changes',
      reason: FOLLOWUP_REASON.CHANGES_REQUESTED,
      title: FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.CHANGES_REQUESTED],
      description: 'Client requested changes and there is no open follow-up. Respond and clarify next steps.',
      summary,
      priority: FOLLOWUP_PRIORITY.HIGH,
    })
  }

  if (summary.interactions?.questionCount > 0 || summary.interactions?.commentCount > 0) {
    return buildCreateSuggestion({
      code: 'respond_to_client',
      reason: FOLLOWUP_REASON.CLIENT_INTERACTION,
      title: FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.CLIENT_INTERACTION],
      description: 'Client left structured feedback and there is no open follow-up. Respond to the client.',
      summary,
      priority: FOLLOWUP_PRIORITY.HIGH,
    })
  }

  if (summary.selection?.hasSelection && !summary.accepted) {
    return buildCreateSuggestion({
      code: 'commercial_selection_followup',
      reason: FOLLOWUP_REASON.COMMERCIAL_SELECTION,
      title: FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.COMMERCIAL_SELECTION],
      description:
        summary.selection.description ||
        'Client made a commercial selection and has not accepted yet. Follow up on the choice.',
      summary,
      priority: FOLLOWUP_PRIORITY.HIGH,
    })
  }

  if (!summary.accepted && (summary.engagement?.opens > 0 || summary.status === 'sent')) {
    return buildCreateSuggestion({
      code: 'awaiting_response_followup',
      reason: FOLLOWUP_REASON.AWAITING_RESPONSE,
      title: FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.AWAITING_RESPONSE],
      description: 'Client has engaged with the proposal but has not accepted. Follow up with the client.',
      summary,
      priority: FOLLOWUP_PRIORITY.MEDIUM,
    })
  }

  if (!summary.accepted && summary.engagement?.opens === 0 && !summary.publication?.publishedAt) {
    return buildCreateSuggestion({
      code: 'never_opened_followup',
      reason: FOLLOWUP_REASON.NEVER_OPENED,
      title: FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.NEVER_OPENED],
      description: 'No living opens recorded yet. Confirm the client received the link.',
      summary,
      priority: FOLLOWUP_PRIORITY.MEDIUM,
    })
  }

  return {
    kind: 'forge_suggestion',
    action: null,
    code: 'no_action',
    title: 'No follow-up action needed',
    description: summary.accepted
      ? 'Proposal is accepted. Use existing handoff workflow if needed.'
      : 'No clear living or interaction signal requires a new follow-up.',
    createFollowup: false,
    updateFollowupId: null,
    reason: null,
    priority: FOLLOWUP_PRIORITY.LOW,
    draftMessage: '',
  }
}

function buildCreateSuggestion({ code, reason, title, description, summary, priority }) {
  return {
    kind: 'forge_suggestion',
    action: FORGE_ACTION.CREATE_FOLLOWUP,
    code,
    title,
    description,
    createFollowup: true,
    updateFollowupId: null,
    reason,
    priority,
    draftMessage: draftMessageFor(summary, reason),
  }
}

/**
 * Lightweight non-authoritative draft message for the studio.
 * Never sent automatically.
 */
export function draftFollowupMessage(summary, reason = null) {
  return draftMessageFor(summary, reason)
}

function draftMessageFor(summary, reason) {
  if (!summary?.available) return ''
  const client = summary.clientName || 'there'
  const title = summary.title || 'the proposal'

  if (reason === FOLLOWUP_REASON.CHANGES_REQUESTED) {
    const latest = summary.interactions?.latest?.message
    return `Hi ${client}, thanks for the change request on “${title}”.${
      latest ? ` I reviewed your note (“${latest}”) and ` : ' '
    }I’ll confirm the revised scope shortly.`
  }

  if (reason === FOLLOWUP_REASON.CLIENT_INTERACTION) {
    const latest = summary.interactions?.latest?.message
    return `Hi ${client}, thanks for your question on “${title}”.${
      latest ? ` Regarding “${latest}” — ` : ' '
    }happy to clarify anything you need before we proceed.`
  }

  if (reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION) {
    const choice = summary.selection?.description || 'your commercial selection'
    return `Hi ${client}, thanks for ${choice.replace(/^Client selected /i, 'selecting ')} on “${title}”. Want to walk through next steps or finalize acceptance?`
  }

  if (reason === FOLLOWUP_REASON.NEVER_OPENED) {
    return `Hi ${client}, just checking you received the proposal link for “${title}”. Happy to resend or walk through it live.`
  }

  return `Hi ${client}, following up on “${title}”. Let me know if you have any questions or if you’re ready to move forward.`
}
