import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ProposalContent from '../../components/ProposalContent/ProposalContent.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { getDisplayStatus, PROPOSAL_STATUS } from '../../models/proposal.js'
import { isProposalLocked } from '../../models/approval.js'
import {
  EMAIL_DELIVERY_STATUS_LABELS,
} from '../../models/emailDelivery.js'
import { getLastActivityAt, getViewCount } from '../../models/commercialQueues.js'
import { getClientPortalPath, getClientPortalUrl } from '../../utils/clientProposal.js'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format.js'
import { getLayout } from '../../layouts/registry.js'
import LayoutPicker from '../../layouts/screen/LayoutPicker.jsx'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import { useShareAccess } from '../../hooks/useShareAccess.js'
import {
  ProposalAnalyticsCard,
  ProposalCommentsSection,
  ProposalPaymentCard,
  ProposalSignatureCard,
  ProposalTimeline,
} from './ProposalCommercial.jsx'
import styles from './ProposalDetailView.module.css'

function MetaItem({ label, children }) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{children}</dd>
    </div>
  )
}

function ShareLinkControls({ proposal, onProposalChange, disabled }) {
  const share = useShareAccess()
  const [password, setPassword] = useState('')
  const [rotated, setRotated] = useState(false)
  const access = proposal.shareAccess ?? {}
  const revoked = Boolean(access.revokedAt)
  const passwordSet = Boolean(access.passwordSet || access.passwordHash)
  const busy = disabled || share.submitting

  async function apply(patch) {
    const saved = await share.update(proposal.id, patch)
    if (saved) {
      setRotated(false)
      onProposalChange?.(saved)
    }
  }

  async function handleRotate() {
    const saved = await share.rotate(proposal.id)
    if (saved) {
      setRotated(true)
      onProposalChange?.(saved)
    }
  }

  return (
    <div className={styles.shareTools}>
      {share.error ? (
        <p className={styles.shareError} role="alert">
          {share.error.message}
        </p>
      ) : null}
      <p className={styles.shareStatus}>
        {revoked
          ? 'Link revoked — the current URL will not open the portal.'
          : passwordSet
            ? 'Password protected'
            : 'Anyone with the link can open this proposal'}
        {access.requireEmail ? ' · Email gate on' : ''}
        {access.accessExpiresAt ? ` · Access ends ${access.accessExpiresAt}` : ''}
        {rotated ? ' · New link issued; the previous URL no longer opens this proposal.' : ''}
      </p>
      <div className={styles.shareActions}>
        <button
          type="button"
          className={styles.history}
          onClick={() => apply({ revoked: !revoked })}
          disabled={busy}
        >
          {revoked ? 'Restore link' : 'Revoke link'}
        </button>
        <button
          type="button"
          className={styles.history}
          onClick={handleRotate}
          disabled={busy || revoked}
        >
          Rotate link
        </button>
        <label className={styles.shareCheck}>
          <input
            type="checkbox"
            checked={Boolean(access.requireEmail)}
            disabled={busy}
            onChange={(event) => apply({ requireEmail: event.target.checked })}
          />
          Require client email
        </label>
      </div>
      <div className={styles.shareFields}>
        <label className={styles.shareField}>
          Link password
          <input
            type="password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={passwordSet ? 'Password is set' : 'Optional'}
            autoComplete="new-password"
          />
        </label>
        <button
          type="button"
          className={styles.print}
          disabled={busy || !password.trim()}
          onClick={async () => {
            await apply({ password })
            setPassword('')
          }}
        >
          Set password
        </button>
        {passwordSet ? (
          <button
            type="button"
            className={styles.print}
            disabled={busy}
            onClick={() => apply({ clearPassword: true })}
          >
            Clear password
          </button>
        ) : null}
        <label className={styles.shareField}>
          Access expires
          <input
            type="date"
            value={access.accessExpiresAt ? String(access.accessExpiresAt).slice(0, 10) : ''}
            disabled={busy}
            onChange={(event) => apply({ accessExpiresAt: event.target.value || null })}
          />
        </label>
      </div>
    </div>
  )
}

function ProposalDetailView({
  proposal,
  onDuplicate,
  onDownloadPdf,
  onPrint,
  onSend,
  onArchive,
  archiving,
  onProposalChange,
  onOpenHistory,
  onOpenActivity,
  onLayoutChange,
  layoutSaving,
  exporting,
  exportError,
}) {
  const [linkCopied, setLinkCopied] = useState(false)
  const busy = Boolean(exporting) || Boolean(layoutSaving)
  const clientPath = getClientPortalPath(proposal.shareToken)

  useEffect(() => {
    setLinkCopied(false)
  }, [proposal.shareToken])

  async function handleCopyLink() {
    if (!proposal.shareToken) return
    const url = getClientPortalUrl(proposal.shareToken)
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      window.prompt('Copy client link', url)
    }
  }
  const hasFeedback = Boolean(proposal.clientFeedback?.trim())
  const layout = getLayout(proposal.layoutId)
  const locked = isProposalLocked(proposal)
  const emailStatus = proposal.lastEmail?.status
  const alreadySent = Boolean(proposal.lastEmail?.sentAt)
  const viewCount = getViewCount(proposal)

  return (
    <article className={styles.document}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.projectType}>{proposal.projectType}</p>
          <h2 className={styles.title}>{proposal.title}</h2>
        </div>

        <div className={styles.actions}>
          <StatusBadge status={getDisplayStatus(proposal)} />
          {emailStatus ? (
            <StatusBadge
              status={emailStatus}
              label={EMAIL_DELIVERY_STATUS_LABELS[emailStatus] ?? emailStatus}
            />
          ) : null}
          {locked ? null : (
            <button
              type="button"
              className={styles.duplicate}
              onClick={onSend}
              disabled={busy}
            >
              {alreadySent ? 'Resend proposal' : 'Send proposal'}
            </button>
          )}
          <button
            type="button"
            className={styles.download}
            onClick={onDownloadPdf}
            disabled={busy}
          >
            {exporting === 'download' ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button
            type="button"
            className={styles.print}
            onClick={onPrint}
            disabled={busy}
          >
            {exporting === 'print' ? 'Preparing print…' : 'Print proposal'}
          </button>
          <button
            type="button"
            className={styles.history}
            onClick={onOpenHistory}
            disabled={busy}
          >
            History
          </button>
          <button
            type="button"
            className={styles.history}
            onClick={onOpenActivity}
            disabled={busy}
          >
            Activity
          </button>
          <Link to={proposalEditPath(proposal.id)} className={styles.edit}>
            Edit proposal
          </Link>
          <button
            type="button"
            className={styles.duplicate}
            onClick={onDuplicate}
            disabled={busy}
          >
            Duplicate proposal
          </button>
          {onArchive && proposal.status !== PROPOSAL_STATUS.ARCHIVED ? (
            <button
              type="button"
              className={styles.history}
              onClick={onArchive}
              disabled={busy || archiving}
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          ) : null}
        </div>
      </header>

      {exportError ? (
        <p className={styles.exportError} role="alert">
          {exportError.message || 'Could not generate the PDF. Please try again.'}
        </p>
      ) : null}

      <dl className={styles.meta}>
        <MetaItem label="Client">{proposal.clientName || '—'}</MetaItem>
        <MetaItem label="Company">{proposal.company || '—'}</MetaItem>
        <MetaItem label="Owner">{proposal.ownerName || 'Studio'}</MetaItem>
        <MetaItem label="Email">{proposal.clientEmail || '—'}</MetaItem>
        <MetaItem label="Value">
          {formatCurrency(proposal.amount, proposal.currency)}
        </MetaItem>
        <MetaItem label="Valid until">{formatDate(proposal.validUntil)}</MetaItem>
        <MetaItem label="Created">{formatDate(proposal.createdAt)}</MetaItem>
        <MetaItem label="Updated">{formatDate(proposal.updatedAt)}</MetaItem>
        <MetaItem label="Last activity">
          {formatDateTime(getLastActivityAt(proposal))}
        </MetaItem>
        <MetaItem label="Last viewed">
          {formatDateTime(proposal.lastViewedAt)}
        </MetaItem>
        <MetaItem label="Views">{viewCount}</MetaItem>
        <MetaItem label="Email status">
          {emailStatus
            ? EMAIL_DELIVERY_STATUS_LABELS[emailStatus] ?? emailStatus
            : 'Not sent'}
        </MetaItem>
        <MetaItem label="Accepted">
          {formatDateTime(proposal.acceptedAt)}
        </MetaItem>
        <MetaItem label="Layout">{layout.label}</MetaItem>
      </dl>

      <section className={styles.share}>
        <div className={styles.shareRow}>
          <div className={styles.shareCopy}>
            <p className={styles.shareLabel}>Client portal</p>
            <p className={styles.shareUrl}>{clientPath}</p>
          </div>
          <div className={styles.shareActions}>
            <button
              type="button"
              className={styles.print}
              onClick={handleCopyLink}
              disabled={busy}
            >
              {linkCopied ? 'Link copied' : 'Copy client link'}
            </button>
            <Link to={clientPath} className={styles.edit} key={clientPath}>
              Open client page
            </Link>
          </div>
        </div>
        <ShareLinkControls
          proposal={proposal}
          onProposalChange={onProposalChange}
          disabled={busy}
        />
      </section>

      {hasFeedback ? (
        <section className={styles.feedback}>
          <h3 className={styles.feedbackTitle}>Client feedback</h3>
          <p className={styles.feedbackBody}>{proposal.clientFeedback}</p>
        </section>
      ) : null}

      <ProposalTimeline proposal={proposal} />
      <ProposalAnalyticsCard proposal={proposal} />
      <ProposalCommentsSection
        proposal={proposal}
        onProposalChange={onProposalChange}
      />
      <ProposalSignatureCard proposal={proposal} />
      <ProposalPaymentCard proposal={proposal} />

      <LayoutPicker
        value={proposal.layoutId}
        onChange={onLayoutChange}
        disabled={busy}
      />

      <ProposalContent proposal={proposal} includeCover showSignature />

      <Link to={PATH.PROPOSALS} className={styles.back}>
        Back to proposals
      </Link>
    </article>
  )
}

export default ProposalDetailView
