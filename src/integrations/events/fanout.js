/**
 * H16.2 — Best-effort fan-out from domain emit stubs into automation intake.
 *
 * Domain modules may import this file. This module must not import domain
 * repositories (avoids cycles / ownership inversion).
 */

import { INTEGRATION_CAPABILITIES } from '../types.js'
import { AUTOMATION_SOURCE_DOMAIN } from './types.js'
import { ingestAutomationEvent } from './intake.js'

/**
 * @param {string} sourceDomain
 * @param {object} rawEvent
 * @param {object} [extras]
 */
export function fanoutDomainEmission(sourceDomain, rawEvent, extras = {}) {
  if (!INTEGRATION_CAPABILITIES.eventIntake) return null
  if (!rawEvent || typeof rawEvent !== 'object') return null

  try {
    return ingestAutomationEvent({
      sourceDomain,
      domain: sourceDomain,
      companyId: extras.companyId || rawEvent.companyId,
      rawEvent,
      ...extras,
    })
  } catch {
    /* intake must never break domain writes */
    return null
  }
}

export function fanoutFollowupEmission(rawEvent) {
  return fanoutDomainEmission(AUTOMATION_SOURCE_DOMAIN.FOLLOWUP, rawEvent)
}

export function fanoutWorkflowEmission(rawEvent) {
  return fanoutDomainEmission(AUTOMATION_SOURCE_DOMAIN.WORKFLOW, rawEvent)
}

export function fanoutPortalEmission(rawEvent) {
  return fanoutDomainEmission(AUTOMATION_SOURCE_DOMAIN.PORTAL, rawEvent)
}

export function fanoutInteractionEmission(rawEvent) {
  return fanoutDomainEmission(AUTOMATION_SOURCE_DOMAIN.INTERACTION, rawEvent)
}

export function fanoutActivityEmission(rawEvent) {
  return fanoutDomainEmission(AUTOMATION_SOURCE_DOMAIN.ACTIVITY, rawEvent)
}
