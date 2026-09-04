import { makeUploadedFile, QUESTION_TYPE } from '../models/questionnaire.js'
import styles from './QuestionField.module.css'

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(
        makeUploadedFile({
          name: file.name,
          url: String(reader.result ?? ''),
          mime: file.type,
          size: file.size,
        }),
      )
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function readFiles(fileList) {
  return Promise.all(Array.from(fileList ?? []).map(readFile))
}

function FileList({ files, disabled, onRemove }) {
  if (!files?.length) return null

  return (
    <ul className={styles.files}>
      {files.map((file) => (
        <li key={file.id} className={styles.file}>
          {file.mime?.startsWith('image/') && file.url ? (
            <img src={file.url} alt="" className={styles.thumb} />
          ) : null}
          <span>{file.name}</span>
          {disabled ? null : (
            <button type="button" className={styles.removeFile} onClick={() => onRemove(file.id)}>
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function QuestionField({ question, value, onChange, disabled, error }) {
  const id = `answer-${question.id}`
  const describedBy = [
    question.helperText ? `${id}-help` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const common = {
    id,
    disabled,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy || undefined,
    'aria-required': question.required || undefined,
  }

  function setValue(next) {
    if (!disabled) onChange(next)
  }

  let control = null

  if (question.type === QUESTION_TYPE.LONG_TEXT || question.type === QUESTION_TYPE.RICH_TEXT) {
    control = (
      <textarea
        {...common}
        className={`${styles.input} ${styles.textarea}`}
        rows={question.type === QUESTION_TYPE.RICH_TEXT ? 6 : 4}
        value={value ?? ''}
        onChange={(event) => setValue(event.target.value)}
      />
    )
  } else if (question.type === QUESTION_TYPE.DROPDOWN) {
    control = (
      <select
        {...common}
        className={styles.input}
        value={value ?? ''}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">Select…</option>
        {(question.options ?? []).map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  } else if (question.type === QUESTION_TYPE.MULTIPLE_CHOICE) {
    control = (
      <div className={styles.choices} role="radiogroup" aria-labelledby={`${id}-label`}>
        {(question.options ?? []).map((option) => (
          <label key={option.id} className={styles.choice}>
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => setValue(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  } else if (question.type === QUESTION_TYPE.CHECKBOXES) {
    const selected = Array.isArray(value) ? value : []
    control = (
      <div className={styles.choices} role="group" aria-labelledby={`${id}-label`}>
        {(question.options ?? []).map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label key={option.id} className={styles.choice}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  setValue(
                    checked
                      ? selected.filter((entry) => entry !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    )
  } else if (question.type === QUESTION_TYPE.YES_NO) {
    control = (
      <div className={styles.pills} role="group" aria-labelledby={`${id}-label`}>
        {[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.pill}
            aria-pressed={value === option.id}
            disabled={disabled}
            onClick={() => setValue(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  } else if (question.type === QUESTION_TYPE.RATING) {
    const max = question.ratingMax ?? 5
    control = (
      <div className={styles.pills} role="radiogroup" aria-labelledby={`${id}-label`}>
        {Array.from({ length: max }, (_, index) => {
          const score = index + 1
          return (
            <button
              key={score}
              type="button"
              className={styles.pill}
              aria-pressed={Number(value) === score}
              disabled={disabled}
              onClick={() => setValue(score)}
            >
              {score}
            </button>
          )
        })}
      </div>
    )
  } else if (question.type === QUESTION_TYPE.COLOUR) {
    control = (
      <div className={styles.colourRow}>
        <input
          {...common}
          type="color"
          className={styles.swatch}
          value={value || '#14b8a6'}
          onChange={(event) => setValue(event.target.value)}
        />
        <input
          type="text"
          className={styles.input}
          value={value ?? ''}
          disabled={disabled}
          placeholder="#14b8a6"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    )
  } else if (
    question.type === QUESTION_TYPE.FILE_UPLOAD ||
    question.type === QUESTION_TYPE.IMAGE_UPLOAD
  ) {
    const files = Array.isArray(value) ? value : []
    const imageOnly = question.type === QUESTION_TYPE.IMAGE_UPLOAD
    control = (
      <div>
        <input
          {...common}
          type="file"
          className={styles.fileInput}
          accept={imageOnly ? 'image/*' : undefined}
          multiple
          onChange={async (event) => {
            const next = await readFiles(event.target.files)
            setValue([...files, ...next])
            event.target.value = ''
          }}
        />
        <FileList
          files={files}
          disabled={disabled}
          onRemove={(fileId) => setValue(files.filter((file) => file.id !== fileId))}
        />
      </div>
    )
  } else {
    const inputType =
      question.type === QUESTION_TYPE.EMAIL
        ? 'email'
        : question.type === QUESTION_TYPE.PHONE
          ? 'tel'
          : question.type === QUESTION_TYPE.NUMBER
            ? 'number'
            : question.type === QUESTION_TYPE.DATE
              ? 'date'
              : question.type === QUESTION_TYPE.URL
                ? 'url'
                : 'text'
    control = (
      <input
        {...common}
        type={inputType}
        className={styles.input}
        value={value ?? ''}
        onChange={(event) =>
          setValue(
            question.type === QUESTION_TYPE.NUMBER
              ? event.target.value
              : event.target.value,
          )
        }
      />
    )
  }

  return (
    <div className={styles.field}>
      <label id={`${id}-label`} htmlFor={id} className={styles.label}>
        {question.title || 'Untitled question'}
        {question.required ? <span className={styles.required}>Required</span> : null}
      </label>
      {question.helperText ? (
        <p id={`${id}-help`} className={styles.help}>
          {question.helperText}
        </p>
      ) : null}
      {question.type === QUESTION_TYPE.RICH_TEXT ? (
        <p className={styles.help}>Written as plain text. Formatting tools come later.</p>
      ) : null}
      {control}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default QuestionField
