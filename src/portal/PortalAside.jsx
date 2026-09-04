import StatusBadge from '../components/StatusBadge/StatusBadge.jsx'
import {
  APPROVAL_STATUS_LABELS,
  canMutateClientFiles,
  getApprovalStatus,
} from '../models/approval.js'
import {
  hasCapability,
  PORTAL_CAPABILITY,
} from '../models/portalPermissions.js'
import { PORTAL_MODULE } from '../models/portalModules.js'
import { hasQuestionnaire, isQuestionnaireSubmitted } from '../models/questionnaire.js'
import { questionnaireProgress } from '../forms/progress.js'
import { countOpenThreads } from '../collaboration/threads.js'
import {
  PAYMENT_STATUS_LABELS,
} from '../models/payment.js'
import {
  SIGNATURE_STATUS,
  SIGNATURE_STATUS_LABELS,
} from '../models/signature.js'
import { formatCurrency } from '../utils/format.js'
import { usePortal } from './PortalContext.jsx'
import PortalDashboardModule from './PortalDashboardModule.jsx'
import PortalStatusPanel from './PortalStatusPanel.jsx'
import PortalActivity from './PortalActivity.jsx'
import PortalProgress from './PortalProgress.jsx'
import styles from './PortalAside.module.css'

function PortalAside({
  open,
  onOpenModule,
  onApprove,
  onDecline,
  onRequestChanges,
  onSign,
  onPay,
}) {
  const { proposal, capabilities } = usePortal()
  const approval = getApprovalStatus(proposal)
  const canApprove = hasCapability(capabilities, PORTAL_CAPABILITY.ACCEPT)
  const canDecline = hasCapability(capabilities, PORTAL_CAPABILITY.DECLINE)
  const canRevise = hasCapability(capabilities, PORTAL_CAPABILITY.REQUEST_REVISION)
  const form = proposal.questionnaire
  const hasForm = hasQuestionnaire(form)
  const uploads = proposal.uploads ?? []
  const openThreads = countOpenThreads(proposal.comments, { clientVisibleOnly: true })
  const signature = proposal.signature
  const payment = proposal.payment
  const locked = !canMutateClientFiles(proposal)

  return (
    <aside
      id="portal-aside"
      className={`${styles.aside} ${open ? styles.asideOpen : ''}`}
      aria-label="Client onboarding"
    >
      <PortalDashboardModule
        title="Status"
        icon="check"
        badge={APPROVAL_STATUS_LABELS[approval]}
      >
        <div className={styles.moduleHead}>
          <StatusBadge status={approval} label={APPROVAL_STATUS_LABELS[approval]} />
        </div>
        <PortalStatusPanel bare />
      </PortalDashboardModule>

      <PortalDashboardModule title="Progress" icon="clipboard" defaultOpen>
        <PortalProgress proposal={proposal} />
      </PortalDashboardModule>

      <PortalDashboardModule title="Activity" icon="clock">
        <PortalActivity bare />
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Questionnaire"
        icon="clipboard"
        badge={
          !hasForm
            ? 'None'
            : isQuestionnaireSubmitted(form)
              ? 'Submitted'
              : `${questionnaireProgress(form).percent}%`
        }
      >
        {hasForm ? (
          <>
            <p className={styles.copy}>
              {isQuestionnaireSubmitted(form)
                ? 'Your answers are locked. The studio can still review them.'
                : 'A short brief helps the studio lock scope before work begins.'}
            </p>
            <button
              type="button"
              className={styles.link}
              onClick={() => onOpenModule?.(PORTAL_MODULE.QUESTIONNAIRE)}
            >
              {isQuestionnaireSubmitted(form) ? 'View answers' : 'Open questionnaire'}
            </button>
          </>
        ) : (
          <p className={styles.empty}>No questionnaire on this proposal.</p>
        )}
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Files"
        icon="upload"
        badge={uploads.length ? String(uploads.length) : 'Empty'}
      >
        <p className={styles.copy}>
          {uploads.length
            ? `${uploads.length} file${uploads.length === 1 ? '' : 's'} attached to this proposal.`
            : 'Share logos, drawings, and references. Files stay on this proposal only.'}
        </p>
        <button
          type="button"
          className={styles.link}
          onClick={() => onOpenModule?.(PORTAL_MODULE.UPLOADS)}
        >
          {locked ? 'View files' : 'Open files'}
        </button>
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Comments"
        icon="message"
        badge={openThreads > 0 ? `${openThreads} open` : 'Open'}
      >
        <p className={styles.copy}>
          Ask a question or follow a conversation with the studio.
        </p>
        <button
          type="button"
          className={styles.link}
          onClick={() => onOpenModule?.(PORTAL_MODULE.COMMENTS)}
        >
          Open comments
        </button>
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Approval"
        icon="check"
        badge={APPROVAL_STATUS_LABELS[approval]}
      >
        <p className={styles.copy}>
          {proposal.approval?.summary ||
            (locked
              ? 'This proposal is locked.'
              : 'Approve when you are ready, or send the studio a revision note.')}
        </p>
        {canApprove || canDecline || canRevise ? (
          <div className={styles.actions}>
            {canApprove ? (
              <button type="button" className={styles.primary} onClick={onApprove}>
                Approve proposal
              </button>
            ) : null}
            {canDecline ? (
              <button type="button" className={styles.danger} onClick={onDecline}>
                Decline proposal
              </button>
            ) : null}
            {canRevise ? (
              <button type="button" className={styles.secondary} onClick={onRequestChanges}>
                Request changes
              </button>
            ) : null}
          </div>
        ) : (
          <p className={styles.empty}>Approval summary is complete.</p>
        )}
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Signature"
        icon="pen"
        badge={SIGNATURE_STATUS_LABELS[signature?.status] ?? 'Not requested'}
      >
        <p className={styles.copy}>
          {signature?.status === SIGNATURE_STATUS.WAITING
            ? 'Waiting for signature. Providers will be connected in a future release.'
            : signature?.status === SIGNATURE_STATUS.SIGNED
              ? `Signed${signature.signer ? ` by ${signature.signer}` : ''}.`
              : 'Signature providers are not connected yet. You can still open the placeholder.'}
        </p>
        <button type="button" className={styles.primary} onClick={onSign}>
          Sign proposal
        </button>
      </PortalDashboardModule>

      <PortalDashboardModule
        title="Payment"
        icon="card"
        badge={PAYMENT_STATUS_LABELS[payment?.status] ?? 'Not requested'}
      >
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Outstanding</dt>
            <dd>{formatCurrency(payment?.remainingBalance, payment?.currency || proposal.currency)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Deposit</dt>
            <dd>{formatCurrency(payment?.deposit, payment?.currency || proposal.currency)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Remaining</dt>
            <dd>{formatCurrency(payment?.remainingBalance, payment?.currency || proposal.currency)}</dd>
          </div>
        </dl>
        <button type="button" className={styles.primary} onClick={onPay}>
          Pay now
        </button>
      </PortalDashboardModule>
    </aside>
  )
}

export default PortalAside
