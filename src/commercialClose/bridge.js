import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import {
  recordClientBridgePayment,
  recordClientBridgeSignature,
} from './repository.js'

/**
 * Compatibility bridge: legacy proposal.signature (internal) → CommercialClose.
 *
 * Authority:
 *   H14 decision → CommercialClose → signature evidence → signed
 *   proposal.signature remains a legacy compatibility surface only.
 *
 * Never mutates authored proposal content. Never writes proposals.json.
 * Best-effort: no close / wrong state → silent no-op.
 *
 * @param {{
 *   proposalId: string,
 *   companyId?: string,
 *   signerDisplayName: string,
 *   signedAt?: string,
 *   legacyProposalSignatureId?: string | null,
 *   evidenceRef?: string | null,
 * }} input
 */
export function bridgeInternalSignatureToCommercialClose(input = {}) {
  const proposalId = String(input.proposalId ?? '').trim()
  if (!proposalId) return null
  const companyId = String(input.companyId ?? '').trim() || DEFAULT_COMPANY_ID
  const signerDisplayName = String(input.signerDisplayName ?? '').trim()
  if (!signerDisplayName) return null

  try {
    return recordClientBridgeSignature({
      companyId,
      proposalId,
      signerDisplayName,
      signedAt: input.signedAt,
      evidenceRef: input.evidenceRef ?? input.legacyProposalSignatureId ?? null,
      legacyProposalSignatureId: input.legacyProposalSignatureId ?? null,
    })
  } catch {
    return null
  }
}

/**
 * Compatibility bridge: legacy proposal.payment (internal) → CommercialClose.
 *
 * Authority:
 *   H14 decision → CommercialClose → payment evidence → paid
 *   proposal.payment remains a legacy compatibility surface only.
 *
 * Amounts recorded against the immutable close decision — never live proposal pricing.
 * Never mutates authored proposal content. Never writes proposals.json.
 * Best-effort: no close / wrong state → silent no-op.
 *
 * @param {{
 *   proposalId: string,
 *   companyId?: string,
 *   payerDisplayName?: string,
 *   payerReference?: string,
 *   amount?: number,
 *   currency?: string,
 *   paidAt?: string,
 *   kind?: string,
 *   transactionReference?: string | null,
 *   legacyProposalPaymentId?: string | null,
 *   evidenceRef?: string | null,
 * }} input
 */
export function bridgeInternalPaymentToCommercialClose(input = {}) {
  const proposalId = String(input.proposalId ?? '').trim()
  if (!proposalId) return null
  const companyId = String(input.companyId ?? '').trim() || DEFAULT_COMPANY_ID

  try {
    return recordClientBridgePayment({
      companyId,
      proposalId,
      payerDisplayName: input.payerDisplayName,
      payerReference: input.payerReference,
      amount: input.amount,
      currency: input.currency,
      paidAt: input.paidAt,
      kind: input.kind,
      transactionReference: input.transactionReference ?? null,
      evidenceRef: input.evidenceRef ?? input.legacyProposalPaymentId ?? null,
      legacyProposalPaymentId: input.legacyProposalPaymentId ?? null,
    })
  } catch {
    return null
  }
}
