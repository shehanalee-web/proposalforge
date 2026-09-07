import { createRecordId } from '../models/ids.js'
import {
  CLOSE_CONTRACT_METHOD,
  CLOSE_CONTRACT_METHODS,
  CLOSE_CONTRACT_PARTY_ROLE,
  CLOSE_CONTRACT_PARTY_ROLES,
  CLOSE_CONTRACT_STATUS,
  CLOSE_CONTRACT_STATUSES,
} from './types.js'

/**
 * Provider-neutral CommercialClose contract record (H15.5).
 * Internal architecture only. Signature evidence remains H15.3.
 */

function asString(value) {
  return value == null ? '' : String(value)
}

function asIso(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

function asMoney(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

/**
 * Binding anchors — does not duplicate the H14 decision payload.
 *
 * @param {object} [input]
 */
export function makeCloseContractBinding(input = {}) {
  return Object.freeze({
    closeId: asString(input.closeId).trim(),
    sessionId: asString(input.sessionId).trim(),
    proposalId: asString(input.proposalId).trim(),
    companyId: asString(input.companyId).trim(),
    acceptedAt: asString(input.acceptedAt).trim() || null,
    publicationId: asOptionalId(input.publicationId),
    snapshotNumber:
      input.snapshotNumber == null || input.snapshotNumber === ''
        ? null
        : Number(input.snapshotNumber),
    proposalVersion:
      input.proposalVersion == null || input.proposalVersion === ''
        ? null
        : Number(input.proposalVersion),
  })
}

/**
 * @param {object} [input]
 */
export function makeCloseContractParty(input = {}) {
  const role = CLOSE_CONTRACT_PARTY_ROLES.includes(input.role)
    ? input.role
    : CLOSE_CONTRACT_PARTY_ROLE.CLIENT
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cctp'),
    displayName: asString(input.displayName).trim(),
    email: asString(input.email).trim(),
    role,
  })
}

/**
 * @param {object} [input]
 */
export function makeCloseContractRequest(input = {}) {
  const method = CLOSE_CONTRACT_METHODS.includes(input.method)
    ? input.method
    : CLOSE_CONTRACT_METHOD.INTERNAL
  const binding = makeCloseContractBinding(input.binding ?? input)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cctr'),
    status: CLOSE_CONTRACT_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_CONTRACT_STATUS.DRAFT,
    method,
    createdAt: asIso(input.createdAt, nowIso()),
    createdByActorId: asOptionalId(input.createdByActorId),
    binding,
  })
}

/**
 * Issued contractual record bound to the immutable close decision.
 *
 * @param {object} [input]
 */
export function makeCloseContractRecord(input = {}) {
  const binding = makeCloseContractBinding(input.binding ?? input)
  const parties = Array.isArray(input.parties)
    ? input.parties
        .filter((item) => item && typeof item === 'object')
        .map((item) => makeCloseContractParty(item))
    : []
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cctrct'),
    number: asString(input.number).trim(),
    title: asString(input.title).trim() || 'Commercial close contract',
    status: CLOSE_CONTRACT_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_CONTRACT_STATUS.ISSUED,
    method: CLOSE_CONTRACT_METHODS.includes(input.method)
      ? input.method
      : CLOSE_CONTRACT_METHOD.INTERNAL,
    currency: asString(input.currency).trim() || 'USD',
    totalAmount: asMoney(input.totalAmount, 0),
    parties,
    effectiveAt: asIso(input.effectiveAt, nowIso()),
    issuedAt: asIso(input.issuedAt, nowIso()),
    issuedByActorId: asOptionalId(input.issuedByActorId),
    binding,
  })
}

/**
 * Contract aggregate owned by CommercialClose.
 *
 * @param {object} [input]
 */
export function makeCloseContract(input = {}) {
  const status = CLOSE_CONTRACT_STATUSES.includes(input.status)
    ? input.status
    : CLOSE_CONTRACT_STATUS.NOT_REQUESTED
  const method =
    input.method == null || input.method === ''
      ? null
      : CLOSE_CONTRACT_METHODS.includes(input.method)
        ? input.method
        : CLOSE_CONTRACT_METHOD.INTERNAL
  const request =
    input.request && typeof input.request === 'object'
      ? makeCloseContractRequest(input.request)
      : null
  const record =
    input.record && typeof input.record === 'object'
      ? makeCloseContractRecord(input.record)
      : null

  return Object.freeze({
    required: Boolean(input.required),
    status,
    method,
    request,
    record,
    completedAt: asIso(input.completedAt, null),
  })
}

/**
 * Build contract state anchored to the immutable close decision.
 *
 * @param {object} close
 * @param {object} [contractInput]
 */
export function makeCloseContractFromDecision(close, contractInput = {}) {
  const decision = close?.decision ?? {}
  const totalAmount =
    decision.selectedTotal != null && Number.isFinite(Number(decision.selectedTotal))
      ? Number(decision.selectedTotal)
      : asMoney(contractInput.record?.totalAmount ?? contractInput.totalAmount, 0)
  const currency =
    asString(decision.currency).trim() ||
    asString(contractInput.record?.currency ?? contractInput.currency).trim() ||
    'USD'

  const record =
    contractInput.record && typeof contractInput.record === 'object'
      ? makeCloseContractRecord({
          ...contractInput.record,
          currency,
          totalAmount,
        })
      : null

  return makeCloseContract({
    ...contractInput,
    record,
  })
}

/**
 * Studio presentation.
 *
 * @param {object | null | undefined} contract
 */
export function presentCloseContract(contract) {
  if (!contract) return null
  const next = makeCloseContract(contract)
  return {
    required: next.required,
    status: next.status,
    method: next.method,
    request: next.request
      ? {
          id: next.request.id,
          status: next.request.status,
          method: next.request.method,
          createdAt: next.request.createdAt,
          createdByActorId: next.request.createdByActorId,
          binding: { ...next.request.binding },
        }
      : null,
    record: next.record
      ? {
          id: next.record.id,
          number: next.record.number,
          title: next.record.title,
          status: next.record.status,
          method: next.record.method,
          currency: next.record.currency,
          totalAmount: next.record.totalAmount,
          parties: next.record.parties.map((party) => ({
            id: party.id,
            displayName: party.displayName,
            email: party.email,
            role: party.role,
          })),
          effectiveAt: next.record.effectiveAt,
          issuedAt: next.record.issuedAt,
          issuedByActorId: next.record.issuedByActorId,
          binding: { ...next.record.binding },
        }
      : null,
    completedAt: next.completedAt,
  }
}

/**
 * Client-safe contract projection.
 *
 * @param {object | null | undefined} contract
 */
export function presentClientCloseContract(contract) {
  if (!contract) return null
  const next = makeCloseContract(contract)
  return {
    required: next.required,
    status: next.status,
    method: next.method === CLOSE_CONTRACT_METHOD.INTERNAL ? next.method : null,
    completedAt: next.completedAt,
    record: next.record
      ? {
          number: next.record.number,
          title: next.record.title,
          status: next.record.status,
          currency: next.record.currency,
          totalAmount: next.record.totalAmount,
          effectiveAt: next.record.effectiveAt,
          issuedAt: next.record.issuedAt,
          parties: next.record.parties.map((party) => ({
            displayName: party.displayName,
            role: party.role,
          })),
        }
      : null,
  }
}
