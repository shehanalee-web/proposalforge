/**
 * H16.15 Slice 15.1 — Agent-origin Native Activity request contract.
 *
 * Shape only: origin AGENT, actor.kind AGENT, tenant companyId.
 * Reuses ACTIVITY_ORIGIN.AGENT. Does not persist, approve, emit, or add HTTP.
 * createStudioActivity remains the USER-origin path. An agent is not a
 * Studio Principal.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN, TIMELINE_LIMITS } from './types.js'

function trim(value) {
  return value == null ? '' : String(value).trim()
}

/**
 * @param {object} [input]
 * @returns {{ origin: string, actor: { id: string, kind: string, displayName: string | null }, companyId: string }}
 */
export function makeAgentOriginActivityRequest(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const actor = source.actor && typeof source.actor === 'object' ? source.actor : {}
  const id = trim(actor.id).slice(0, TIMELINE_LIMITS.MAX_ID)
  if (!id) {
    throw new ValidationError('actor.id is required.', [
      { field: 'actor.id', message: 'actor.id is required.' },
    ])
  }
  const scoped = evaluateIntegrationCompanyScope(source.companyId)
  if (!scoped.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return Object.freeze({
    origin: ACTIVITY_ORIGIN.AGENT,
    actor: Object.freeze({
      id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: trim(actor.displayName).slice(0, TIMELINE_LIMITS.MAX_ID) || null,
    }),
    companyId: scoped.companyId.slice(0, TIMELINE_LIMITS.MAX_ID),
  })
}
