import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { recordClientBridgeSignature } from './repository.js'

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
