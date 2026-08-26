import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PROJECT_TYPES } from '../../models/proposal.js'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import { proposalFromTemplate } from '../../utils/proposalFromTemplate.js'
import ProposalForm from './ProposalForm.jsx'
import TemplatePicker from './TemplatePicker.jsx'
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

function extrasFromDraft(draft) {
  if (!draft) return {}

  const extras = {}

  if (draft.sections) extras.sections = draft.sections
  if (draft.tags) extras.tags = draft.tags
  if (draft.items) extras.items = draft.items
  if (draft.terms != null) extras.terms = draft.terms
  if (draft.notes != null) extras.notes = draft.notes

  return extras
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
    ...extras,
  }
}

function NewProposal() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationDraft = location.state?.draft
  const locationSource = location.state?.source
  const { create, submitting, error, fieldErrors } = useCreateProposal()

  const [step, setStep] = useState(() => (locationDraft ? 'form' : 'choose'))
  const [localDraft, setLocalDraft] = useState(null)
  const [source, setSource] = useState(locationSource ?? null)
  const [values, setValues] = useState(() => valuesFromDraft(locationDraft))

  const draft = localDraft ?? locationDraft
  const extras = extrasFromDraft(draft)
  const fromTemplate = source === 'template'

  const requestError =
    error && Object.keys(fieldErrors).length === 0 ? error : null

  function handleChange(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function startBlank() {
    setLocalDraft(null)
    setSource(null)
    setValues(EMPTY_FORM)
    setStep('form')
  }

  function startFromTemplate(template) {
    const next = proposalFromTemplate(template)
    setLocalDraft(next)
    setSource('template')
    setValues(valuesFromDraft(next))
    setStep('form')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const created = await create(toPayload(values, extras))

    if (created) {
      navigate('/history')
    }
  }

  function introText() {
    if (fromTemplate) {
      return 'This draft is filled from a template. Add client details, then save. The original template is not changed.'
    }

    if (draft) {
      return 'Review this copy, then save it as a new draft. Status, dates and id are not carried over.'
    }

    return 'Capture the essentials and save a draft. You can send it to a client later.'
  }

  if (step === 'choose') {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>
          Start from a blank proposal, or copy a template so the body and
          pricing are already filled in.
        </p>

        <div className={styles.choices}>
          <button type="button" className={styles.choice} onClick={startBlank}>
            <h2 className={styles.choiceTitle}>Blank proposal</h2>
            <p className={styles.choiceText}>
              Start with empty fields and write the proposal from scratch.
            </p>
          </button>
          <button
            type="button"
            className={styles.choice}
            onClick={() => setStep('pick-template')}
          >
            <h2 className={styles.choiceTitle}>Create from template</h2>
            <p className={styles.choiceText}>
              Copy sections, line items, pricing, terms and notes into a new
              proposal.
            </p>
          </button>
        </div>
      </section>
    )
  }

  if (step === 'pick-template') {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>
          Choose a template. Its contents are copied into a new proposal — later
          edits never write back to the template.
        </p>
        <button
          type="button"
          className={styles.back}
          onClick={() => setStep('choose')}
        >
          Back to choices
        </button>
        <TemplatePicker onSelect={startFromTemplate} />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>{introText()}</p>

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
