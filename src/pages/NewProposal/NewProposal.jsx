import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PROJECT_TYPES } from '../../models/proposal.js'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import ProposalForm from './ProposalForm.jsx'
import styles from './NewProposal.module.css'

const EMPTY_FORM = {
  title: '',
  clientName: '',
  clientEmail: '',
  company: '',
  projectType: PROJECT_TYPES[0],
  amount: '',
  summary: '',
  validUntil: '',
}

function valuesFromDraft(draft) {
  if (!draft) return EMPTY_FORM

  return {
    title: draft.title ?? '',
    clientName: draft.clientName ?? '',
    clientEmail: draft.clientEmail ?? '',
    company: draft.company ?? '',
    projectType: draft.projectType ?? PROJECT_TYPES[0],
    amount: draft.amount ?? '',
    summary: draft.summary ?? '',
    validUntil: draft.validUntil ?? '',
  }
}

function toPayload(values, extras) {
  return {
    title: values.title,
    clientName: values.clientName,
    clientEmail: values.clientEmail,
    company: values.company,
    projectType: values.projectType,
    amount: values.amount === '' ? 0 : Number(values.amount),
    summary: values.summary,
    validUntil: values.validUntil || null,
    ...(extras.sections ? { sections: extras.sections } : {}),
    ...(extras.tags ? { tags: extras.tags } : {}),
  }
}

function NewProposal() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = location.state?.draft
  const { create, submitting, error, fieldErrors } = useCreateProposal()
  const [values, setValues] = useState(() => valuesFromDraft(draft))
  const extras = {
    sections: draft?.sections,
    tags: draft?.tags,
  }

  const requestError =
    error && Object.keys(fieldErrors).length === 0 ? error : null

  function handleChange(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const created = await create(toPayload(values, extras))

    if (created) {
      navigate('/history')
    }
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        {draft
          ? 'Review this copy, then save it as a new draft. Status, dates and id are not carried over.'
          : 'Capture the essentials and save a draft. You can send it to a client later.'}
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not create the proposal</p>
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
        />
      </div>
    </section>
  )
}

export default NewProposal
