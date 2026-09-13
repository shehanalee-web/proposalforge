import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  PRICING_MODEL,
  buildServiceEditorPayload,
  findTemplateForService,
} from '../../models/service.js'
import { useService } from '../../hooks/useService.js'
import { useCreateService } from '../../hooks/useCreateService.js'
import { useUpdateService } from '../../hooks/useUpdateService.js'
import { useTemplates } from '../../hooks/useTemplates.js'
import { PATH } from '../../workspace/paths.js'
import { applyServiceComponentsToTemplate } from '../../utils/templateBlocks.js'
import ServiceForm from './ServiceForm.jsx'
import styles from './ServiceEditor.module.css'

const SKELETON_ROWS = 4

const EMPTY_FORM = {
  name: '',
  description: '',
  defaultDescription: '',
  pricingModel: PRICING_MODEL.FIXED,
  typicalDuration: '',
  templateId: '',
  deliverables: '',
  contentBlockIds: [],
}

function valuesFromService(service) {
  return {
    name: service.name ?? '',
    description: service.description ?? '',
    defaultDescription: service.defaultDescription ?? '',
    pricingModel: service.pricingModel ?? PRICING_MODEL.FIXED,
    typicalDuration: service.typicalDuration ?? '',
    templateId: service.templateId ?? '',
    deliverables: (service.deliverables ?? []).join('\n'),
    contentBlockIds: [...(service.contentBlockIds ?? [])],
  }
}

function ServiceEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { service, loading, error, notFound, refetch } = useService(id)
  const { templates } = useTemplates()
  const createFlow = useCreateService()
  const updateFlow = useUpdateService()

  const { submitting, error: saveError, fieldErrors } = isNew
    ? createFlow
    : updateFlow

  const [draft, setDraft] = useState(isNew ? EMPTY_FORM : null)
  const values = draft ?? (service && !isNew ? valuesFromService(service) : null)

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState(null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  const linkedTemplate = values
    ? findTemplateForService(templates, {
        id: service?.id ?? '',
        templateId: values.templateId,
      })
    : undefined

  function handleChange(name, value) {
    if (!values) return
    setDraft({ ...values, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!values) return

    const payload = buildServiceEditorPayload(values)
    const saved = isNew
      ? await createFlow.create(payload)
      : await updateFlow.update(id, payload)

    if (saved) {
      navigate(PATH.SERVICES)
    }
  }

  async function handleApplyToTemplate() {
    if (!values || applying || submitting) return

    setApplying(true)
    setApplyError(null)

    try {
      const serviceLike = {
        id: service?.id ?? '',
        templateId: values.templateId,
        contentBlockIds: values.contentBlockIds,
      }
      await applyServiceComponentsToTemplate(templates, serviceLike)
    } catch (caught) {
      setApplyError(caught)
    } finally {
      setApplying(false)
    }
  }

  if (!isNew && notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Service not found</p>
          <p className={styles.stateText}>
            This service does not exist, or it was lost when the app reloaded.
          </p>
          <Link to={PATH.SERVICES} className={styles.action}>
            Back to services
          </Link>
        </div>
      </section>
    )
  }

  if (!isNew && error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this service</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the service.'}
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
        <p className={styles.intro}>Loading service…</p>
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
          ? 'Add an offering to the catalogue. Create Proposal will use it instead of a hardcoded project type.'
          : 'Changes apply to future proposals. Documents already created keep the values they were sent with.'}
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>
            {isNew ? 'Could not create the service' : 'Could not save the service'}
          </p>
          <p className={styles.bannerText}>
            {requestError.message || 'Something went wrong. Please try again.'}
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={handleSubmit}
            disabled={submitting || applying}
          >
            Try again
          </button>
        </div>
      ) : null}

      {applyError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not apply default components</p>
          <p className={styles.bannerText}>
            {applyError.message || 'Something went wrong. Please try again.'}
          </p>
        </div>
      ) : null}

      <div className={styles.panel}>
        <ServiceForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onApplyToTemplate={handleApplyToTemplate}
          submitting={submitting}
          applying={applying}
          applyDisabled={!linkedTemplate}
          fieldErrors={fieldErrors}
          templates={templates}
          submitLabel={isNew ? 'Create service' : 'Save changes'}
          submittingLabel={isNew ? 'Creating…' : 'Saving…'}
        />
      </div>
    </section>
  )
}

export default ServiceEditor
