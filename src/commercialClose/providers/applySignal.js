/**
 * H15.6 — Apply provider signals into CommercialClose domain (architecture).
 *
 * Providers produce signals. CommercialClose applies them.
 * Vendor capabilities remain false: completed vendor signals are rejected
 * (no close mutation, no proposal mutation, no capability flips).
 */

import { COMMERCIAL_CLOSE_CAPABILITIES, isTerminalCommercialCloseStatus } from '../types.js'
import { canTransitionCommercialCloseStatus } from '../transitions.js'
import { COMMERCIAL_CLOSE_STATUS } from '../types.js'
import { hasValidPaymentEvidence } from '../paymentSchema.js'
import { hasValidSignatureEvidence } from '../signatureSchema.js'
import {
  mapPaymentSignalToEvidence,
  mapSignatureSignalToEvidence,
} from './evidenceMap.js'
import { evaluateProviderSignalOrdering } from './webhook.js'
import {
  PROVIDER_APPLY_RESULT,
  PROVIDER_KIND,
  PROVIDER_REJECTION_REASON,
  PROVIDER_SIGNAL_OUTCOME,
  makeProviderSignal,
} from './types.js'

function companyOf(close) {
  return String(close?.companyId ?? '').trim()
}

function assertCompanyIsolation(close, signal) {
  const closeCompany = companyOf(close)
  const signalCompany = String(signal.companyId ?? '').trim()
  if (!closeCompany || !signalCompany || closeCompany !== signalCompany) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
    }
  }
  return null
}

function assertCloseBinding(close, signal) {
  if (!close?.id) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
    }
  }
  if (signal.closeId && signal.closeId !== close.id) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
    }
  }
  if (signal.requestId) {
    const sigReq = close.signature?.request?.id
    const payReq = close.payment?.request?.id
    if (signal.requestId !== sigReq && signal.requestId !== payReq) {
      return {
        result: PROVIDER_APPLY_RESULT.REJECTED,
        reason: PROVIDER_REJECTION_REASON.BINDING_MISMATCH,
      }
    }
  }
  return null
}

function vendorsEnabledFor(kind) {
  if (kind === PROVIDER_KIND.SIGNATURE) {
    return (
      COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature === true &&
      COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === true
    )
  }
  if (kind === PROVIDER_KIND.PAYMENT) {
    return (
      COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing === true &&
      COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === true
    )
  }
  return false
}

/**
 * Apply a signature provider signal. Does not mutate CommercialClose while
 * signature vendors are disabled (H15.6).
 *
 * @param {object} close
 * @param {object} signalInput
 * @param {{ expectedCompanyId?: string }} [options]
 */
export function applyProviderSignatureSignal(close, signalInput, options = {}) {
  const signal = makeProviderSignal({
    ...signalInput,
    providerKind: PROVIDER_KIND.SIGNATURE,
  })

  if (options.expectedCompanyId) {
    const expected = String(options.expectedCompanyId).trim()
    if (companyOf(close) !== expected) {
      return {
        result: PROVIDER_APPLY_RESULT.REJECTED,
        reason: PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
        close,
        evidence: null,
        transitionTo: null,
      }
    }
  }

  const companyErr = assertCompanyIsolation(close, signal)
  if (companyErr) {
    return { ...companyErr, close, evidence: null, transitionTo: null }
  }

  const bindErr = assertCloseBinding(close, signal)
  if (bindErr) {
    return { ...bindErr, close, evidence: null, transitionTo: null }
  }

  if (isTerminalCommercialCloseStatus(close.status)) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.TERMINAL_CLOSE,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  const order = evaluateProviderSignalOrdering(close, signal)
  if (order.ignore) {
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: order.reason,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  if (signal.outcome === PROVIDER_SIGNAL_OUTCOME.IGNORED) {
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  if (
    signal.outcome === PROVIDER_SIGNAL_OUTCOME.DECLINED ||
    signal.outcome === PROVIDER_SIGNAL_OUTCOME.VOIDED ||
    signal.outcome === PROVIDER_SIGNAL_OUTCOME.EXPIRED ||
    signal.outcome === PROVIDER_SIGNAL_OUTCOME.CANCELLED ||
    signal.outcome === PROVIDER_SIGNAL_OUTCOME.FAILED
  ) {
    // Architecture: failure/cancel signals are recognized but do not mutate
    // while vendors remain disabled. H15.2 transitions stay studio-owned.
    if (!vendorsEnabledFor(PROVIDER_KIND.SIGNATURE)) {
      return {
        result: PROVIDER_APPLY_RESULT.REJECTED,
        reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
        close,
        evidence: null,
        transitionTo: null,
      }
    }
  }

  if (signal.outcome !== PROVIDER_SIGNAL_OUTCOME.COMPLETED) {
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  const mapped = mapSignatureSignalToEvidence(close, signal)
  if (!mapped.ok) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: mapped.reason,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  // Existing validators only accept internal method evidence that is already on the close.
  // Vendor completion cannot bypass H15.2 / H15.3 while vendor flags are false.
  if (!vendorsEnabledFor(PROVIDER_KIND.SIGNATURE)) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
      close,
      evidence: mapped.evidence,
      transitionTo: null,
      mappedEvidence: mapped.evidence,
      wouldRequireTransition: COMMERCIAL_CLOSE_STATUS.SIGNED,
      transitionAllowed: canTransitionCommercialCloseStatus(
        close.status,
        COMMERCIAL_CLOSE_STATUS.SIGNED,
      ),
      evidenceWouldSatisfyInternalValidator: false,
    }
  }

  // Future vendor path (not enabled in H15.6): still require transition guards.
  if (
    !canTransitionCommercialCloseStatus(
      close.status,
      COMMERCIAL_CLOSE_STATUS.SIGNED,
    ) &&
    close.status !== COMMERCIAL_CLOSE_STATUS.SIGNED
  ) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL,
      close,
      evidence: mapped.evidence,
      transitionTo: null,
    }
  }

  if (hasValidSignatureEvidence(close)) {
    return {
      result: PROVIDER_APPLY_RESULT.DUPLICATE,
      reason: null,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  return {
    result: PROVIDER_APPLY_RESULT.REJECTED,
    reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
    close,
    evidence: mapped.evidence,
    transitionTo: null,
  }
}

/**
 * Apply a payment provider signal. Does not mutate CommercialClose while
 * payment vendors are disabled (H15.6).
 *
 * @param {object} close
 * @param {object} signalInput
 * @param {{ expectedCompanyId?: string }} [options]
 */
export function applyProviderPaymentSignal(close, signalInput, options = {}) {
  const signal = makeProviderSignal({
    ...signalInput,
    providerKind: PROVIDER_KIND.PAYMENT,
  })

  if (options.expectedCompanyId) {
    const expected = String(options.expectedCompanyId).trim()
    if (companyOf(close) !== expected) {
      return {
        result: PROVIDER_APPLY_RESULT.REJECTED,
        reason: PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
        close,
        evidence: null,
        transitionTo: null,
      }
    }
  }

  const companyErr = assertCompanyIsolation(close, signal)
  if (companyErr) {
    return { ...companyErr, close, evidence: null, transitionTo: null }
  }

  const bindErr = assertCloseBinding(close, signal)
  if (bindErr) {
    return { ...bindErr, close, evidence: null, transitionTo: null }
  }

  if (isTerminalCommercialCloseStatus(close.status)) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.TERMINAL_CLOSE,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  const order = evaluateProviderSignalOrdering(close, signal)
  if (order.ignore) {
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: order.reason,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  if (signal.outcome === PROVIDER_SIGNAL_OUTCOME.IGNORED) {
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  if (signal.outcome !== PROVIDER_SIGNAL_OUTCOME.COMPLETED) {
    if (!vendorsEnabledFor(PROVIDER_KIND.PAYMENT)) {
      return {
        result: PROVIDER_APPLY_RESULT.REJECTED,
        reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
        close,
        evidence: null,
        transitionTo: null,
      }
    }
    return {
      result: PROVIDER_APPLY_RESULT.IGNORED,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  const mapped = mapPaymentSignalToEvidence(close, signal)
  if (!mapped.ok) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: mapped.reason,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  if (!vendorsEnabledFor(PROVIDER_KIND.PAYMENT)) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
      close,
      evidence: mapped.evidence,
      transitionTo: null,
      mappedEvidence: mapped.evidence,
      wouldRequireTransition: COMMERCIAL_CLOSE_STATUS.PAID,
      transitionAllowed: canTransitionCommercialCloseStatus(
        close.status,
        COMMERCIAL_CLOSE_STATUS.PAID,
      ),
      evidenceWouldSatisfyInternalValidator: hasValidPaymentEvidence({
        ...close,
        payment: {
          ...(close.payment ?? {}),
          status: 'completed',
          evidence: [...(close.payment?.evidence ?? []), mapped.evidence],
        },
      }),
    }
  }

  if (
    !canTransitionCommercialCloseStatus(
      close.status,
      COMMERCIAL_CLOSE_STATUS.PAID,
    ) &&
    close.status !== COMMERCIAL_CLOSE_STATUS.PAID
  ) {
    return {
      result: PROVIDER_APPLY_RESULT.REJECTED,
      reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL,
      close,
      evidence: mapped.evidence,
      transitionTo: null,
    }
  }

  if (hasValidPaymentEvidence(close)) {
    return {
      result: PROVIDER_APPLY_RESULT.DUPLICATE,
      reason: null,
      close,
      evidence: null,
      transitionTo: null,
    }
  }

  return {
    result: PROVIDER_APPLY_RESULT.REJECTED,
    reason: PROVIDER_REJECTION_REASON.VENDORS_DISABLED,
    close,
    evidence: mapped.evidence,
    transitionTo: null,
  }
}
