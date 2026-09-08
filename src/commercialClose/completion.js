/**
 * H15.7 — Commercial Close completion policy + reconciliation.
 *
 * Requirement-driven: completion is deterministic from persisted CommercialClose
 * requirements and evidence. Payment is not universally mandatory.
 * Contract/invoice block only when explicitly required on the close.
 *
 * Never mutates proposals. Never enables vendor capabilities.
 * Never invents payment amounts or bypasses decision binding.
 */

import { canTransitionCommercialCloseStatus } from './transitions.js'
import { hasValidSignatureEvidence, makeCloseSignature } from './signatureSchema.js'
import {
  hasValidPaymentEvidence,
  makeClosePaymentFromDecision,
} from './paymentSchema.js'
import { makeCloseContract } from './contractSchema.js'
import { makeCloseInvoice } from './invoiceSchema.js'
import {
  CLOSE_CONTRACT_STATUS,
  CLOSE_INVOICE_STATUS,
  CLOSE_PAYMENT_STATUS,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
  isTerminalCommercialCloseStatus,
} from './types.js'

/** Stable blocker codes for completion evaluation. */
export const COMMERCIAL_CLOSE_COMPLETION_BLOCKER = Object.freeze({
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  STATUS_NOT_CLOSABLE: 'status_not_closable',
  SIGNATURE_INCOMPLETE: 'signature_incomplete',
  PAYMENT_INCOMPLETE: 'payment_incomplete',
  PAYMENT_PARTIAL: 'payment_partial',
  CONTRACT_INCOMPLETE: 'contract_incomplete',
  INVOICE_INCOMPLETE: 'invoice_incomplete',
})

export const COMMERCIAL_CLOSE_COMPLETION_RESULT = Object.freeze({
  ALREADY_COMPLETE: 'already_complete',
  READY: 'ready',
  BLOCKED: 'blocked',
  TERMINAL_NON_COMPLETE: 'terminal_non_complete',
  IGNORED: 'ignored',
})

function reasonFor(code) {
  switch (code) {
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.CANCELLED:
      return 'Commercial close is cancelled and cannot be completed.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.EXPIRED:
      return 'Commercial close is expired and cannot be completed.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.STATUS_NOT_CLOSABLE:
      return 'Current close status cannot transition to closed.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.SIGNATURE_INCOMPLETE:
      return 'Signature is required and valid signature evidence is missing.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_INCOMPLETE:
      return 'Payment is required and valid payment evidence is missing.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_PARTIAL:
      return 'Payment is required but only partially settled against the decision total.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.CONTRACT_INCOMPLETE:
      return 'Contract is required and has not been issued.'
    case COMMERCIAL_CLOSE_COMPLETION_BLOCKER.INVOICE_INCOMPLETE:
      return 'Invoice is required and has not been issued.'
    default:
      return 'Commercial close is not ready to complete.'
  }
}

function signatureSatisfied(close) {
  return hasValidSignatureEvidence(close)
}

function paymentSatisfied(close) {
  return hasValidPaymentEvidence(close)
}

function contractSatisfied(close) {
  const contract = makeCloseContract(close?.contract ?? {})
  return (
    contract.status === CLOSE_CONTRACT_STATUS.ISSUED &&
    Boolean(contract.record?.id)
  )
}

function invoiceSatisfied(close) {
  const invoice = makeCloseInvoice(close?.invoice ?? {})
  return (
    invoice.status === CLOSE_INVOICE_STATUS.ISSUED && Boolean(invoice.record?.id)
  )
}

function isPartialPayment(close) {
  const payment = makeClosePaymentFromDecision(close, close?.payment ?? {})
  if (!payment.required) return false
  if (paymentSatisfied(close)) return false
  const hasEvidence = (payment.evidence ?? []).length > 0
  const remaining =
    payment.remainingAmount != null && Number.isFinite(Number(payment.remainingAmount))
      ? Number(payment.remainingAmount)
      : null
  if (hasEvidence && remaining != null && remaining > 1e-9) return true
  if (
    payment.status === CLOSE_PAYMENT_STATUS.PENDING &&
    hasEvidence &&
    !paymentSatisfied(close)
  ) {
    return true
  }
  return false
}

/**
 * Pure, deterministic completion evaluation from persisted CommercialClose state.
 *
 * @param {object | null | undefined} close
 * @returns {{
 *   ready: boolean,
 *   alreadyComplete: boolean,
 *   blockers: string[],
 *   reasons: string[],
 *   requirements: { signature: boolean, payment: boolean, contract: boolean, invoice: boolean },
 *   satisfied: { signature: boolean, payment: boolean, contract: boolean, invoice: boolean },
 *   status: string | null,
 *   closeId: string | null,
 * }}
 */
export function evaluateCommercialCloseCompletion(close) {
  if (!close || typeof close !== 'object') {
    return {
      ready: false,
      alreadyComplete: false,
      blockers: [COMMERCIAL_CLOSE_COMPLETION_BLOCKER.STATUS_NOT_CLOSABLE],
      reasons: [reasonFor(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.STATUS_NOT_CLOSABLE)],
      requirements: {
        signature: false,
        payment: false,
        contract: false,
        invoice: false,
      },
      satisfied: {
        signature: false,
        payment: false,
        contract: false,
        invoice: false,
      },
      status: null,
      closeId: null,
    }
  }

  const signature = makeCloseSignature(close.signature ?? {})
  const payment = makeClosePaymentFromDecision(close, close.payment ?? {})
  const contract = makeCloseContract(close.contract ?? {})
  const invoice = makeCloseInvoice(close.invoice ?? {})

  const requirements = {
    signature: Boolean(signature.required),
    payment: Boolean(payment.required),
    contract: Boolean(contract.required),
    invoice: Boolean(invoice.required),
  }

  const satisfied = {
    signature: signatureSatisfied(close),
    payment: paymentSatisfied(close),
    contract: contractSatisfied(close),
    invoice: invoiceSatisfied(close),
  }

  const status = close.status || null
  const closeId = close.id || null
  const blockers = []

  if (status === COMMERCIAL_CLOSE_STATUS.CLOSED) {
    return {
      ready: true,
      alreadyComplete: true,
      blockers: [],
      reasons: ['Commercial close is already completed.'],
      requirements,
      satisfied,
      status,
      closeId,
    }
  }

  if (status === COMMERCIAL_CLOSE_STATUS.CANCELLED) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.CANCELLED)
  } else if (status === COMMERCIAL_CLOSE_STATUS.EXPIRED) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.EXPIRED)
  } else if (
    !canTransitionCommercialCloseStatus(status, COMMERCIAL_CLOSE_STATUS.CLOSED)
  ) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.STATUS_NOT_CLOSABLE)
  }

  if (requirements.signature && !satisfied.signature) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.SIGNATURE_INCOMPLETE)
  }

  if (requirements.payment && !satisfied.payment) {
    if (isPartialPayment(close)) {
      blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_PARTIAL)
    } else {
      blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_INCOMPLETE)
    }
  }

  if (requirements.contract && !satisfied.contract) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.CONTRACT_INCOMPLETE)
  }

  if (requirements.invoice && !satisfied.invoice) {
    blockers.push(COMMERCIAL_CLOSE_COMPLETION_BLOCKER.INVOICE_INCOMPLETE)
  }

  const uniqueBlockers = [...new Set(blockers)]
  const ready = uniqueBlockers.length === 0

  return {
    ready,
    alreadyComplete: false,
    blockers: uniqueBlockers,
    reasons: uniqueBlockers.map((code) => reasonFor(code)),
    requirements,
    satisfied,
    status,
    closeId,
  }
}

/**
 * Studio / API presentation of completion readiness.
 *
 * @param {object | null | undefined} close
 */
export function presentCommercialCloseCompletion(close) {
  const evaluation = evaluateCommercialCloseCompletion(close)
  return {
    ready: evaluation.ready,
    alreadyComplete: evaluation.alreadyComplete,
    blockers: [...evaluation.blockers],
    reasons: [...evaluation.reasons],
    requirements: { ...evaluation.requirements },
    satisfied: { ...evaluation.satisfied },
    status: evaluation.status,
    closeId: evaluation.closeId,
  }
}

/**
 * Thin Forge-facing completion summary derived only from the CommercialClose record.
 *
 * @param {object | null | undefined} close
 */
export function presentCommercialCloseCompletionSummary(close) {
  if (!close) return null
  const evaluation = evaluateCommercialCloseCompletion(close)
  return {
    closeId: evaluation.closeId,
    status: evaluation.status,
    ready: evaluation.ready,
    alreadyComplete: evaluation.alreadyComplete,
    blockers: [...evaluation.blockers],
    reasons: [...evaluation.reasons],
    requirements: { ...evaluation.requirements },
    satisfied: { ...evaluation.satisfied },
  }
}

/**
 * Idempotent completion reconciliation over persisted close state.
 * Never mutates the close, proposals, or vendor capabilities.
 * Provider signals are accepted for inspection only and cannot force completion.
 *
 * @param {object | null | undefined} close
 * @param {{
 *   providerSignals?: object[],
 * }} [options]
 */
export function reconcileCommercialCloseCompletion(close, options = {}) {
  const evaluation = evaluateCommercialCloseCompletion(close)
  const signals = Array.isArray(options.providerSignals)
    ? options.providerSignals
    : []

  // Stale / conflicting provider signals never mutate or force completion.
  const providerSignalsIgnored = signals.length
  const vendorsDisabled =
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors !== true &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors !== true &&
    COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature !== true &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing !== true

  if (!close) {
    return {
      result: COMMERCIAL_CLOSE_COMPLETION_RESULT.IGNORED,
      evaluation,
      close: null,
      mutated: false,
      providerSignalsIgnored,
      vendorsDisabled,
    }
  }

  if (evaluation.alreadyComplete) {
    return {
      result: COMMERCIAL_CLOSE_COMPLETION_RESULT.ALREADY_COMPLETE,
      evaluation,
      close,
      mutated: false,
      providerSignalsIgnored,
      vendorsDisabled,
    }
  }

  if (
    isTerminalCommercialCloseStatus(close.status) &&
    close.status !== COMMERCIAL_CLOSE_STATUS.CLOSED
  ) {
    return {
      result: COMMERCIAL_CLOSE_COMPLETION_RESULT.TERMINAL_NON_COMPLETE,
      evaluation,
      close,
      mutated: false,
      providerSignalsIgnored,
      vendorsDisabled,
    }
  }

  if (!evaluation.ready) {
    return {
      result: COMMERCIAL_CLOSE_COMPLETION_RESULT.BLOCKED,
      evaluation,
      close,
      mutated: false,
      providerSignalsIgnored,
      vendorsDisabled,
    }
  }

  return {
    result: COMMERCIAL_CLOSE_COMPLETION_RESULT.READY,
    evaluation,
    close,
    mutated: false,
    providerSignalsIgnored,
    vendorsDisabled,
  }
}

/**
 * Assert that a close may transition to `closed` under H15.7 policy.
 * Throws a plain object descriptor for repository ValidationError mapping.
 *
 * @param {object} close
 * @returns {object} evaluation when ready
 */
export function assertCommercialCloseReadyToComplete(close) {
  const evaluation = evaluateCommercialCloseCompletion(close)
  if (evaluation.alreadyComplete) {
    return evaluation
  }
  if (!evaluation.ready) {
    const error = new Error('Commercial close is not ready to complete.')
    error.name = 'CompletionNotReady'
    error.evaluation = evaluation
    throw error
  }
  return evaluation
}
