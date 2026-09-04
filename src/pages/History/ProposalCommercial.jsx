import { useState } from 'react'
import ActivityTimeline from '../../components/ActivityTimeline/ActivityTimeline.jsx'
import CommentThread, {
  CommentComposer,
} from '../../components/Collaboration/CommentThread.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import {
  ACTIVITY_AUDIENCE,
  buildProposalTimeline,
} from '../../models/clientActivity.js'
import { COMMENT_AUTHOR, COMMENT_VISIBILITY } from '../../models/comment.js'
import {
  filterCommentThreads,
  groupCommentThreads,
  THREAD_FILTER,
} from '../../collaboration/threads.js'
import { useProposalCollaboration } from '../../hooks/useProposalCollaboration.js'
import {
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../models/payment.js'
import {
  SIGNATURE_PROVIDER_LABELS,
  SIGNATURE_STATUS_LABELS,
} from '../../models/signature.js'
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
} from '../../utils/format.js'
import styles from './ProposalCommercial.module.css'

function Card({ title, kicker, children }) {
  return (
    <section className={styles.card}>
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

export function ProposalTimeline({ proposal }) {
  const events = buildProposalTimeline(proposal, {
    audience: ACTIVITY_AUDIENCE.STUDIO,
  })

  return (
    <Card title="Timeline" kicker="Commercial">
      <ActivityTimeline
        withIcons
        events={events}
        clientLabel={proposal.clientName || 'Client'}
        studioLabel={proposal.ownerName || 'Studio'}
        empty="Events will appear as this proposal is sent, viewed, and decided."
      />
    </Card>
  )
}

export function ProposalAnalyticsCard({ proposal }) {
  const analytics = proposal.analytics ?? {}
  return (
    <Card title="Client views" kicker="Mock analytics">
      <dl className={styles.facts}>
        <Fact label="Sent">{analytics.sentCount || 0}</Fact>
        <Fact label="Opened">{analytics.openCount || 0}</Fact>
        <Fact label="View count">{analytics.viewCount || 0}</Fact>
        <Fact label="Last viewed">{formatDateTime(analytics.lastViewedAt || proposal.lastViewedAt)}</Fact>
        <Fact label="Device">{analytics.device}</Fact>
        <Fact label="Country">{analytics.country}</Fact>
        <Fact label="Browser">{analytics.browser}</Fact>
        <Fact label="Time spent">{formatDuration(analytics.timeSpentMs)}</Fact>
        <Fact label="Scroll">
          {analytics.scrollPercent ? `${analytics.scrollPercent}%` : '—'}
        </Fact>
      </dl>
      <p className={styles.note}>
        No tracking pixel is installed. Sessions are recorded when the client
        portal opens so a later analytics provider can replace this store.
      </p>
    </Card>
  )
}

export function ProposalSignatureCard({ proposal }) {
  const signature = proposal.signature
  return (
    <Card title="Signature" kicker="Preparation">
      <div className={styles.row}>
        <StatusBadge
          status={signature?.status}
          label={SIGNATURE_STATUS_LABELS[signature?.status] ?? 'Not requested'}
        />
        <span className={styles.muted}>
          {SIGNATURE_PROVIDER_LABELS[signature?.provider] || 'Internal'}
        </span>
      </div>
      <dl className={styles.facts}>
        <Fact label="Signer">{signature?.signer || proposal.clientName}</Fact>
        <Fact label="Signer email">{signature?.signerEmail || proposal.clientEmail}</Fact>
        <Fact label="Requested">{formatDateTime(signature?.requestedAt)}</Fact>
        <Fact label="Signed">{formatDateTime(signature?.signedAt)}</Fact>
        <Fact label="Declined">{formatDateTime(signature?.declinedAt)}</Fact>
      </dl>
      <div className={styles.placeholder}>
        Internal clickwrap. DocuSign and other vendors remain optional providers.
      </div>
      <p className={styles.note}>Audit trail</p>
      {(signature?.auditTrail ?? []).length === 0 ? (
        <p className={styles.muted}>No signature events recorded yet.</p>
      ) : (
        <ul className={styles.audit}>
          {signature.auditTrail.map((event) => (
            <li key={event.id}>
              <span>{event.detail || event.action}</span>
              <span>{formatDateTime(event.at)} · {event.actor}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function ProposalPaymentCard({ proposal }) {
  const payment = proposal.payment
  return (
    <Card title="Payments" kicker="Preparation">
      <div className={styles.row}>
        <StatusBadge
          status={payment?.status}
          label={PAYMENT_STATUS_LABELS[payment?.status] ?? 'Not requested'}
        />
        <span className={styles.muted}>
          {PAYMENT_PROVIDER_LABELS[payment?.provider] || 'Invoice'}
        </span>
      </div>
      <dl className={styles.facts}>
        <Fact label="Deposit">{formatCurrency(payment?.deposit, payment?.currency)}</Fact>
        <Fact label="Balance">{formatCurrency(payment?.balance ?? payment?.remainingBalance, payment?.currency)}</Fact>
        <Fact label="Paid">{formatCurrency(payment?.paidAmount, payment?.currency)}</Fact>
        <Fact label="Due">{formatDateTime(payment?.dueAt)}</Fact>
      </dl>
      {(payment?.schedule ?? []).length ? (
        <ul className={styles.audit}>
          {payment.schedule.map((item) => (
            <li key={item.id}>
              <span>
                {item.label} · {formatCurrency(item.amount, payment.currency)}
              </span>
              <span>{PAYMENT_STATUS_LABELS[item.status] || item.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.placeholder}>
        Invoice placeholder
        {payment?.invoice?.number ? ` · ${payment.invoice.number}` : ' · not issued'}
      </div>
      <p className={styles.note}>
        Pay Now records a mock payment on this proposal. Stripe and other
        gateways remain provider ids until a vendor is connected.
      </p>
    </Card>
  )
}

const COMMENT_FILTERS = [
  { id: THREAD_FILTER.ALL, label: 'All' },
  { id: THREAD_FILTER.CLIENT, label: 'Client' },
  { id: THREAD_FILTER.INTERNAL, label: 'Internal' },
  { id: THREAD_FILTER.OPEN, label: 'Open' },
  { id: THREAD_FILTER.RESOLVED, label: 'Resolved' },
  { id: THREAD_FILTER.PINNED, label: 'Pinned' },
]

export function ProposalCommentsSection({ proposal, onProposalChange }) {
  const flow = useProposalCollaboration({
    proposalId: proposal?.id,
    onProposalChange,
  })
  const [filter, setFilter] = useState(THREAD_FILTER.ALL)
  const [internalNote, setInternalNote] = useState(false)
  const threads = filterCommentThreads(groupCommentThreads(proposal?.comments), filter)

  async function handleNew(message) {
    const saved = await flow.addComment({
      message,
      visibility: internalNote
        ? COMMENT_VISIBILITY.INTERNAL
        : COMMENT_VISIBILITY.CLIENT,
    })
    return saved ? true : false
  }

  async function handleReply(threadId, message, options = {}) {
    const saved = await flow.addComment({
      message,
      parentId: threadId,
      visibility: options.visibility,
    })
    return saved ? true : false
  }

  return (
    <Card title="Comments" kicker="Studio">
      <div className={styles.filters}>
        {COMMENT_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.filter} ${filter === item.id ? styles.filterOn : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {flow.error ? (
        <p className={styles.note} role="alert">
          {flow.error.message}
        </p>
      ) : null}
      <CommentComposer
        placeholder={
          internalNote
            ? 'Internal note. Use @name to mention. The client will not see this.'
            : 'Write a client or internal comment. Use @name to mention…'
        }
        submitLabel={internalNote ? 'Add note' : 'Post'}
        disabled={flow.busy}
        onSubmit={handleNew}
        extra={
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={internalNote}
              onChange={(event) => setInternalNote(event.target.checked)}
            />
            Internal
          </label>
        }
      />
      {threads.length === 0 ? (
        <p className={styles.muted}>No comments in this filter yet.</p>
      ) : (
        threads.map((thread) => (
          <CommentThread
            key={thread.id}
            thread={thread}
            studio
            actorType={COMMENT_AUTHOR.INTERNAL}
            canReply
            canResolve={!thread.resolved}
            canReopen={thread.resolved}
            canPin
            disabled={flow.busy}
            onReply={handleReply}
            onResolve={(id) => flow.setResolved(id, true)}
            onReopen={(id) => flow.setResolved(id, false)}
            onPin={(id, pinned) => flow.setPinned(id, pinned)}
          />
        ))
      )}
    </Card>
  )
}
