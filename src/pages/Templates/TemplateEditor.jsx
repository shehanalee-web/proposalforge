import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTemplate } from '../../hooks/useTemplate.js'
import { useCreateTemplate } from '../../hooks/useCreateTemplate.js'
import { useUpdateTemplate } from '../../hooks/useUpdateTemplate.js'
import TemplateForm from './TemplateForm.jsx'
import styles from './TemplateEditor.module.css'

const SKELETON_ROWS = 5

const EMPTY_FORM = {
  title: '',
  description: '',
  sections: [],
  items: [],
  terms: '',
  notes: '',
}

function valuesFromTemplate(template) {
  return {
    title: template.title ?? '',
    description: template.description ?? '',
    sections: (template.sections ?? []).map((section) => ({
      id: section.id,
      heading: section.heading ?? '',
      body: section.body ?? '',
    })),
    items: (template.items ?? []).map((item) => ({
      id: item.id,
      description: item.description ?? '',
      amount: Number.isFinite(item.amount) ? String(item.amount) : '',
    })),
    terms: template.terms ?? '',
    notes: template.notes ?? '',
  }
}

function toPayload(values) {
  const sections = values.sections
    .filter((section) => section.heading.trim() || section.body.trim())
    .map((section) => ({
      id: section.id,
      heading: section.heading,
      body: section.body,
    }))

  const items = values.items
    .filter((item) => item.description.trim() || item.amount !== '')
    .map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount === '' ? 0 : Number(item.amount),
    }))

  return {
    title: values.title,
    description: values.description,
    sections,
    items,
    terms: values.terms,
    notes: values.notes,
  }
}

function TemplateEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { template, loading, error, notFound, refetch } = useTemplate(id)
  const createFlow = useCreateTemplate()
  const updateFlow = useUpdateTemplate()

  const { submitting, error: saveError, fieldErrors } = isNew
    ? createFlow
    : updateFlow

  const [draft, setDraft] = useState(isNew ? EMPTY_FORM : null)
  const values =
    draft ?? (template && !isNew ? valuesFromTemplate(template) : null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function handleChange(name, value) {
    if (!values) return

    setDraft({ ...values, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!values) return

    const payload = toPayload(values)
    const saved = isNew
      ? await createFlow.create(payload)
      : await updateFlow.update(id, payload)

    if (saved) {
      navigate('/templates')
    }
  }

  if (!isNew && notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Template not found</p>
          <p className={styles.stateText}>
            This template does not exist, or it was lost when the app reloaded.
          </p>
          <Link to="/templates" className={styles.action}>
            Back to templates
          </Link>
        </div>
      </section>
    )
  }

  if (!isNew && error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this template</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the template.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (!isNew && (loading || !values)) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading template…</p>
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
        {isNew
          ? 'Save reusable sections, pricing and terms. Using a template later copies this data into a new proposal.'
          : 'Changes apply only to this template. Proposals already created from it are left unchanged.'}
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>
            {isNew ? 'Could not create the template' : 'Could not save the template'}
          </p>
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
        <TemplateForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          fieldErrors={fieldErrors}
          submitLabel={isNew ? 'Create template' : 'Save changes'}
          submittingLabel={isNew ? 'Creating…' : 'Saving…'}
        />
      </div>
    </section>
  )
}

export default TemplateEditor
