import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import StatusBadge from '../StatusBadge/StatusBadge.jsx'
import {
  APPROVAL_STATUS_LABELS,
  canMutateClientFiles,
  getApprovalStatus,
  isProposalLocked,
} from '../../models/approval.js'
import {
  PAYMENT_PROVIDER,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
} from '../../models/payment.js'
import {
  SIGNATURE_STATUS,
  SIGNATURE_STATUS_LABELS,
} from '../../models/signature.js'
import { PROPOSAL_STATUS_LABELS } from '../../models/proposal.js'
import { formatCurrency } from '../../utils/format.js'
import { useProposalClientWorkspace } from '../../hooks/useProposalUploads.js'
import { isPreviewableUpload, UPLOAD_KIND } from '../../models/upload.js'
import ViewerDialog from '../../viewer/ViewerDialog.jsx'
import {
  UploadDropzone,
  UploadFileRow,
  UploadProgress,
} from '../../uploads/UploadDropzone.jsx'
import styles from './ClientWorkspacePanel.module.css'

const TABS = [
  { id: 'files', label: 'Files' },
  { id: 'approval', label: 'Approval' },
  { id: 'signature', label: 'Signature' },
  { id: 'payment', label: 'Payment' },
]

function ClientWorkspacePanel({ proposal, open, onClose, onProposalChange }) {
  const flow = useProposalClientWorkspace({
    proposalId: proposal?.id,
    onProposalChange,
  })
  const [tab, setTab] = useState('files')
  const [pending, setPending] = useState([])
  const [preview, setPreview] = useState(null)
  const [deposit, setDeposit] = useState('')
  const [provider, setProvider] = useState(proposal?.payment?.provider ?? PAYMENT_PROVIDER.INVOICE)

  if (!open) return null

  const locked = isProposalLocked(proposal)
  const canMutate = canMutateClientFiles(proposal)
  const approval = getApprovalStatus(proposal)
  const uploads = proposal?.uploads ?? []
  const signature = proposal?.signature
  const payment = proposal?.payment

  async function handleFiles(files) {
    setPending(files.map((file) => ({ name: file.name, value: 32 })))
    await flow.addFiles(files)
    setPending((current) => current.map((item) => ({ ...item, value: 100 })))
    window.setTimeout(() => setPending([]), 220)
  }

  async function handlePayment(event) {
    event.preventDefault()
    await flow.savePayment({
      provider,
      deposit: deposit === '' ? payment?.deposit : Number(deposit),
      status:
        Number(deposit || payment?.deposit || 0) > 0
          ? PAYMENT_STATUS.DEPOSIT_DUE
          : payment?.status,
    })
  }

  return (
    <aside className={styles.panel} aria-label="Client workspace">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Studio</p>
          <h2 className={styles.title}>Client</h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close client workspace">
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.tab} ${tab === item.id ? styles.tabOn : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.scroll}>
        {flow.error ? (
          <p className={styles.banner} role="alert">
            {flow.error.message}
          </p>
        ) : null}

        {tab === 'files' ? (
          <div className={styles.stack}>
            <p className={styles.note}>
              Files belong to this proposal only. They never enter the Asset Library.
            </p>
            {canMutate ? (
              <UploadDropzone disabled={flow.busy} onFiles={handleFiles} />
            ) : (
              <p className={styles.note}>
                <Icon name="lock" size={13} /> This proposal is locked. Files can still be downloaded.
              </p>
            )}
            {pending.map((item) => (
              <UploadProgress key={item.name} label={item.name} value={item.value} />
            ))}
            {uploads.length === 0 ? (
              <p className={styles.empty}>No client files yet.</p>
            ) : (
              uploads.map((upload) => (
                <UploadFileRow
                  key={upload.id}
                  upload={upload}
                  canMutate={canMutate}
                  busy={flow.busy}
                  onPreview={setPreview}
                  onReplace={(item, file) => flow.replaceFile(item.id, file)}
                  onDelete={(item) => flow.removeFile(item.id)}
                />
              ))
            )}
          </div>
        ) : null}

        {tab === 'approval' ? (
          <div className={styles.stack}>
            <StatusBadge status={approval} label={APPROVAL_STATUS_LABELS[approval]} />
            <p className={styles.note}>
              Stored status: {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}.
              Clients approve, decline, or request changes. Studio can cancel an open proposal.
            </p>
            {proposal.approval?.summary ? (
              <p className={styles.copy}>{proposal.approval.summary}</p>
            ) : null}
            {!locked ? (
              <button
                type="button"
                className={styles.danger}
                disabled={flow.busy}
                onClick={() => flow.cancel()}
              >
                Cancel proposal
              </button>
            ) : (
              <p className={styles.note}>This proposal is locked.</p>
            )}
          </div>
        ) : null}

        {tab === 'signature' ? (
          <div className={styles.stack}>
            <p className={styles.copy}>
              {SIGNATURE_STATUS_LABELS[signature?.status] ?? 'Not requested'}
            </p>
            <p className={styles.note}>
              Providers are architecture-only. Requesting a signature marks the
              proposal as waiting — no vendor is contacted.
            </p>
            {signature?.status !== SIGNATURE_STATUS.SIGNED ? (
              <button
                type="button"
                className={styles.primary}
                disabled={flow.busy}
                onClick={() => flow.requestSignature()}
              >
                {signature?.status === SIGNATURE_STATUS.WAITING
                  ? 'Signature requested'
                  : 'Request signature'}
              </button>
            ) : (
              <p className={styles.note}>Signature completed.</p>
            )}
          </div>
        ) : null}

        {tab === 'payment' ? (
          <form className={styles.stack} onSubmit={handlePayment}>
            <p className={styles.copy}>
              {PAYMENT_STATUS_LABELS[payment?.status] ?? 'Not requested'} ·{' '}
              {formatCurrency(payment?.remainingBalance, payment?.currency)}
            </p>
            <label className={styles.field}>
              <span>Provider</span>
              <select
                className={styles.input}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {Object.values(PAYMENT_PROVIDER).map((id) => (
                  <option key={id} value={id}>
                    {PAYMENT_PROVIDER_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Deposit</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={deposit}
                placeholder={String(payment?.deposit ?? 0)}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </label>
            <p className={styles.note}>
              No gateway is connected. Saving metadata only.
            </p>
            <button type="submit" className={styles.primary} disabled={flow.busy}>
              {flow.busy ? 'Saving…' : 'Save payment'}
            </button>
          </form>
        ) : null}
      </div>

      {preview && isPreviewableUpload(preview) ? (
        <ViewerDialog
          open
          title={preview.name}
          onClose={() => setPreview(null)}
        >
          {preview.kind === UPLOAD_KIND.IMAGE ? (
            <img src={preview.url} alt={preview.name} style={{ width: '100%', borderRadius: '0.75rem' }} />
          ) : (
            <iframe title={preview.name} src={preview.url} style={{ width: '100%', minHeight: '22rem', border: 0 }} />
          )}
        </ViewerDialog>
      ) : null}
    </aside>
  )
}

export default ClientWorkspacePanel
