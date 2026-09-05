import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import { useGenerateProposal } from '../../hooks/useGenerateProposal.js'
import {
  GENERATION_STATUS,
  GENERATION_STATUS_LABELS,
  GENERATOR_PROPOSAL_TYPES,
  GENERATOR_SECTION_LABELS,
} from '../../generate/types.js'
import { requiredInputErrors } from '../../generate/inputs.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './ProposalAi.module.css'

const EMPTY_FORM = {
  proposalType: 'Architectural Model',
  clientName: '',
  industry: '',
  primaryObjective: '',
  clientContact: '',
  clientLocation: '',
  projectDescription: '',
  scope: '',
  deliverables: '',
  timeline: '',
  pricing: '',
  assumptions: '',
  exclusions: '',
  warranty: '',
  specialRequirements: '',
  notes: '',
  companyTone: '',
  brandVoice: '',
}

function Field({ id, label, required, children, hint }) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>
        {label}
        {required ? <em> Required</em> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

function StatusList({ status }) {
  const steps = [
    GENERATION_STATUS.PREPARING,
    GENERATION_STATUS.RETRIEVING_KNOWLEDGE,
    GENERATION_STATUS.GENERATING,
    GENERATION_STATUS.VALIDATING,
  ]
  return (
    <ol className={styles.statusList} aria-label="Generation progress">
      {steps.map((step) => {
        const current = status === step
        const done =
          steps.indexOf(status) > steps.indexOf(step) ||
          status === GENERATION_STATUS.COMPLETE
        return (
          <li
            key={step}
            className={current ? styles.statusCurrent : done ? styles.statusDone : ''}
            aria-current={current ? 'step' : undefined}
          >
            {GENERATION_STATUS_LABELS[step]}
          </li>
        )
      })}
    </ol>
  )
}

function ProposalAi() {
  const navigate = useNavigate()
  const { create, submitting } = useCreateProposal()
  const generator = useGenerateProposal()
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})

  const request = useMemo(
    () => ({
      companyId: DEFAULT_COMPANY_ID,
      ...form,
      deliverables: form.deliverables,
    }),
    [form],
  )

  const preview = generator.result
  const draft = preview?.draft
  const creating = submitting || generator.status === GENERATION_STATUS.CREATING_PROPOSAL

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleGenerate(event) {
    event.preventDefault()
    const errors = requiredInputErrors(form)
    if (errors.length > 0) {
      setFieldErrors(Object.fromEntries(errors.map((entry) => [entry.field, entry.message])))
      return
    }
    setFieldErrors({})
    await generator.run(request)
  }

  async function handleCreate() {
    if (!preview?.proposalPayload || creating) return
    const created = await create(preview.proposalPayload)
    if (created) navigate(proposalEditPath(created.id), { replace: true })
  }

  const busy = generator.busy || creating
  const showPreview = generator.status === GENERATION_STATUS.COMPLETE && draft
  const showFailed = generator.status === GENERATION_STATUS.FAILED
  const showProgress =
    generator.busy && generator.status !== GENERATION_STATUS.CREATING_PROPOSAL

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <Icon name="spark" size={16} />
          </span>
          <div>
            <p className={styles.kicker}>Create proposal</p>
            <h1 className={styles.heading}>Generate Proposal</h1>
          </div>
        </div>
        <Link to={PATH.DASHBOARD} className={styles.close}>
          Back
        </Link>
      </header>

      <div className={styles.stage}>
        <section className={styles.main} aria-label="Generator setup">
          <p className={styles.lede}>
            Enter structured facts. Approved company knowledge fills known studio
            language. AI writes the wording — it does not invent prices, timelines,
            or legal commitments.
          </p>

          <form className={styles.form} onSubmit={handleGenerate}>
            <fieldset className={styles.fieldset} disabled={busy}>
              <legend>Required facts</legend>
              <div className={styles.row}>
                <Field id="proposalType" label="Proposal type" required>
                  <select
                    id="proposalType"
                    value={form.proposalType}
                    onChange={(event) => update('proposalType', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.proposalType)}
                  >
                    {GENERATOR_PROPOSAL_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="clientName" label="Client name" required>
                  <input
                    id="clientName"
                    value={form.clientName}
                    onChange={(event) => update('clientName', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.clientName)}
                    autoComplete="organization"
                  />
                </Field>
                <Field id="industry" label="Industry" required>
                  <input
                    id="industry"
                    value={form.industry}
                    onChange={(event) => update('industry', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.industry)}
                  />
                </Field>
              </div>
              <Field id="primaryObjective" label="Primary objective" required>
                <textarea
                  id="primaryObjective"
                  rows={3}
                  value={form.primaryObjective}
                  onChange={(event) => update('primaryObjective', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.primaryObjective)}
                />
              </Field>
            </fieldset>

            <fieldset className={styles.fieldset} disabled={busy}>
              <legend>Optional facts</legend>
              <div className={styles.row}>
                <Field id="clientContact" label="Client contact">
                  <input
                    id="clientContact"
                    value={form.clientContact}
                    onChange={(event) => update('clientContact', event.target.value)}
                  />
                </Field>
                <Field id="clientLocation" label="Client location">
                  <input
                    id="clientLocation"
                    value={form.clientLocation}
                    onChange={(event) => update('clientLocation', event.target.value)}
                  />
                </Field>
              </div>
              <Field
                id="projectDescription"
                label="Project description"
                hint="User-provided facts. Not AI language."
              >
                <textarea
                  id="projectDescription"
                  rows={3}
                  value={form.projectDescription}
                  onChange={(event) => update('projectDescription', event.target.value)}
                />
              </Field>
              <Field id="scope" label="Scope">
                <textarea
                  id="scope"
                  rows={3}
                  value={form.scope}
                  onChange={(event) => update('scope', event.target.value)}
                />
              </Field>
              <Field
                id="deliverables"
                label="Deliverables"
                hint="One per line. Leave blank if unknown."
              >
                <textarea
                  id="deliverables"
                  rows={3}
                  value={form.deliverables}
                  onChange={(event) => update('deliverables', event.target.value)}
                />
              </Field>
              <div className={styles.row}>
                <Field id="timeline" label="Timeline">
                  <input
                    id="timeline"
                    value={form.timeline}
                    onChange={(event) => update('timeline', event.target.value)}
                    placeholder="Leave blank if unknown"
                  />
                </Field>
                <Field id="pricing" label="Budget / pricing">
                  <input
                    id="pricing"
                    value={form.pricing}
                    onChange={(event) => update('pricing', event.target.value)}
                    placeholder="Leave blank if unknown"
                  />
                </Field>
              </div>
              <Field id="assumptions" label="Assumptions">
                <textarea
                  id="assumptions"
                  rows={2}
                  value={form.assumptions}
                  onChange={(event) => update('assumptions', event.target.value)}
                />
              </Field>
              <Field id="exclusions" label="Exclusions">
                <textarea
                  id="exclusions"
                  rows={2}
                  value={form.exclusions}
                  onChange={(event) => update('exclusions', event.target.value)}
                />
              </Field>
              <Field id="warranty" label="Warranty">
                <textarea
                  id="warranty"
                  rows={2}
                  value={form.warranty}
                  onChange={(event) => update('warranty', event.target.value)}
                />
              </Field>
              <Field id="specialRequirements" label="Special requirements">
                <textarea
                  id="specialRequirements"
                  rows={2}
                  value={form.specialRequirements}
                  onChange={(event) => update('specialRequirements', event.target.value)}
                />
              </Field>
              <Field id="notes" label="Notes">
                <textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                />
              </Field>
              <div className={styles.row}>
                <Field id="companyTone" label="Company tone">
                  <input
                    id="companyTone"
                    value={form.companyTone}
                    onChange={(event) => update('companyTone', event.target.value)}
                    placeholder="Uses the existing brand voice system"
                  />
                </Field>
                <Field id="brandVoice" label="Brand voice">
                  <input
                    id="brandVoice"
                    value={form.brandVoice}
                    onChange={(event) => update('brandVoice', event.target.value)}
                  />
                </Field>
              </div>
            </fieldset>

            {Object.keys(fieldErrors).length > 0 ? (
              <p className={styles.error} role="alert">
                {Object.values(fieldErrors)[0]}
              </p>
            ) : null}

            <div className={styles.sticky}>
              <button type="submit" className={styles.primary} disabled={busy}>
                Generate proposal
              </button>
              {generator.busy ? (
                <button type="button" className={styles.secondary} onClick={generator.cancel}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className={styles.preview} aria-label="Generation review">
          <div
            className={styles.live}
            aria-live="polite"
            aria-atomic="true"
          >
            {GENERATION_STATUS_LABELS[generator.status] || 'Idle'}
          </div>

          {showProgress ? (
            <div className={styles.card}>
              <p className={styles.cardKicker}>Working</p>
              <h2 className={styles.cardTitle}>Building a structured draft</h2>
              <StatusList status={generator.status} />
              <button type="button" className={styles.secondary} onClick={generator.cancel}>
                Cancel generation
              </button>
            </div>
          ) : null}

          {showFailed ? (
            <div className={styles.card}>
              <p className={styles.cardKicker}>Generation failed</p>
              <h2 className={styles.cardTitle}>Nothing was created</h2>
              <p className={styles.cardText}>
                The workspace is unchanged. Retry uses the same facts.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={() => generator.retry()}>
                  Retry
                </button>
                <button type="button" className={styles.secondary} onClick={generator.reset}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {showPreview ? (
            <div className={styles.card}>
              <p className={styles.cardKicker}>Review before creating</p>
              <h2 className={styles.cardTitle}>{draft.title}</h2>
              <p className={styles.cardText}>
                {draft.metadata?.clientName} · {draft.metadata?.proposalType}
              </p>

              <p className={styles.sectionsLabel}>Sections generated</p>
              <ul className={styles.chips}>
                {(draft.sections ?? []).map((section) => (
                  <li key={section.type} className={styles.chip}>
                    {GENERATOR_SECTION_LABELS[section.type] ?? section.title}
                  </li>
                ))}
              </ul>

              <p className={styles.sectionsLabel}>Knowledge used</p>
              {(draft.knowledgeUsed ?? []).length === 0 ? (
                <p className={styles.cardText}>No approved knowledge matched this brief.</p>
              ) : (
                <ul className={styles.sources}>
                  {draft.knowledgeUsed.map((item) => (
                    <li key={item.id}>{item.title}</li>
                  ))}
                </ul>
              )}

              {(draft.warnings ?? []).length > 0 ? (
                <ul className={styles.warnings} aria-label="Generation warnings">
                  {draft.warnings.map((warning) => (
                    <li key={warning.code}>
                      <strong>{warning.message}</strong>
                      <span>{warning.action}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create proposal'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => generator.retry()}
                  disabled={creating}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={generator.reset}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {!showPreview && !showFailed && !showProgress ? (
            <div className={styles.card}>
              <p className={styles.cardKicker}>Facts first</p>
              <h2 className={styles.cardTitle}>No proposal is created until you review</h2>
              <p className={styles.cardText}>
                Missing pricing and timeline stay “To be confirmed”. Draft and archived
                knowledge never enter this context.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export default ProposalAi
