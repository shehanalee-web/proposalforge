import { useEffect, useId, useRef, useState } from 'react'
import { MAIL_ERROR_CODE } from '../../models/emailDelivery.js'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { useSendProposal } from '../../hooks/useSendProposal.js'
import { defaultProposalSubject } from '../../services/email/emailTemplates.js'
import { readRememberedSender, rememberSender } from '../../services/email/senderPrefs.js'
import { getClientPortalUrl } from '../../utils/clientProposal.js'
import styles from './SendProposalDialog.module.css'

function toDateInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInput(value) {
  if (!value) return null
  return new Date(`${value}T12:00:00.000Z`).toISOString()
}

function fieldError(error, field) {
  return error?.errors?.find((item) => item.field === field)?.message || ''
}

function SendProposalDialog({ proposal, open, onClose, onSent }) {
  const { kit } = useBrandKit()
  const { send, submitting, error, setError } = useSendProposal()
  const dialogRef = useRef(null)
  const titleId = useId()
  const studioName = kit?.companyName || kit?.contact?.legalName || 'Studio'

  const [fromName, setFromName] = useState(studioName)
  const [fromEmail, setFromEmail] = useState(kit?.contact?.email || '')
  const [to, setTo] = useState(proposal?.clientEmail || '')
  const [subject, setSubject] = useState(
    defaultProposalSubject(proposal?.title, studioName),
  )
  const [message, setMessage] = useState('')
  const [expiresOn, setExpiresOn] = useState(toDateInput(proposal?.validUntil))

  useEffect(() => {
    if (!open || !proposal) return
    const stored = readRememberedSender()
    const name = stored?.name || kit?.companyName || kit?.contact?.legalName || 'Studio'
    const email = stored?.email || kit?.contact?.email || ''
    setFromName(name)
    setFromEmail(email)
    setTo(proposal.clientEmail || '')
    setSubject(defaultProposalSubject(proposal.title, name))
    setMessage('')
    setExpiresOn(toDateInput(proposal.validUntil))
    setError(null)
  }, [open, proposal, kit, setError])

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  const previewUrl = proposal ? getClientPortalUrl(proposal.shareToken) : ''

  async function handleSubmit(event) {
    event.preventDefault()
    if (!proposal || submitting) return

    const sent = await send(proposal.id, {
      fromName,
      fromEmail,
      to,
      subject,
      message,
      expiresAt: fromDateInput(expiresOn),
      appUrl: window.location.origin,
    })

    if (!sent) return

    rememberSender({ name: fromName, email: fromEmail })
    onSent?.(sent)
    onClose?.()
  }

  const invalidHint =
    error?.code === MAIL_ERROR_CODE.INVALID_EMAIL
      ? error.message
      : error?.message

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose?.()
      }}
      onCancel={(event) => {
        if (submitting) event.preventDefault()
        else onClose?.()
      }}
    >
      <form className={styles.panel} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <p className={styles.kicker}>Delivery</p>
          <h2 id={titleId} className={styles.title}>
            Send proposal
          </h2>
          <p className={styles.lede}>
            This sends a branded email with a link to the client portal. The
            proposal is marked Sent only after the email is accepted by the
            provider.
          </p>
        </header>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Sender name</span>
            <input
              className={styles.input}
              value={fromName}
              onChange={(event) => setFromName(event.target.value)}
              autoComplete="name"
              disabled={submitting}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Sender email</span>
            <input
              className={styles.input}
              type="email"
              value={fromEmail}
              onChange={(event) => setFromEmail(event.target.value)}
              autoComplete="email"
              disabled={submitting}
              aria-invalid={Boolean(fieldError(error, 'fromEmail'))}
            />
            {fieldError(error, 'fromEmail') ? (
              <span className={styles.fieldError}>{fieldError(error, 'fromEmail')}</span>
            ) : null}
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Recipient</span>
          <input
            className={styles.input}
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            autoComplete="email"
            disabled={submitting}
            required
            aria-invalid={Boolean(fieldError(error, 'to'))}
          />
          {fieldError(error, 'to') ? (
            <span className={styles.fieldError}>{fieldError(error, 'to')}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Subject</span>
          <input
            className={styles.input}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={submitting}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Personal message</span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Optional note for the client"
            disabled={submitting}
          />
        </label>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Expiry date</span>
            <input
              className={styles.input}
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              disabled={submitting}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Preview link</span>
            <input
              className={styles.input}
              value={previewUrl}
              readOnly
              aria-readonly="true"
            />
          </label>
        </div>

        {error ? (
          <div className={styles.error} role="alert">
            <p className={styles.errorTitle}>Could not send</p>
            <p className={styles.errorText}>{invalidHint}</p>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className={styles.send} disabled={submitting}>
            {submitting ? 'Sending…' : error ? 'Retry' : 'Send proposal'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default SendProposalDialog
