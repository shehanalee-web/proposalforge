import { createRecordId } from '../models/ids.js'
import {
  CLOSE_SIGNATURE_METHOD,
  CLOSE_SIGNATURE_METHODS,
  CLOSE_SIGNATURE_PARTY_ROLE,
  CLOSE_SIGNATURE_PARTY_ROLES,
  CLOSE_SIGNATURE_STATUS,
  CLOSE_SIGNATURE_STATUSES,
} from './types.js'

/**
 * Provider-neutral CommercialClose signature request + evidence (H15.3).
 * Internal is the only supported method. No vendor SDKs.
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

/**
 * @param {object} [input]
 */
export function makeCloseSignatureParty(input = {}) {
  const role = CLOSE_SIGNATURE_PARTY_ROLES.includes(input.role)
    ? input.role
    : CLOSE_SIGNATURE_PARTY_ROLE.CLIENT
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('csigp'),
    displayName: asString(input.displayName).trim(),
    email: asString(input.email).trim(),
    role,
    required: input.required !== false,
  })
}

/**
 * Binding anchors — does not duplicate the H14 decision payload.
 *
 * @param {object} [input]
 */
export function makeCloseSignatureBinding(input = {}) {
  return Object.freeze({
    closeId: asString(input.closeId).trim(),
    sessionId: asString(input.sessionId).trim(),
    proposalId: asString(input.proposalId).trim(),
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
export function makeCloseSignatureRequest(input = {}) {
  const method = CLOSE_SIGNATURE_METHODS.includes(input.method)
    ? input.method
    : CLOSE_SIGNATURE_METHOD.INTERNAL
  const binding = makeCloseSignatureBinding(input.binding ?? input)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('csigr'),
    status: CLOSE_SIGNATURE_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_SIGNATURE_STATUS.PENDING,
    method,
    createdAt: asIso(input.createdAt, nowIso()),
    createdByActorId: asOptionalId(input.createdByActorId),
    binding,
  })
}

/**
 * Provider-neutral signature evidence bound immutably to a close.
 *
 * @param {object} [input]
 */
export function makeCloseSignatureEvidence(input = {}) {
  const method = CLOSE_SIGNATURE_METHODS.includes(input.method)
    ? input.method
    : CLOSE_SIGNATURE_METHOD.INTERNAL
  const binding = makeCloseSignatureBinding(input.binding ?? input)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('csige'),
    signerActorId: asOptionalId(input.signerActorId),
    signerDisplayName: asString(input.signerDisplayName).trim(),
    signedAt: asIso(input.signedAt, nowIso()),
    method,
    evidenceRef: asOptionalId(input.evidenceRef),
    legacyProposalSignatureId: asOptionalId(input.legacyProposalSignatureId),
    binding,
  })
}

function asParties(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => makeCloseSignatureParty(item))
}

function asEvidenceList(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => makeCloseSignatureEvidence(item))
}

/**
 * Signature aggregate owned by CommercialClose.
 *
 * @param {object} [input]
 */
export function makeCloseSignature(input = {}) {
  const status = CLOSE_SIGNATURE_STATUSES.includes(input.status)
    ? input.status
    : CLOSE_SIGNATURE_STATUS.NOT_REQUESTED
  const method =
    input.method == null || input.method === ''
      ? null
      : CLOSE_SIGNATURE_METHODS.includes(input.method)
        ? input.method
        : CLOSE_SIGNATURE_METHOD.INTERNAL

  const request =
    input.request && typeof input.request === 'object'
      ? makeCloseSignatureRequest(input.request)
      : null

  return Object.freeze({
    required: Boolean(input.required),
    status,
    method,
    parties: asParties(input.parties),
    request,
    evidence: asEvidenceList(input.evidence),
    completedAt: asIso(input.completedAt, null),
  })
}

/**
 * True when evidence is present, bound to this close, and method is internal.
 *
 * @param {object} close
 */
export function hasValidSignatureEvidence(close) {
  if (!close?.signature) return false
  const signature = makeCloseSignature(close.signature)
  if (signature.status !== CLOSE_SIGNATURE_STATUS.COMPLETED) return false
  if (!signature.evidence.length) return false
  const closeId = asString(close.id).trim()
  const acceptedAt = asString(close.decision?.acceptedAt).trim()
  return signature.evidence.some((item) => {
    if (item.method !== CLOSE_SIGNATURE_METHOD.INTERNAL) return false
    if (!item.signerDisplayName) return false
    if (!item.signedAt) return false
    if (closeId && item.binding.closeId && item.binding.closeId !== closeId) return false
    if (
      acceptedAt &&
      item.binding.acceptedAt &&
      item.binding.acceptedAt !== acceptedAt
    ) {
      return false
    }
    return true
  })
}

/**
 * Studio presentation of signature state.
 *
 * @param {object | null | undefined} signature
 */
export function presentCloseSignature(signature) {
  if (!signature) return null
  const next = makeCloseSignature(signature)
  return {
    required: next.required,
    status: next.status,
    method: next.method,
    parties: next.parties.map((party) => ({
      id: party.id,
      displayName: party.displayName,
      email: party.email,
      role: party.role,
      required: party.required,
    })),
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
    evidence: next.evidence.map((item) => ({
      id: item.id,
      signerActorId: item.signerActorId,
      signerDisplayName: item.signerDisplayName,
      signedAt: item.signedAt,
      method: item.method,
      evidenceRef: item.evidenceRef,
      legacyProposalSignatureId: item.legacyProposalSignatureId,
      binding: { ...item.binding },
    })),
    completedAt: next.completedAt,
  }
}

/**
 * Client-safe signature projection — no actor ids, no request internals.
 *
 * @param {object | null | undefined} signature
 */
export function presentClientCloseSignature(signature) {
  if (!signature) return null
  const next = makeCloseSignature(signature)
  return {
    required: next.required,
    status: next.status,
    method: next.method === CLOSE_SIGNATURE_METHOD.INTERNAL ? next.method : null,
    completedAt: next.completedAt,
    parties: next.parties.map((party) => ({
      displayName: party.displayName,
      role: party.role,
      required: party.required,
    })),
    signedBy: next.evidence.map((item) => ({
      displayName: item.signerDisplayName,
      signedAt: item.signedAt,
      method: item.method,
    })),
  }
}
