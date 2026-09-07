import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../../workflow/actors.js'
import { PROPOSAL_STATUS } from '../../models/proposal.js'
import {
  CLOSE_PAYMENT_STATUS_LABELS,
  CLOSE_SIGNATURE_STATUS_LABELS,
  COMMERCIAL_CLOSE_STATUS,
  COMMERCIAL_CLOSE_STATUS_LABELS,
} from '../../commercialClose/types.js'
import styles from './ProposalCommercial.module.css'

function Card({ title, kicker, children }) {
  return (
    <section className={styles.card} data-commercial-close="true">
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

const ACTION_LABELS = Object.freeze({
  [COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING]: 'Request signature',
  [COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING]: 'Request payment',
  [COMMERCIAL_CLOSE_STATUS.PAID]: 'Mark paid',
  [COMMERCIAL_CLOSE_STATUS.CLOSED]: 'Mark closed',
  [COMMERCIAL_CLOSE_STATUS.CANCELLED]: 'Cancel close',
  [COMMERCIAL_CLOSE_STATUS.EXPIRED]: 'Mark expired',
})

/**
 * Studio surface for H15.1–H15.4 Commercial Close.
 * Opens a close, advances the state machine, and records internal signatures/payments.
 */
export function CommercialCloseCard({ proposal }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const proposalId = proposal?.id
  const companyId = proposal?.companyId || DEFAULT_COMPANY_ID
  const actorId = DEFAULT_ACTOR_ID
  const accepted = proposal?.status === PROPOSAL_STATUS.ACCEPTED

  const load = useCallback(async () => {
    if (!proposalId) return
    try {
      const response = await fetch(
        `/api/commercial-close/proposal/${encodeURIComponent(proposalId)}?companyId=${encodeURIComponent(companyId)}&actorId=${encodeURIComponent(actorId)}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not load commercial close.')
        return
      }
      setState(payload)
      setError(null)
    } catch {
      setError('Could not load commercial close.')
    }
  }, [proposalId, companyId, actorId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!proposalId) return
      try {
        const response = await fetch(
          `/api/commercial-close/proposal/${encodeURIComponent(proposalId)}?companyId=${encodeURIComponent(companyId)}&actorId=${encodeURIComponent(actorId)}`,
        )
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setError(payload.message || 'Could not load commercial close.')
          return
        }
        setState(payload)
        setError(null)
      } catch {
        if (!cancelled) setError('Could not load commercial close.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proposalId, companyId, actorId])

  async function handleOpen() {
    if (!proposalId || busy || !accepted) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/proposal/${encodeURIComponent(proposalId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not open commercial close.')
        return
      }
      setState(payload)
      await load()
    } catch {
      setError('Could not open commercial close.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTransition(to) {
    const closeId = state?.close?.id
    if (!closeId || busy || !to) return
    if (to === COMMERCIAL_CLOSE_STATUS.SIGNED) {
      return handleCompleteSignature()
    }
    if (to === COMMERCIAL_CLOSE_STATUS.PAID) {
      return handleCompletePayment()
    }
    if (to === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
      return handleRequestPayment()
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId, to }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not transition commercial close.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not transition commercial close.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestSignature() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/signature/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not request signature.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not request signature.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCompleteSignature() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/signature/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            actorId,
            signerDisplayName: proposal?.clientName || 'Client',
          }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not complete internal signature.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not complete internal signature.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestPayment() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/payment/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not request payment.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not request payment.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCompletePayment() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/payment/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            actorId,
            payerDisplayName: proposal?.clientName || 'Client',
          }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not complete internal payment.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not complete internal payment.')
    } finally {
      setBusy(false)
    }
  }

  const close = state?.close
  const decision = close?.decision
  const signature = close?.signature
  const payment = close?.payment
  const allowed = (state?.allowedTransitions ?? []).filter(
    (to) =>
      to !== COMMERCIAL_CLOSE_STATUS.SIGNED &&
      to !== COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
      to !== COMMERCIAL_CLOSE_STATUS.PAID &&
      to !== COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
  )
  const history = close?.statusHistory ?? []
  const evidence = signature?.evidence ?? []
  const paymentEvidence = payment?.evidence ?? []
  const canRequest =
    close &&
    (close.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
      close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING)
  const canComplete =
    close &&
    (close.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
      close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING)
  const canRequestPayment =
    close &&
    (close.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
      close.status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
      close.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING)
  const canCompletePayment =
    close &&
    (close.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
      close.status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
      close.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING)

  return (
    <Card title="Commercial close" kicker="H15.4">
      {error ? <p className={styles.note}>{error}</p> : null}
      <dl className={styles.facts}>
        <Fact label="Status">
          {close
            ? COMMERCIAL_CLOSE_STATUS_LABELS[close.status] ?? close.status
            : accepted
              ? 'Not opened'
              : 'Awaiting acceptance'}
        </Fact>
        <Fact label="Opened">
          {close?.openedAt ? formatDateTime(close.openedAt) : '—'}
        </Fact>
        <Fact label="Last transition">
          {close?.lastTransitionAt ? formatDateTime(close.lastTransitionAt) : '—'}
        </Fact>
        <Fact label="Total">
          {decision?.selectedTotal != null
            ? formatCurrency(decision.selectedTotal, decision.currency)
            : '—'}
        </Fact>
        <Fact label="Publication">
          {decision?.publicationId
            ? `v${decision.snapshotNumber ?? '—'}`
            : '—'}
        </Fact>
        <Fact label="Proposal version">
          {decision?.proposalVersion != null ? decision.proposalVersion : '—'}
        </Fact>
        <Fact label="Signature required">
          {signature ? (signature.required ? 'Yes' : 'No') : '—'}
        </Fact>
        <Fact label="Signature status">
          {signature
            ? CLOSE_SIGNATURE_STATUS_LABELS[signature.status] ?? signature.status
            : '—'}
        </Fact>
        <Fact label="Signature method">
          {signature?.method || (signature?.required ? 'internal' : '—')}
        </Fact>
        <Fact label="Payment required">
          {payment ? (payment.required ? 'Yes' : 'No') : '—'}
        </Fact>
        <Fact label="Payment status">
          {payment
            ? CLOSE_PAYMENT_STATUS_LABELS[payment.status] ?? payment.status
            : '—'}
        </Fact>
        <Fact label="Expected amount">
          {payment?.requiredAmount != null
            ? formatCurrency(payment.requiredAmount, payment.currency)
            : '—'}
        </Fact>
        <Fact label="Recorded amount">
          {payment?.recordedAmount != null
            ? formatCurrency(payment.recordedAmount, payment.currency)
            : '—'}
        </Fact>
        <Fact label="Payment method">
          {payment?.method || (payment?.required ? 'internal' : '—')}
        </Fact>
      </dl>

      {!close ? (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.publish}
            onClick={handleOpen}
            disabled={busy || !proposalId || !accepted}
          >
            {busy ? 'Opening…' : 'Open commercial close'}
          </button>
          <p className={styles.note}>
            Binds the locked living decision for later signature and payment.
            External providers are not connected yet.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.row} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {canRequest && close.status === COMMERCIAL_CLOSE_STATUS.OPEN ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleRequestSignature}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Request signature'}
              </button>
            ) : null}
            {canComplete ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleCompleteSignature}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Record internal signature'}
              </button>
            ) : null}
            {canRequestPayment &&
            (close.status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
              close.status === COMMERCIAL_CLOSE_STATUS.OPEN) ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleRequestPayment}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Request payment'}
              </button>
            ) : null}
            {canCompletePayment ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleCompletePayment}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Record internal payment'}
              </button>
            ) : null}
            {allowed.map((to) => (
              <button
                key={to}
                type="button"
                className={styles.publish}
                onClick={() => handleTransition(to)}
                disabled={busy}
              >
                {ACTION_LABELS[to] || COMMERCIAL_CLOSE_STATUS_LABELS[to] || to}
              </button>
            ))}
            {allowed.length === 0 &&
            !canRequest &&
            !canComplete &&
            !canRequestPayment &&
            !canCompletePayment ? (
              <p className={styles.muted}>No further transitions from this state.</p>
            ) : null}
          </div>
          <p className={styles.note}>
            Architectural signature and payment paths only. DocuSign, Stripe, and
            other vendors remain disconnected — digitalSignature, paymentProcessing,
            and paymentVendors stay false.
          </p>
          {evidence.length > 0 ? (
            <div className={styles.audit}>
              <p className={styles.kicker}>Signature evidence</p>
              <ul>
                {evidence.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.signerDisplayName || 'Signer'} · {item.method}
                      {item.binding?.proposalVersion != null
                        ? ` · rev ${item.binding.proposalVersion}`
                        : ''}
                    </span>
                    <span>{item.signedAt ? formatDateTime(item.signedAt) : '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {paymentEvidence.length > 0 ? (
            <div className={styles.audit}>
              <p className={styles.kicker}>Payment evidence</p>
              <ul>
                {paymentEvidence.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.payerDisplayName || 'Payer'} ·{' '}
                      {formatCurrency(item.amount, item.currency)} · {item.method}
                      {item.transactionReference
                        ? ` · ${item.transactionReference}`
                        : ''}
                      {item.binding?.proposalVersion != null
                        ? ` · rev ${item.binding.proposalVersion}`
                        : ''}
                    </span>
                    <span>{item.paidAt ? formatDateTime(item.paidAt) : '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {history.length > 0 ? (
            <div className={styles.audit}>
              <p className={styles.kicker}>State history</p>
              <ul>
                {history
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li key={entry.id}>
                      <span>
                        {entry.from || '—'} →{' '}
                        {COMMERCIAL_CLOSE_STATUS_LABELS[entry.to] ?? entry.to}
                      </span>
                      <span>{entry.at ? formatDateTime(entry.at) : '—'}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}
