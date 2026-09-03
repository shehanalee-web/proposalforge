import { PROJECT_TYPES } from '../../models/proposal.js'
import styles from './SettingsForm.module.css'

function Field({ id, label, error, hint, children }) {
  const errorId = `${id}-error`

  return (
    <div className={styles.field}>
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

function SettingsForm({
  values,
  onChange,
  onSubmit,
  submitting,
  fieldErrors,
}) {
  function handleChange(event) {
    onChange(event.target.name, event.target.value)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.grid}>
        <Field
          id="studioName"
          label="Studio name"
          error={fieldErrors.studioName}
        >
          <input
            id="studioName"
            name="studioName"
            type="text"
            className={styles.input}
            value={values.studioName}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="organization"
            aria-invalid={Boolean(fieldErrors.studioName)}
            aria-describedby={
              fieldErrors.studioName ? 'studioName-error' : undefined
            }
            required
          />
        </Field>

        <Field
          id="contactEmail"
          label="Contact email"
          error={fieldErrors.contactEmail}
        >
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className={styles.input}
            value={values.contactEmail}
            onChange={handleChange}
            disabled={submitting}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.contactEmail)}
            aria-describedby={
              fieldErrors.contactEmail ? 'contactEmail-error' : undefined
            }
          />
        </Field>

        <Field
          id="defaultProjectType"
          label="Default project type"
          error={fieldErrors.defaultProjectType}
        >
          <select
            id="defaultProjectType"
            name="defaultProjectType"
            className={styles.input}
            value={values.defaultProjectType}
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
          id="currency"
          label="Currency"
          hint="Proposals are quoted in US dollars."
        >
          <input
            id="currency"
            name="currency"
            type="text"
            className={styles.input}
            value={values.currency}
            readOnly
            disabled
          />
        </Field>
      </div>

      <Field id="about" label="About the studio" error={fieldErrors.about}>
        <textarea
          id="about"
          name="about"
          rows={4}
          className={`${styles.input} ${styles.textarea}`}
          value={values.about}
          onChange={handleChange}
          disabled={submitting}
        />
      </Field>

      <div className={styles.actions}>
        <button type="submit" className={`studio-btn-primary ${styles.submit}`} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

export default SettingsForm
