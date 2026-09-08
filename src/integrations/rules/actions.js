/**
 * H16.3 — Action dispatch through authoritative domain APIs only.
 *
 * Never opens domain stores directly. Never mutates CommercialClose,
 * decisions, proposals, or living selections.
 */

import { emitNotificationEvent } from '../../collaboration/notify.js'
import {
  assignFollowupOwner,
  completeFollowup,
  createManualFollowup,
  dismissFollowup,
  scheduleFollowup,
} from '../../followup/index.js'
import { NOTIFICATION_TYPE } from '../../models/notification.js'
import { getWorkflowActor, resolveWorkflowActor } from '../../workflow/actors.js'
import { readAutomationEventPath } from './schema.js'
import {
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_RULE_FAILURE_REASON,
} from './types.js'

function actionResult({
  ok,
  actionType,
  result = null,
  failureReason = null,
  detail = null,
}) {
  return Object.freeze({
    ok: Boolean(ok),
    actionType,
    result,
    failureReason,
    detail,
  })
}

/**
 * Resolve a param: literal scalar or { fromEvent: path }.
 *
 * @param {unknown} value
 * @param {object} event
 */
export function resolveAutomationActionParam(value, event) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.fromEvent) {
    return readAutomationEventPath(event, value.fromEvent)
  }
  return value
}

function resolveParams(params = {}, event) {
  const next = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    next[key] = resolveAutomationActionParam(value, event)
  }
  return next
}

/**
 * Resolve a studio actor for rule actions.
 *
 * Lookup is by id only — never pass rule.companyId into resolveWorkflowActor
 * (that would overwrite a foreign catalog actor's company). Unknown ids must
 * not fabricate a VIEWER/default actor; foreign company actors are rejected.
 *
 * @param {object} rule
 * @param {object} params
 * @param {object} event
 */
function resolveActor(rule, params, event) {
  const actorId =
    String(params.actorId ?? '').trim() ||
    String(rule.runAsActorId ?? '').trim() ||
    String(event?.correlation?.actorId ?? '').trim()
  if (!actorId) return null

  // Catalog membership required — reject fabricated / unknown ids.
  const known = getWorkflowActor(actorId)
  if (!known) return null
  if (known.companyId !== rule.companyId) return null

  const actor = resolveWorkflowActor({ id: actorId })
  if (!actor || actor.companyId !== rule.companyId) return null
  return actor
}

function compactFollowup(followup) {
  if (!followup) return null
  return Object.freeze({
    id: followup.id ?? null,
    status: followup.status ?? null,
    proposalId: followup.proposalId ?? null,
    title: followup.title ?? null,
    dueAt: followup.dueAt ?? null,
    ownerActorId: followup.ownerActorId ?? null,
  })
}

/**
 * @param {object} rule
 * @param {object} event
 * @param {object} action
 */
export function executeAutomationAction(rule, event, action = {}) {
  const type = String(action.type ?? '').trim()
  const params = resolveParams(action.params, event)

  if (type === AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO) {
    const notificationType =
      String(params.type ?? '').trim() || NOTIFICATION_TYPE.FOLLOWUP_DUE
    const title = String(params.title ?? '').trim() || 'Automation notice'
    const body = String(params.body ?? '').trim()
    const proposalId =
      params.proposalId ?? event.correlation?.proposalId ?? null
    try {
      const dispatched = emitNotificationEvent(notificationType, {
        title,
        body,
        proposalId,
        companyId: rule.companyId,
        source: 'automation_rule',
        ruleId: rule.id,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: Object.freeze({
          notificationId: dispatched.id,
          type: dispatched.type,
        }),
      })
    } catch (error) {
      return actionResult({
        ok: false,
        actionType: type,
        failureReason: AUTOMATION_RULE_FAILURE_REASON.ACTION_FAILED,
        detail: String(error?.message ?? 'notify_studio failed').slice(0, 200),
      })
    }
  }

  const actor = resolveActor(rule, params, event)
  if (!actor) {
    return actionResult({
      ok: false,
      actionType: type,
      failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_ACTOR,
    })
  }

  try {
    if (type === AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP) {
      const proposalId = String(
        params.proposalId ?? event.correlation?.proposalId ?? '',
      ).trim()
      if (!proposalId) {
        return actionResult({
          ok: false,
          actionType: type,
          failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_PARAM,
          detail: 'proposalId',
        })
      }
      const created = createManualFollowup({
        companyId: rule.companyId,
        proposalId,
        actor,
        title: params.title,
        description: params.description,
        dueAt: params.dueAt,
        ownerActorId: params.ownerActorId,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: compactFollowup(created),
      })
    }

    if (type === AUTOMATION_RULE_ACTION_TYPE.COMPLETE_FOLLOWUP) {
      const followupId = String(
        params.followupId ?? event.correlation?.followupId ?? '',
      ).trim()
      if (!followupId) {
        return actionResult({
          ok: false,
          actionType: type,
          failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_PARAM,
          detail: 'followupId',
        })
      }
      const completed = completeFollowup({
        companyId: rule.companyId,
        followupId,
        actor,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: compactFollowup(completed),
      })
    }

    if (type === AUTOMATION_RULE_ACTION_TYPE.DISMISS_FOLLOWUP) {
      const followupId = String(
        params.followupId ?? event.correlation?.followupId ?? '',
      ).trim()
      if (!followupId) {
        return actionResult({
          ok: false,
          actionType: type,
          failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_PARAM,
          detail: 'followupId',
        })
      }
      const dismissed = dismissFollowup({
        companyId: rule.companyId,
        followupId,
        actor,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: compactFollowup(dismissed),
      })
    }

    if (type === AUTOMATION_RULE_ACTION_TYPE.ASSIGN_FOLLOWUP) {
      const followupId = String(
        params.followupId ?? event.correlation?.followupId ?? '',
      ).trim()
      const ownerActorId = String(params.ownerActorId ?? '').trim()
      if (!followupId || !ownerActorId) {
        return actionResult({
          ok: false,
          actionType: type,
          failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_PARAM,
          detail: 'followupId/ownerActorId',
        })
      }
      const assigned = assignFollowupOwner({
        companyId: rule.companyId,
        followupId,
        actor,
        ownerActorId,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: compactFollowup(assigned),
      })
    }

    if (type === AUTOMATION_RULE_ACTION_TYPE.SCHEDULE_FOLLOWUP) {
      const followupId = String(
        params.followupId ?? event.correlation?.followupId ?? '',
      ).trim()
      const dueAt = params.dueAt
      if (!followupId || !dueAt) {
        return actionResult({
          ok: false,
          actionType: type,
          failureReason: AUTOMATION_RULE_FAILURE_REASON.MISSING_PARAM,
          detail: 'followupId/dueAt',
        })
      }
      const scheduled = scheduleFollowup({
        companyId: rule.companyId,
        followupId,
        actor,
        dueAt,
      })
      return actionResult({
        ok: true,
        actionType: type,
        result: compactFollowup(scheduled),
      })
    }

    return actionResult({
      ok: false,
      actionType: type || 'unknown',
      failureReason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_ACTION,
    })
  } catch (error) {
    return actionResult({
      ok: false,
      actionType: type,
      failureReason: AUTOMATION_RULE_FAILURE_REASON.ACTION_FAILED,
      detail: String(error?.message ?? 'action failed').slice(0, 200),
    })
  }
}
