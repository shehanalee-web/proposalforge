/**
 * H16.11 — Native Activity → H16.2 intake emission.
 *
 * Product writes go through createStudioActivity. Direct repository.create
 * does not call this module. Intake is best-effort and must never fail the
 * Activity write. PATCH / archive / GET do not emit.
 */

import { fanoutActivityEmission } from '../events/fanout.js'

/**
 * Emit a persisted NativeActivity into H16.2 intake.
 *
 * @param {object | null | undefined} activity
 * @returns {object | null}
 */
export function emitNativeActivityCreated(activity) {
  if (!activity || typeof activity !== 'object') return null
  return fanoutActivityEmission(activity)
}
