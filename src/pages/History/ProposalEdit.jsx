import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PROJECT_TYPES } from '../../models/proposal.js'
import { useProposal } from '../../hooks/useProposal.js'
import { useUpdateProposal } from '../../hooks/useUpdateProposal.js'
import ProposalForm from '../NewProposal/ProposalForm.jsx'
import styles from './ProposalEdit.module.css'

const SKELETON_ROWS = 4

function valuesFromProposal(proposal) {
  return {
    title: proposal.title ?? '',
    clientName: proposal.clientName ?? '',
    clientEmail: proposal.clientEmail ?? '',
    company: proposal.company ?? '',
    projectType: proposal.projectType ?? PROJECT_TYPES[0],
    amount: Number.isFinite(proposal.amount) ? String(proposal.amount) : '',
    summary: proposal.summary ?? '',
    validUntil: proposal.validUntil ?? '',
  }
}

/**
 * Fields the edit form is allowed to send. Everything else on the stored
 * record — status, currency, sections, tags, and any future document body —
 * is omitted so `updateProposal` keeps the existing values.
 */
function toEditableChanges(values) {
  return {
    title: values.title,
    clientName: values.clientName,
    clientEmail: values.clientEmail,
    company: values.company,
    projectType: values.projectType,
    amount: values.amount === '' ? 0 : Number(values.amount),
    summary: values.summary,
    validUntil: values.validUntil || null,
  }
}

function ProposalEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proposal, loading, error, notFound, refetch } = useProposal(id)
  const {
    update,
    submitting,
    error: saveError,
    fieldErrors,
  } = useUpdateProposal()

  const [draft, setDraft] = useState(null)
  const values = draft ?? (proposal ? valuesFromProposal(proposal) : null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function handleChange(name, value) {
    if (!values) return

    setDraft({ ...values, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!id || !values) return

    const updated = await update(id, toEditableChanges(values))

    if (updated) {
      navigate(`/history/${updated.id}`)
    }
  }

  if (notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Proposal not found</p>
          <p className={styles.stateText}>
            This proposal does not exist, or it was lost when the app reloaded.
          </p>
          <Link to="/history" className={styles.action}>
            Back to history
          </Link>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this proposal</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the proposal.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (loading || !values) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading proposal…</p>
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.skeletonRow} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        Update the essentials. Status, sections and tags are not on this form
        and will be left unchanged.
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not save the proposal</p>
          <p className={styles.bannerText}>
            {requestError.message || 'Something went wrong. Please try again.'}
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={handleSubmit}
            disabled={submitting}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className={styles.panel}>
        <ProposalForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          fieldErrors={fieldErrors}
          submitLabel="Save changes"
          submittingLabel="Saving…"
        />
      </div>
    </section>
  )
}

export default ProposalEdit
