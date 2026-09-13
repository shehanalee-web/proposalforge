/**
 * H16.15 Slice 15.2 — Agent-origin approval-gate contract.
 *
 * Company-scoped pending / approved / rejected records. Approver is a Studio
 * Principal (USER). Associates an agent-origin request without persisting a
 * Native Activity. Storage-neutral: no store, HTTP, executor, or USER-path
 * change. Do not reuse workflow, knowledge, portal, or action-intent statuses.
 */

import { createRecordId } from '../../models/ids.js'
import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { makeStudioPrincipal } from '../identity/schema.js'
import { makeAgentOriginActivityRequest } from './agentOrigin.js'
import { TIMELINE_LIMITS } from './types.js'

export const AGENT_ORIGIN_APPROVAL_SCHEMA_VERSION = 1

export const AGENT_ORIGIN_APPROVAL_ID_PREFIX = 'aoa'

export const AGENT_ORIGIN_APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

export const AGENT_ORIGIN_APPROVAL_STATUSES = Object.freeze(
  Object.values(AGENT_ORIGIN_APPROVAL_STATUS),
)

function trim(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function nowIso() {
  return new Date().toISOString()
}

function asIso(value, fallback = null) {
  if (value == null || value === '') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function assertTenantMatch(leftCompanyId, rightCompanyId) {
  const scoped = evaluateIntegrationCompanyScope(leftCompanyId, rightCompanyId)
  if (!scoped.ok) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

/**
 * @param {object} [input]
 * @returns {{
 *   id: string,
 *   companyId: string,
 *   status: string,
 *   request: { origin: string, actor: object, companyId: string },
 *   approver: { id: string, kind: string, displayName: string | null, companyId: string },
 *   createdAt: string,
 *   decidedAt: string | null,
 * }}
 */
export function makeAgentOriginApproval(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Agent-origin approval must be an object.', 'approval')
  }

  if (!input.request || typeof input.request !== 'object' || Array.isArray(input.request)) {
    throw invalid('request is required.', 'request')
  }
  const request = makeAgentOriginActivityRequest(input.request)

  if (!input.approver || typeof input.approver !== 'object' || Array.isArray(input.approver)) {
    throw invalid('approver is required.', 'approver')
  }
  const approver = makeStudioPrincipal(input.approver)
  assertTenantMatch(approver.companyId, request.companyId)

  if (input.companyId != null && trim(input.companyId)) {
    assertTenantMatch(input.companyId, request.companyId)
  }

  const status = trim(input.status) || AGENT_ORIGIN_APPROVAL_STATUS.PENDING
  if (!AGENT_ORIGIN_APPROVAL_STATUSES.includes(status)) {
    throw invalid('status must be pending, approved, or rejected.', 'status')
  }

  const id =
    trim(input.id).slice(0, TIMELINE_LIMITS.MAX_ID) ||
    createRecordId(AGENT_ORIGIN_APPROVAL_ID_PREFIX)
  const createdAt = asIso(input.createdAt, nowIso())
  const decidedAt =
    status === AGENT_ORIGIN_APPROVAL_STATUS.PENDING
      ? null
      : asIso(input.decidedAt, createdAt)

  if (status === AGENT_ORIGIN_APPROVAL_STATUS.PENDING && input.decidedAt) {
    throw invalid('pending approval cannot have decidedAt.', 'decidedAt')
  }

  return Object.freeze({
    id,
    companyId: request.companyId,
    status,
    request,
    approver,
    createdAt,
    decidedAt,
  })
}

/**
 * @param {object} [input]
 * @returns {object}
 */
export function cloneAgentOriginApproval(input) {
  return makeAgentOriginApproval(input)
}

function decide(record, approverInput, status) {
  const current = makeAgentOriginApproval(record)
  if (current.status !== AGENT_ORIGIN_APPROVAL_STATUS.PENDING) {
    throw invalid(`Only a pending approval can be ${status}.`, 'status')
  }
  if (!approverInput || typeof approverInput !== 'object' || Array.isArray(approverInput)) {
    throw invalid('approver is required.', 'approver')
  }
  return makeAgentOriginApproval({
    id: current.id,
    companyId: current.companyId,
    request: current.request,
    approver: approverInput,
    status,
    createdAt: current.createdAt,
    decidedAt: nowIso(),
  })
}

/**
 * @param {object} record
 * @param {object} approverInput
 * @returns {object}
 */
export function approveAgentOriginApproval(record, approverInput) {
  return decide(record, approverInput, AGENT_ORIGIN_APPROVAL_STATUS.APPROVED)
}

/**
 * @param {object} record
 * @param {object} approverInput
 * @returns {object}
 */
export function rejectAgentOriginApproval(record, approverInput) {
  return decide(record, approverInput, AGENT_ORIGIN_APPROVAL_STATUS.REJECTED)
}
