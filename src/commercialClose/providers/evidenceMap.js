/**
 * H15.6 — Map provider signals → CommercialClose evidence inputs.
 *
 * Adapters produce signals; this module builds evidence shapes only.
 * Never writes stores. Never recomputes decision pricing.
 */

import {
  makeClosePaymentBinding,
  resolveClosePaymentAmounts,
} from '../paymentSchema.js'
import { makeCloseSignatureBinding } from '../signatureSchema.js'
import {
  CLOSE_PAYMENT_KIND,
  CLOSE_PAYMENT_METHOD,
  CLOSE_SIGNATURE_METHOD,
} from '../types.js'
import {
  PROVIDER_KIND,
  PROVIDER_REJECTION_REASON,
  PROVIDER_SIGNAL_OUTCOME,
  isValidProviderRef,
  makeProviderRef,
  makeProviderSignal,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function bindingMatchesClose(binding, close) {
  if (!binding || !close) return false
  if (binding.closeId && binding.closeId !== close.id) return false
  if (binding.proposalId && binding.proposalId !== close.proposalId) return false
  if (binding.sessionId && binding.sessionId !== close.sessionId) return false
  const acceptedAt = asString(close.decision?.acceptedAt).trim()
  if (binding.acceptedAt && acceptedAt && binding.acceptedAt !== acceptedAt) {
    return false
  }
  if (
    binding.publicationId != null &&
    close.decision?.publicationId != null &&
    String(binding.publicationId) !== String(close.decision.publicationId)
  ) {
    return false
  }
  if (
    binding.snapshotNumber != null &&
    close.decision?.snapshotNumber != null &&
    Number(binding.snapshotNumber) !== Number(close.decision.snapshotNumber)
  ) {
    return false
  }
  if (
    binding.proposalVersion != null &&
    close.decision?.proposalVersion != null &&
    Number(binding.proposalVersion) !== Number(close.decision.proposalVersion)
  ) {
    return false
  }
  return true
}

function providerFieldsFromSignal(signal) {
  const ref =
    signal.providerRef && typeof signal.providerRef === 'object'
      ? makeProviderRef(signal.providerRef)
      : null
  return {
    providerId: asString(signal.providerId).trim() || null,
    providerKind: signal.providerKind || null,
    providerRef: ref && isValidProviderRef(ref) ? ref : null,
    providerEventId: asString(signal.providerEventId).trim() || null,
    providerOccurredAt: signal.providerOccurredAt || null,
  }
}

/**
 * @param {object} close
 * @param {object} signalInput
 */
export function mapSignatureSignalToEvidence(close, signalInput) {
  const signal = makeProviderSignal(signalInput)
  if (!close?.id) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
      evidence: null,
    }
  }
  if (signal.providerKind !== PROVIDER_KIND.SIGNATURE) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_SIGNAL,
      evidence: null,
    }
  }
  if (signal.outcome !== PROVIDER_SIGNAL_OUTCOME.COMPLETED) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      evidence: null,
    }
  }

  const binding = makeCloseSignatureBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    acceptedAt: close.decision?.acceptedAt ?? null,
    publicationId: close.decision?.publicationId ?? null,
    snapshotNumber: close.decision?.snapshotNumber ?? null,
    proposalVersion: close.decision?.proposalVersion ?? null,
  })

  if (signal.closeId && signal.closeId !== close.id) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
      evidence: null,
    }
  }
  if (!bindingMatchesClose(binding, close)) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
      evidence: null,
    }
  }

  const signerDisplayName = asString(signal.signerDisplayName).trim()
  if (!signerDisplayName) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_SIGNAL,
      evidence: null,
    }
  }

  const provider = providerFieldsFromSignal(signal)
  // H15.6: vendor methods are not enabled. Evidence mapping still produces a
  // provider-tagged draft; applySignal refuses to treat it as valid until vendors ship.
  return {
    ok: true,
    reason: null,
    evidence: {
      signerDisplayName,
      signedAt: signal.providerOccurredAt || null,
      method: CLOSE_SIGNATURE_METHOD.INTERNAL,
      evidenceRef:
        signal.evidenceRef ||
        (provider.providerEventId
          ? `provider:${provider.providerId}:${provider.providerEventId}`
          : null),
      binding,
      ...provider,
      // Preserve intent that this evidence originated from a provider signal.
      providerMapped: true,
    },
  }
}

/**
 * @param {object} close
 * @param {object} signalInput
 */
export function mapPaymentSignalToEvidence(close, signalInput) {
  const signal = makeProviderSignal(signalInput)
  if (!close?.id) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
      evidence: null,
    }
  }
  if (signal.providerKind !== PROVIDER_KIND.PAYMENT) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_SIGNAL,
      evidence: null,
    }
  }
  if (signal.outcome !== PROVIDER_SIGNAL_OUTCOME.COMPLETED) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      evidence: null,
    }
  }

  const binding = makeClosePaymentBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    acceptedAt: close.decision?.acceptedAt ?? null,
    publicationId: close.decision?.publicationId ?? null,
    snapshotNumber: close.decision?.snapshotNumber ?? null,
    proposalVersion: close.decision?.proposalVersion ?? null,
  })

  if (signal.closeId && signal.closeId !== close.id) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
      evidence: null,
    }
  }
  if (!bindingMatchesClose(binding, close)) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
      evidence: null,
    }
  }

  const amounts = resolveClosePaymentAmounts(close.decision ?? {}, close.payment ?? {})
  const decisionCurrency = asString(amounts.currency).trim() || 'USD'
  const signalCurrency = asString(signal.currency).trim()
  if (signalCurrency && signalCurrency !== decisionCurrency) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.CURRENCY_MISMATCH,
      evidence: null,
    }
  }

  const amount =
    signal.amount != null && Number.isFinite(Number(signal.amount))
      ? Number(signal.amount)
      : amounts.requiredAmount

  if (!(amount > 0)) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.AMOUNT_MISMATCH,
      evidence: null,
    }
  }

  // Never accept provider amounts that exceed remaining or invent new totals.
  if (amount > amounts.remainingAmount + 1e-9) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.AMOUNT_MISMATCH,
      evidence: null,
    }
  }

  // Full-settlement path for H15.4 parity: require covering remaining.
  if (amount + 1e-9 < amounts.remainingAmount) {
    // Partials are allowed as mapped evidence drafts but flagged.
    // applySignal still refuses vendor mutation while capabilities are false.
  }

  const provider = providerFieldsFromSignal(signal)
  return {
    ok: true,
    reason: null,
    evidence: {
      payerDisplayName:
        asString(signal.payerDisplayName).trim() || 'Provider payer',
      amount,
      currency: decisionCurrency,
      paidAt: signal.providerOccurredAt || null,
      method: CLOSE_PAYMENT_METHOD.INTERNAL,
      kind: CLOSE_PAYMENT_KIND.FULL,
      transactionReference:
        provider.providerEventId ||
        provider.providerRef?.externalId ||
        '',
      evidenceRef:
        signal.evidenceRef ||
        (provider.providerEventId
          ? `provider:${provider.providerId}:${provider.providerEventId}`
          : null),
      binding,
      valid: true,
      ...provider,
      providerMapped: true,
    },
  }
}
