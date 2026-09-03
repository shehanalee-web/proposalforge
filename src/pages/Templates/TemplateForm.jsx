import { makeLineItem, makeSection, DEFAULT_CURRENCY } from '../../models/proposal.js'
import { formatCurrency } from '../../utils/format.js'
import { sumItemAmounts } from '../../models/template.js'
import { DEFAULT_LAYOUT_ID } from '../../layouts/ids.js'
import LayoutPicker from '../../layouts/screen/LayoutPicker.jsx'
import styles from './TemplateForm.module.css'

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

function TemplateForm({
  values,
  onChange,
  onSubmit,
  submitting,
  fieldErrors = {},
  submitLabel = 'Save template',
  submittingLabel = 'Saving…',
}) {
  const pricingTotal = sumItemAmounts(
    values.items.map((item) => ({
      ...item,
      amount: item.amount === '' ? 0 : Number(item.amount),
    })),
  )

  function handleChange(event) {
    onChange(event.target.name, event.target.value)
  }

  function updateSection(id, name, value) {
    onChange(
      'sections',
      values.sections.map((section) =>
        section.id === id ? { ...section, [name]: value } : section,
      ),
    )
  }

  function addSection() {
    onChange('sections', [...values.sections, makeSection()])
  }

  function removeSection(id) {
    onChange(
      'sections',
      values.sections.filter((section) => section.id !== id),
    )
  }

  function updateItem(id, name, value) {
    onChange(
      'items',
      values.items.map((item) =>
        item.id === id ? { ...item, [name]: value } : item,
      ),
    )
  }

  function addItem() {
    onChange('items', [
      ...values.items,
      { ...makeLineItem(), amount: '' },
    ])
  }

  function removeItem(id) {
    onChange(
      'items',
      values.items.filter((item) => item.id !== id),
    )
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
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
        id="description"
        label="Description"
        error={fieldErrors.description}
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

      <LayoutPicker
        value={values.defaultLayoutId ?? DEFAULT_LAYOUT_ID}
        onChange={(layoutId) => onChange('defaultLayoutId', layoutId)}
        disabled={submitting}
        label="Default layout"
      />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Sections</legend>
        {values.sections.length === 0 ? (
          <p className={styles.empty}>No sections yet.</p>
        ) : (
          values.sections.map((section, index) => (
            <div key={section.id} className={styles.block}>
              <div className={styles.blockHeader}>
                <p className={styles.blockLabel}>Section {index + 1}</p>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeSection(section.id)}
                  disabled={submitting}
                >
                  Remove
                </button>
              </div>
              <Field
                id={`${section.id}-heading`}
                label="Heading"
                error={fieldErrors[`sections.${index}.heading`]}
              >
                <input
                  id={`${section.id}-heading`}
                  type="text"
                  className={styles.input}
                  value={section.heading}
                  onChange={(event) =>
                    updateSection(section.id, 'heading', event.target.value)
                  }
                  disabled={submitting}
                />
              </Field>
              <Field
                id={`${section.id}-body`}
                label="Body"
                error={fieldErrors[`sections.${index}.body`]}
              >
                <textarea
                  id={`${section.id}-body`}
                  rows={3}
                  className={`${styles.input} ${styles.textarea}`}
                  value={section.body}
                  onChange={(event) =>
                    updateSection(section.id, 'body', event.target.value)
                  }
                  disabled={submitting}
                />
              </Field>
            </div>
          ))
        )}
        <button
          type="button"
          className={styles.add}
          onClick={addSection}
          disabled={submitting}
        >
          Add section
        </button>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Line items</legend>
        {values.items.length === 0 ? (
          <p className={styles.empty}>No line items yet.</p>
        ) : (
          values.items.map((item, index) => (
            <div key={item.id} className={styles.itemRow}>
              <Field
                id={`${item.id}-description`}
                label="Description"
                error={fieldErrors[`items.${index}.description`]}
              >
                <input
                  id={`${item.id}-description`}
                  type="text"
                  className={styles.input}
                  value={item.description}
                  onChange={(event) =>
                    updateItem(item.id, 'description', event.target.value)
                  }
                  disabled={submitting}
                />
              </Field>
              <Field
                id={`${item.id}-amount`}
                label="Amount (USD)"
                error={fieldErrors[`items.${index}.amount`]}
              >
                <input
                  id={`${item.id}-amount`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className={styles.input}
                  value={item.amount}
                  onChange={(event) =>
                    updateItem(item.id, 'amount', event.target.value)
                  }
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors[`items.${index}.amount`])}
                />
              </Field>
              <button
                type="button"
                className={styles.remove}
                onClick={() => removeItem(item.id)}
                disabled={submitting}
              >
                Remove
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className={styles.add}
          onClick={addItem}
          disabled={submitting}
        >
          Add line item
        </button>
      </fieldset>

      <div className={styles.pricing}>
        <p className={styles.pricingLabel}>Pricing</p>
        <p className={styles.pricingValue}>
          {formatCurrency(pricingTotal, DEFAULT_CURRENCY)}
        </p>
        <p className={styles.pricingHint}>
          Total is the sum of line items. It is copied onto new proposals.
        </p>
      </div>

      <Field id="terms" label="Terms & conditions" error={fieldErrors.terms}>
        <textarea
          id="terms"
          name="terms"
          rows={6}
          className={`${styles.input} ${styles.textarea}`}
          value={values.terms}
          onChange={handleChange}
          disabled={submitting}
        />
      </Field>

      <Field id="notes" label="Notes" error={fieldErrors.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className={`${styles.input} ${styles.textarea}`}
          value={values.notes}
          onChange={handleChange}
          disabled={submitting}
        />
      </Field>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default TemplateForm
