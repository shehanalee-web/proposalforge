/**
 * H16.1 — Hard boundaries against H15 / proposal / decision mutation.
 *
 * Integration foundation must never transition CommercialClose, mutate
 * decision snapshots, or write authored proposal content.
 */

import { ForbiddenError } from '../services/errors.js'
import { INTEGRATION_REJECTION_REASON } from './types.js'

export function refuseCommercialCloseMutation(action = 'mutate CommercialClose') {
  throw new ForbiddenError(
    `H16 integrations cannot ${action}. CommercialClose remains owned by H15.`,
  )
}

export function refuseDecisionSnapshotMutation() {
  throw new ForbiddenError(
    'H16 integrations cannot mutate accepted decision snapshots.',
  )
}

export function refuseProposalContentMutation() {
  throw new ForbiddenError(
    'H16 integrations cannot mutate proposal authored content or write proposals.json.',
  )
}

/**
 * Result-style boundary rejection for non-throwing call sites.
 *
 * @param {string} [boundary]
 */
export function rejectIntegrationBoundary(boundary = 'commercial_close') {
  return Object.freeze({
    ok: false,
    rejected: true,
    reason: INTEGRATION_REJECTION_REASON.BOUNDARY_VIOLATION,
    boundary,
  })
}
