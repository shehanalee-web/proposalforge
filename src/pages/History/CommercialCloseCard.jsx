import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../../workflow/actors.js'
import { PROPOSAL_STATUS } from '../../models/proposal.js'
import {
  CLOSE_CONTRACT_STATUS_LABELS,
  CLOSE_INVOICE_STATUS_LABELS,
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
 * Studio surface for H15.1–H15.7 Commercial Close.
 * Opens a close, advances the state machine, records internal signatures/payments,
 * inspects provider-neutral contract/invoice architecture, and shows H15.7
 * requirement-driven completion readiness.
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

  async function handleRequestContract() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/contract/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not request contract.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not request contract.')
    } finally {
      setBusy(false)
    }
  }

  async function handleIssueContract() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/contract/issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not issue contract.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not issue contract.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestInvoice() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/invoice/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not request invoice.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not request invoice.')
    } finally {
      setBusy(false)
    }
  }

  async function handleIssueInvoice() {
    const closeId = state?.close?.id
    if (!closeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/commercial-close/${encodeURIComponent(closeId)}/invoice/issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, actorId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not issue invoice.')
        return
      }
      setState(payload)
    } catch {
      setError('Could not issue invoice.')
    } finally {
      setBusy(false)
    }
  }

  const close = state?.close
  const decision = close?.decision
  const signature = close?.signature
  const payment = close?.payment
  const contract = close?.contract
  const invoice = close?.invoice
  const completion = state?.completion
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
  const canManageArtifacts =
    close &&
    close.status !== COMMERCIAL_CLOSE_STATUS.CANCELLED &&
    close.status !== COMMERCIAL_CLOSE_STATUS.EXPIRED
  const closeBlocked =
    Boolean(completion) &&
    !completion.alreadyComplete &&
    completion.ready === false

  return (
    <Card title="Commercial close" kicker="H15.7">
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
        <Fact label="Completion ready">
          {completion
            ? completion.alreadyComplete
              ? 'Completed'
              : completion.ready
                ? 'Yes'
                : 'No'
            : '—'}
        </Fact>
        <Fact label="Completion blockers">
          {completion?.blockers?.length
            ? completion.blockers.join(', ')
            : completion
              ? 'None'
              : '—'}
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
        <Fact label="Contract status">
          {contract
            ? CLOSE_CONTRACT_STATUS_LABELS[contract.status] ?? contract.status
            : '—'}
        </Fact>
        <Fact label="Contract number">{contract?.record?.number || '—'}</Fact>
        <Fact label="Invoice status">
          {invoice
            ? CLOSE_INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status
            : '—'}
        </Fact>
        <Fact label="Invoice number">{invoice?.record?.number || '—'}</Fact>
        <Fact label="Invoice remaining">
          {invoice?.amountRemaining != null
            ? formatCurrency(invoice.amountRemaining, invoice.currency)
            : '—'}
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
            Binds the locked living decision for later signature, payment, contract,
            and invoice records. External providers are not connected yet.
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
            {canManageArtifacts && contract?.status !== 'issued' ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleRequestContract}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Draft contract'}
              </button>
            ) : null}
            {canManageArtifacts && contract?.status !== 'issued' ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleIssueContract}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Issue contract'}
              </button>
            ) : null}
            {canManageArtifacts && invoice?.status !== 'issued' ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleRequestInvoice}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Draft invoice'}
              </button>
            ) : null}
            {canManageArtifacts && invoice?.status !== 'issued' ? (
              <button
                type="button"
                className={styles.publish}
                onClick={handleIssueInvoice}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Issue invoice'}
              </button>
            ) : null}
            {allowed.map((to) => {
              const isCloseAction = to === COMMERCIAL_CLOSE_STATUS.CLOSED
              const disabled = busy || (isCloseAction && closeBlocked)
              return (
                <button
                  key={to}
                  type="button"
                  className={styles.publish}
                  onClick={() => handleTransition(to)}
                  disabled={disabled}
                  title={
                    isCloseAction && closeBlocked
                      ? completion?.reasons?.[0] ||
                        'Completion requirements are not satisfied.'
                      : undefined
                  }
                >
                  {ACTION_LABELS[to] || COMMERCIAL_CLOSE_STATUS_LABELS[to] || to}
                </button>
              )
            })}
            {closeBlocked && allowed.includes(COMMERCIAL_CLOSE_STATUS.CLOSED) ? (
              <p className={styles.note}>
                {completion?.reasons?.[0] ||
                  'Close is not ready to complete under current requirements.'}
              </p>
            ) : null}
            {allowed.length === 0 &&
            !canRequest &&
            !canComplete &&
            !canRequestPayment &&
            !canCompletePayment &&
            !(canManageArtifacts && contract?.status !== 'issued') &&
            !(canManageArtifacts && invoice?.status !== 'issued') ? (
              <p className={styles.muted}>No further transitions from this state.</p>
            ) : null}
          </div>
          <p className={styles.note}>
            Requirement-driven completion (H15.7): payment and artifacts are only
            required when marked required on this close. DocuSign, Stripe,
            accounting vendors, and other providers remain disconnected —
            digitalSignature, paymentProcessing, paymentVendors, and
            thirdPartyIntegrations stay false.
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
          {contract?.record ? (
            <div className={styles.audit}>
              <p className={styles.kicker}>Contract record</p>
              <ul>
                <li>
                  <span>
                    {contract.record.number || contract.record.id} ·{' '}
                    {formatCurrency(
                      contract.record.totalAmount,
                      contract.record.currency,
                    )}
                    {contract.record.binding?.proposalVersion != null
                      ? ` · rev ${contract.record.binding.proposalVersion}`
                      : ''}
                  </span>
                  <span>
                    {contract.record.issuedAt
                      ? formatDateTime(contract.record.issuedAt)
                      : '—'}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
          {invoice?.record ? (
            <div className={styles.audit}>
              <p className={styles.kicker}>Invoice record</p>
              <ul>
                <li>
                  <span>
                    {invoice.record.number || invoice.record.id} ·{' '}
                    {formatCurrency(invoice.record.total, invoice.record.currency)} ·
                    remaining{' '}
                    {formatCurrency(
                      invoice.record.amountRemaining,
                      invoice.record.currency,
                    )}
                    {invoice.record.binding?.proposalVersion != null
                      ? ` · rev ${invoice.record.binding.proposalVersion}`
                      : ''}
                  </span>
                  <span>
                    {invoice.record.issuedAt
                      ? formatDateTime(invoice.record.issuedAt)
                      : '—'}
                  </span>
                </li>
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
