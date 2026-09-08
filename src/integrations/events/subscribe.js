/**
 * H16.2 — Integrations-side living event subscription.
 *
 * Direction: living bus → integrations intake.
 * Living must not import integrations.
 */

import { onLivingEvent } from '../../living/events.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import { AUTOMATION_SOURCE_DOMAIN } from './types.js'
import { ingestAutomationEvent } from './intake.js'

let unsubscribe = null

/**
 * Start best-effort living → intake subscription.
 * Safe to call multiple times; returns stop function.
 */
export function startAutomationEventIntake() {
  if (!INTEGRATION_CAPABILITIES.eventIntake) {
    return () => {}
  }
  if (unsubscribe) return unsubscribe

  unsubscribe = onLivingEvent((busEvent) => {
    try {
      const payload =
        busEvent?.payload && typeof busEvent.payload === 'object'
          ? busEvent.payload
          : {}
      ingestAutomationEvent({
        sourceDomain: AUTOMATION_SOURCE_DOMAIN.LIVING,
        companyId: payload.companyId,
        busEvent,
      })
    } catch {
      /* never break living emitters */
    }
  })

  return stopAutomationEventIntake
}

export function stopAutomationEventIntake() {
  if (typeof unsubscribe === 'function') {
    unsubscribe()
  }
  unsubscribe = null
}

export function isAutomationEventIntakeRunning() {
  return typeof unsubscribe === 'function'
}
