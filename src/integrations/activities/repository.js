/**
 * H16.7 — Studio-facing timeline read facade.
 *
 * Read-only by construction. Native writes live in `authoring.js` and call
 * the persistence port. This module must not grow create/update/archive.
 *
 * Naming note: H16.8's write-side ActivityRepository lives under `persistence/`
 * so it does not collide with this read facade.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import {
  ACTIVITY_AUDIENCE,
  ACTIVITY_SUBJECT_TYPE,
} from './types.js'
import {
  presentClientTimelineEntry,
  presentStudioTimelineEntry,
} from './schema.js'
import {
  buildTimeline,
  isActivityAuthoringEnabled,
  isActivityTimelineEnabled,
} from './engine.js'
import { describeTimelineSources } from './sources/index.js'
import { describeTimelineCache, isTimelineCacheEnabled } from './cache.js'
import {
  describeActivityRepository,
  isDurableActivityRepositoryHealthy,
} from '../../persistence/activities/index.js'

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return String(companyId).trim()
}

/**
 * @param {object} [query]
 */
export function listStudioTimeline(query = {}) {
  const companyId = assertCompany(query.companyId)
  const page = buildTimeline({ ...query, companyId })

  const present =
    page.entries.length && query.audience === ACTIVITY_AUDIENCE.CLIENT
      ? presentClientTimelineEntry
      : presentStudioTimelineEntry

  return Object.freeze({
    entries: page.entries.map(present),
    nextCursor: page.nextCursor,
    diagnostics: page.diagnostics,
  })
}

/**
 * @param {string} companyId
 * @param {string} proposalId
 * @param {object} [options]
 */
export function listStudioTimelineForProposal(companyId, proposalId, options = {}) {
  return listStudioTimeline({
    ...options,
    companyId,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: proposalId,
  })
}

/**
 * @param {string} companyId
 */
export function describeStudioTimelineSources(companyId) {
  const scoped = assertCompany(companyId)
  return describeTimelineSources({ companyId: scoped })
}

export function getActivityCapabilities() {
  const repository = describeActivityRepository()
  const healthy = isDurableActivityRepositoryHealthy() === true
  return Object.freeze({
    activityTimeline: isActivityTimelineEnabled(),
    activityAuthoring: isActivityAuthoringEnabled(),
    activityPersistence: INTEGRATION_CAPABILITIES.activityPersistence === true,
    durablePersistence: repository.durable === true && healthy,
    repository: Object.freeze({
      id: repository.id,
      durable: repository.durable === true,
      healthy,
    }),
    // Derived from the registered adapter and the last confirmed health
    // snapshot. No DSN, no row counts.
    cacheEnabled: isTimelineCacheEnabled(),
    cache: describeTimelineCache(),
    integrationCapabilities: INTEGRATION_CAPABILITIES,
  })
}
