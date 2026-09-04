import Icon from '../components/Icon/Icon.jsx'
import StatusBadge from '../components/StatusBadge/StatusBadge.jsx'
import {
  APPROVAL_STATUS_LABELS,
  getApprovalStatus,
} from '../models/approval.js'
import { formatCurrency, formatDate, formatDateTime } from '../utils/format.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalAside.module.css'

function Row({ label, children }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function PortalStatusPanel({ bare = false }) {
  const { proposal, readOnly } = usePortal()
  const status = getApprovalStatus(proposal)
  const version =
    proposal.currentVersion > 0 ? `v${proposal.currentVersion}` : 'Current'

  const body = (
    <>
      <dl className={styles.list}>
        <Row label="Proposal">{APPROVAL_STATUS_LABELS[status] ?? status}</Row>
        <Row label="Prepared for">{proposal.clientName || '—'}</Row>
        <Row label="Company">{proposal.company || '—'}</Row>
        <Row label="Investment">
          {formatCurrency(proposal.amount, proposal.currency)}
        </Row>
        <Row label="Valid until">{formatDate(proposal.validUntil)}</Row>
        <Row label="Last opened">{formatDateTime(proposal.lastViewedAt)}</Row>
        <Row label="Version">{version}</Row>
      </dl>

      {readOnly ? (
        <p className={styles.lock}>
          <Icon name="lock" size={13} />
          This document is read-only. Content can only be edited in the studio.
        </p>
      ) : null}
    </>
  )

  if (bare) return body

  return (
    <section className={styles.panel} aria-labelledby="portal-status-heading">
      <header className={styles.head}>
        <p className={styles.kicker} id="portal-status-heading">
          Status
        </p>
        <StatusBadge status={status} label={APPROVAL_STATUS_LABELS[status]} />
      </header>
      {body}
    </section>
  )
}

export default PortalStatusPanel
