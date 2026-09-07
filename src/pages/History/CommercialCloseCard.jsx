import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../../workflow/actors.js'
import { PROPOSAL_STATUS } from '../../models/proposal.js'
import {
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

/**
 * Studio surface for H15.1 Commercial Close.
 * Opens a close from the locked H14 decision. No signature/payment UI.
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

  const close = state?.close
  const decision = close?.decision

  return (
    <Card title="Commercial close" kicker="H15.1">
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
      </dl>

      <div className={styles.row}>
        <button
          type="button"
          className={styles.publish}
          onClick={handleOpen}
          disabled={busy || !proposalId || !accepted || Boolean(close)}
        >
          {busy ? 'Opening…' : close ? 'Already open' : 'Open commercial close'}
        </button>
        <p className={styles.note}>
          Binds the locked living decision for later signature and payment.
          Does not change proposal content or enable vendors.
        </p>
      </div>
    </Card>
  )
}
