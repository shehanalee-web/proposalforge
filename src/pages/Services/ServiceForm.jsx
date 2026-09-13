import { PRICING_MODEL, PRICING_MODELS, PRICING_MODEL_LABELS } from '../../models/service.js'
import {
  CONTENT_BLOCK_TYPE_LABELS,
  LIBRARY_BLOCK_STATUS,
} from '../../models/contentBlock.js'
import { useLibraryBlocks } from '../../hooks/useLibraryBlocks.js'
import styles from './ServiceForm.module.css'

function Field({ id, label, error, hint, className, children }) {
  const errorId = `${id}-error`

  return (
    <div className={`${styles.field} ${className ?? ''}`.trim()}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ServiceForm({
  values,
  onChange,
  onSubmit,
  onApplyToTemplate,
  submitting,
  applying = false,
  applyDisabled = false,
  fieldErrors = {},
  templates = [],
  submitLabel = 'Save service',
  submittingLabel = 'Saving…',
}) {
  const { blocks: library, loading: libraryLoading } = useLibraryBlocks()
  const selectedIds = values.contentBlockIds ?? []
  const published = library.filter(
    (block) => block.status === LIBRARY_BLOCK_STATUS.PUBLISHED,
  )
  const busy = submitting || applying

  function handleChange(event) {
    onChange(event.target.name, event.target.value)
  }

  function toggleContentBlock(id) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id]
    onChange('contentBlockIds', next)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.grid}>
        <Field id="name" label="Name" error={fieldErrors.name}>
          <input
            id="name"
            name="name"
            type="text"
            className={styles.input}
            value={values.name}
            onChange={handleChange}
            disabled={busy}
            autoComplete="off"
            required
            aria-invalid={Boolean(fieldErrors.name)}
          />
        </Field>

        <Field id="pricingModel" label="Pricing model" error={fieldErrors.pricingModel}>
          <select
            id="pricingModel"
            name="pricingModel"
            className={styles.input}
            value={values.pricingModel || PRICING_MODEL.FIXED}
            onChange={handleChange}
            disabled={busy}
          >
            {PRICING_MODELS.map((model) => (
              <option key={model} value={model}>
                {PRICING_MODEL_LABELS[model]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="description"
          label="Description"
          error={fieldErrors.description}
          className={styles.span2}
        >
          <textarea
            id="description"
            name="description"
            rows={3}
            className={`${styles.input} ${styles.textarea}`}
            value={values.description}
            onChange={handleChange}
            disabled={busy}
          />
        </Field>

        <Field
          id="defaultDescription"
          label="Default proposal language"
          hint="Copied into a new proposal when this service is selected."
          error={fieldErrors.defaultDescription}
          className={styles.span2}
        >
          <textarea
            id="defaultDescription"
            name="defaultDescription"
            rows={3}
            className={`${styles.input} ${styles.textarea}`}
            value={values.defaultDescription}
            onChange={handleChange}
            disabled={busy}
          />
        </Field>

        <Field id="typicalDuration" label="Typical duration" error={fieldErrors.typicalDuration}>
          <input
            id="typicalDuration"
            name="typicalDuration"
            type="text"
            className={styles.input}
            value={values.typicalDuration}
            onChange={handleChange}
            disabled={busy}
            placeholder="Six weeks"
          />
        </Field>

        <Field
          id="templateId"
          label="Default template"
          hint="Create Proposal copies this template. Leave blank to start empty."
          error={fieldErrors.templateId}
        >
          <select
            id="templateId"
            name="templateId"
            className={styles.input}
            value={values.templateId}
            onChange={handleChange}
            disabled={busy}
          >
            <option value="">None</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="contentBlockIds"
          label="Default components"
          hint="Content Library records to compose into the default template. Save stores IDs only."
          error={fieldErrors.contentBlockIds}
          className={styles.span2}
        >
          {libraryLoading ? (
            <p className={styles.hint}>Loading Content Library…</p>
          ) : published.length === 0 ? (
            <p className={styles.hint}>No published Content Library blocks yet.</p>
          ) : (
            <ul className={styles.libraryList}>
              {published.map((block) => {
                const checked = selectedIds.includes(block.id)
                return (
                  <li key={block.id}>
                    <label className={styles.libraryOption}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContentBlock(block.id)}
                        disabled={busy}
                      />
                      <span>
                        {block.name}
                        <span className={styles.libraryMeta}>
                          {CONTENT_BLOCK_TYPE_LABELS[block.type] ?? block.type}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Field>

        <Field
          id="deliverables"
          label="Deliverables"
          hint="One per line. Stored on the service, not on each proposal until copied."
          error={fieldErrors.deliverables}
          className={styles.span2}
        >
          <textarea
            id="deliverables"
            name="deliverables"
            rows={4}
            className={`${styles.input} ${styles.textarea}`}
            value={values.deliverables}
            onChange={handleChange}
            disabled={busy}
          />
        </Field>
      </div>

      <div className={styles.actions}>
        {onApplyToTemplate ? (
          <button
            type="button"
            className={styles.apply}
            onClick={onApplyToTemplate}
            disabled={busy || applyDisabled}
          >
            {applying ? 'Applying…' : 'Apply Default Components to Template'}
          </button>
        ) : null}
        <button type="submit" className={styles.submit} disabled={busy}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default ServiceForm
