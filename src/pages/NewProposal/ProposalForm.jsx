import { PROJECT_TYPES } from '../../models/proposal.js'
import { DEFAULT_LAYOUT_ID } from '../../layouts/ids.js'
import LayoutPicker from '../../layouts/screen/LayoutPicker.jsx'
import styles from './ProposalForm.module.css'

function Field({ id, label, error, children }) {
  const errorId = `${id}-error`

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ProposalForm({
  values,
  onChange,
  onSubmit,
  submitting,
  fieldErrors = {},
  submitLabel = 'Save changes',
  submittingLabel = 'Saving…',
  children,
}) {
  function handleChange(event) {
    onChange(event.target.name, event.target.value)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.section}>Details</p>
      <div className={styles.grid}>
        <Field id="title" label="Title" error={fieldErrors.title}>
          <input
            id="title"
            name="title"
            type="text"
            className={styles.input}
            value={values.title}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            required
          />
        </Field>

        <Field
          id="projectType"
          label="Project type"
          error={fieldErrors.projectType}
        >
          <select
            id="projectType"
            name="projectType"
            className={styles.input}
            value={values.projectType}
            onChange={handleChange}
            disabled={submitting}
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="clientName"
          label="Client name"
          error={fieldErrors.clientName}
        >
          <input
            id="clientName"
            name="clientName"
            type="text"
            className={styles.input}
            value={values.clientName}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="name"
            aria-invalid={Boolean(fieldErrors.clientName)}
            aria-describedby={
              fieldErrors.clientName ? 'clientName-error' : undefined
            }
            required
          />
        </Field>

        <Field
          id="clientEmail"
          label="Client email"
          error={fieldErrors.clientEmail}
        >
          <input
            id="clientEmail"
            name="clientEmail"
            type="email"
            className={styles.input}
            value={values.clientEmail}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.clientEmail)}
            aria-describedby={
              fieldErrors.clientEmail ? 'clientEmail-error' : undefined
            }
          />
        </Field>

        <Field id="company" label="Company" error={fieldErrors.company}>
          <input
            id="company"
            name="company"
            type="text"
            className={styles.input}
            value={values.company}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="organization"
          />
        </Field>

        <Field id="amount" label="Amount (USD)" error={fieldErrors.amount}>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={styles.input}
            value={values.amount}
            onChange={handleChange}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.amount)}
            aria-describedby={fieldErrors.amount ? 'amount-error' : undefined}
          />
        </Field>

        <Field
          id="validUntil"
          label="Valid until"
          error={fieldErrors.validUntil}
        >
          <input
            id="validUntil"
            name="validUntil"
            type="date"
            className={styles.input}
            value={values.validUntil}
            onChange={handleChange}
            disabled={submitting}
          />
        </Field>
      </div>

      <p className={styles.section}>Layout</p>
      <LayoutPicker
        value={values.layoutId ?? DEFAULT_LAYOUT_ID}
        onChange={(layoutId) => onChange('layoutId', layoutId)}
        disabled={submitting}
      />

      <p className={styles.section}>Content</p>
      <Field id="summary" label="Executive summary" error={fieldErrors.summary}>
        <textarea
          id="summary"
          name="summary"
          rows={4}
          className={`${styles.input} ${styles.textarea}`}
          value={values.summary}
          onChange={handleChange}
          disabled={submitting}
        />
      </Field>

      {children}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default ProposalForm
