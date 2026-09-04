import { createRecordId } from './ids.js'

/**
 * Signature architecture. No DocuSign (or other vendor) is wired.
 * Internal is the only placeholder provider.
 */

export const SIGNATURE_PROVIDER = Object.freeze({
  INTERNAL: 'internal',
  DOCUSIGN: 'docusign',
  DROPBOX_SIGN: 'dropbox_sign',
  ADOBE_SIGN: 'adobe_sign',
  OPENSIGN: 'opensign',
})

export const SIGNATURE_PROVIDERS = Object.freeze(Object.values(SIGNATURE_PROVIDER))

export const SIGNATURE_PROVIDER_LABELS = Object.freeze({
  [SIGNATURE_PROVIDER.INTERNAL]: 'Internal',
  [SIGNATURE_PROVIDER.DOCUSIGN]: 'DocuSign',
  [SIGNATURE_PROVIDER.DROPBOX_SIGN]: 'Dropbox Sign',
  [SIGNATURE_PROVIDER.ADOBE_SIGN]: 'Adobe Sign',
  [SIGNATURE_PROVIDER.OPENSIGN]: 'OpenSign',
})

export const SIGNATURE_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  WAITING: 'waiting',
  SIGNED: 'signed',
  DECLINED: 'declined',
  VOID: 'void',
})

export const SIGNATURE_STATUSES = Object.freeze(Object.values(SIGNATURE_STATUS))

export const SIGNATURE_STATUS_LABELS = Object.freeze({
  [SIGNATURE_STATUS.NOT_REQUESTED]: 'Not requested',
  [SIGNATURE_STATUS.WAITING]: 'Waiting for signature',
  [SIGNATURE_STATUS.SIGNED]: 'Signed',
  [SIGNATURE_STATUS.DECLINED]: 'Declined',
  [SIGNATURE_STATUS.VOID]: 'Void',
})

/**
 * @typedef {object} ProposalSignature
 * @property {string} id
 * @property {string} proposalId
 * @property {string} status
 * @property {string} provider
 * @property {string} signer
 * @property {string | null} signedAt
 * @property {string | null} ipAddress
 * @property {string} browser
 * @property {string} device
 */

export function makeProposalSignature(input = {}) {
  const status = SIGNATURE_STATUSES.includes(input.status)
    ? input.status
    : SIGNATURE_STATUS.NOT_REQUESTED
  const provider = SIGNATURE_PROVIDERS.includes(input.provider)
    ? input.provider
    : SIGNATURE_PROVIDER.INTERNAL

  return {
    id: input.id ?? createRecordId('sig'),
    proposalId: input.proposalId ?? '',
    status,
    provider,
    signer: String(input.signer ?? '').trim(),
    signedAt: input.signedAt ?? null,
    ipAddress: input.ipAddress ?? null,
    browser: input.browser ?? '',
    device: input.device ?? '',
  }
}
