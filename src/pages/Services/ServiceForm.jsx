import { PRICING_MODEL, PRICING_MODELS, PRICING_MODEL_LABELS } from '../../models/service.js'
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
  submitting,
  fieldErrors = {},
  templates = [],
  submitLabel = 'Save service',
  submittingLabel = 'Saving…',
}) {
  function handleChange(event) {
    onChange(event.target.name, event.target.value)
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
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
          />
        </Field>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default ServiceForm
