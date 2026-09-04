import Icon from '../../components/Icon/Icon.jsx'
import {
  duplicateQuestion,
  isChoiceType,
  isFileType,
  makeQuestion,
  makeQuestionOption,
  makeQuestionnaire,
  makeVisibilityRule,
  moveQuestion,
  QUESTION_TYPE,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  VISIBILITY_OPERATOR_LABELS,
  VISIBILITY_OPERATORS,
} from '../../models/questionnaire.js'
import styles from './QuestionnaireBuilder.module.css'

function DefaultValueField({ question, disabled, onChange }) {
  if (isFileType(question.type)) {
    return (
      <p className={styles.hint}>File questions have no default value.</p>
    )
  }

  if (question.type === QUESTION_TYPE.YES_NO) {
    return (
      <select
        className={styles.input}
        value={question.defaultValue ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">None</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    )
  }

  if (question.type === QUESTION_TYPE.RATING) {
    return (
      <input
        type="number"
        min="0"
        max={question.ratingMax ?? 5}
        className={styles.input}
        value={question.defaultValue || ''}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    )
  }

  if (question.type === QUESTION_TYPE.CHECKBOXES) {
    const selected = Array.isArray(question.defaultValue)
      ? question.defaultValue
      : []
    return (
      <div className={styles.optionList}>
        {(question.options ?? []).map((option) => (
          <label key={option.id} className={styles.check}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={() =>
                onChange(
                  selected.includes(option.value)
                    ? selected.filter((entry) => entry !== option.value)
                    : [...selected, option.value],
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }

  if (
    question.type === QUESTION_TYPE.DROPDOWN ||
    question.type === QUESTION_TYPE.MULTIPLE_CHOICE
  ) {
    return (
      <select
        className={styles.input}
        value={question.defaultValue ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">None</option>
        {(question.options ?? []).map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (question.type === QUESTION_TYPE.COLOUR) {
    return (
      <input
        type="color"
        className={styles.swatch}
        value={question.defaultValue || '#14b8a6'}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

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

  if (
    question.type === QUESTION_TYPE.LONG_TEXT ||
    question.type === QUESTION_TYPE.RICH_TEXT
  ) {
    return (
      <textarea
        rows={3}
        className={`${styles.input} ${styles.textarea}`}
        value={question.defaultValue ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <input
      type={inputType}
      className={styles.input}
      value={question.defaultValue ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function QuestionnaireBuilder({ value, onChange, disabled = false }) {
  const form = makeQuestionnaire(value ?? {})
  const questions = form.questions ?? []

  function patchForm(patch) {
    onChange(
      makeQuestionnaire({
        ...form,
        ...patch,
        frozen: false,
        responses: [],
        submittedAt: null,
      }),
    )
  }

  function patchQuestion(id, patch) {
    patchForm({
      questions: questions.map((question) =>
        question.id === id ? makeQuestion({ ...question, ...patch }) : question,
      ),
    })
  }

  function addQuestion() {
    patchForm({
      questions: [
        ...questions,
        makeQuestion({ title: 'New question', type: QUESTION_TYPE.SHORT_TEXT }),
      ],
    })
  }

  return (
    <div className={styles.root}>
      <p className={styles.lede}>
        This questionnaire is copied onto each new proposal from this template,
        then frozen. Editing it later will not change existing proposals.
      </p>

      <label className={styles.field}>
        <span>Form title</span>
        <input
          type="text"
          className={styles.input}
          value={form.title}
          disabled={disabled}
          onChange={(event) => patchForm({ title: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>Introduction</span>
        <textarea
          rows={3}
          className={`${styles.input} ${styles.textarea}`}
          value={form.description}
          disabled={disabled}
          onChange={(event) => patchForm({ description: event.target.value })}
        />
      </label>

      {questions.length === 0 ? (
        <p className={styles.empty}>No questions yet. Add one to start a discovery form.</p>
      ) : null}

      {questions.map((question, index) => (
        <article key={question.id} className={styles.card}>
          <header className={styles.cardHead}>
            <p className={styles.cardLabel}>Question {index + 1}</p>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={disabled || index === 0}
                onClick={() => patchForm({ questions: moveQuestion(questions, index, -1) })}
                aria-label="Move up"
              >
                <Icon name="chevronUp" size={14} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={disabled || index === questions.length - 1}
                onClick={() => patchForm({ questions: moveQuestion(questions, index, 1) })}
                aria-label="Move down"
              >
                <Icon name="chevronDown" size={14} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={disabled}
                onClick={() => {
                  const copy = [...questions]
                  copy.splice(index + 1, 0, duplicateQuestion(question))
                  patchForm({ questions: copy })
                }}
                aria-label="Duplicate"
              >
                <Icon name="duplicate" size={14} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={disabled}
                onClick={() =>
                  patchForm({
                    questions: questions.filter((entry) => entry.id !== question.id),
                  })
                }
                aria-label="Delete"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </header>

          <label className={styles.field}>
            <span>Type</span>
            <select
              className={styles.input}
              value={question.type}
              disabled={disabled}
              onChange={(event) => patchQuestion(question.id, { type: event.target.value })}
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Question</span>
            <input
              type="text"
              className={styles.input}
              value={question.title}
              disabled={disabled}
              onChange={(event) => patchQuestion(question.id, { title: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span>Section title</span>
            <input
              type="text"
              className={styles.input}
              value={question.sectionTitle}
              disabled={disabled}
              placeholder="Shown above this question when set"
              onChange={(event) =>
                patchQuestion(question.id, { sectionTitle: event.target.value })
              }
            />
          </label>

          <label className={styles.field}>
            <span>Helper text</span>
            <input
              type="text"
              className={styles.input}
              value={question.helperText}
              disabled={disabled}
              onChange={(event) =>
                patchQuestion(question.id, { helperText: event.target.value })
              }
            />
          </label>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={question.required}
              disabled={disabled}
              onChange={(event) =>
                patchQuestion(question.id, { required: event.target.checked })
              }
            />
            <span>Required</span>
          </label>

          {isChoiceType(question.type) ? (
            <fieldset className={styles.group}>
              <legend>Options</legend>
              {(question.options ?? []).map((option, optionIndex) => (
                <div key={option.id} className={styles.optionRow}>
                  <input
                    type="text"
                    className={styles.input}
                    value={option.label}
                    disabled={disabled}
                    onChange={(event) => {
                      const label = event.target.value
                      patchQuestion(question.id, {
                        options: question.options.map((entry, entryIndex) =>
                          entryIndex === optionIndex
                            ? makeQuestionOption({ ...entry, label, value: label })
                            : entry,
                        ),
                      })
                    }}
                  />
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={disabled || question.options.length < 2}
                    onClick={() =>
                      patchQuestion(question.id, {
                        options: question.options.filter((entry) => entry.id !== option.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.add}
                disabled={disabled}
                onClick={() =>
                  patchQuestion(question.id, {
                    options: [
                      ...question.options,
                      makeQuestionOption({
                        label: `Option ${question.options.length + 1}`,
                      }),
                    ],
                  })
                }
              >
                Add option
              </button>
            </fieldset>
          ) : null}

          <label className={styles.field}>
            <span>Default value</span>
            <DefaultValueField
              question={question}
              disabled={disabled}
              onChange={(defaultValue) => patchQuestion(question.id, { defaultValue })}
            />
          </label>

          <label className={styles.field}>
            <span>Internal notes</span>
            <textarea
              rows={2}
              className={`${styles.input} ${styles.textarea}`}
              value={question.internalNotes}
              disabled={disabled}
              placeholder="Studio only. Clients never see this."
              onChange={(event) =>
                patchQuestion(question.id, { internalNotes: event.target.value })
              }
            />
          </label>

          <fieldset className={styles.group}>
            <legend>Conditional visibility</legend>
            <p className={styles.hint}>
              Stored on the question for later workflows. The client form already
              evaluates the rule; more builders can reuse it without a schema change.
            </p>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={question.visibility?.enabled}
                disabled={disabled}
                onChange={(event) =>
                  patchQuestion(question.id, {
                    visibility: makeVisibilityRule({
                      ...question.visibility,
                      enabled: event.target.checked,
                    }),
                  })
                }
              />
              <span>Show this question only when another answer matches</span>
            </label>
            {question.visibility?.enabled ? (
              <>
                <label className={styles.field}>
                  <span>Depends on</span>
                  <select
                    className={styles.input}
                    value={question.visibility.questionId ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        visibility: makeVisibilityRule({
                          ...question.visibility,
                          questionId: event.target.value || null,
                        }),
                      })
                    }
                  >
                    <option value="">Select a question</option>
                    {questions
                      .filter((entry) => entry.id !== question.id)
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.title || 'Untitled question'}
                        </option>
                      ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Rule</span>
                  <select
                    className={styles.input}
                    value={question.visibility.operator}
                    disabled={disabled}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        visibility: makeVisibilityRule({
                          ...question.visibility,
                          operator: event.target.value,
                        }),
                      })
                    }
                  >
                    {VISIBILITY_OPERATORS.map((operator) => (
                      <option key={operator} value={operator}>
                        {VISIBILITY_OPERATOR_LABELS[operator]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Value</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={question.visibility.value ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        visibility: makeVisibilityRule({
                          ...question.visibility,
                          value: event.target.value,
                        }),
                      })
                    }
                  />
                </label>
              </>
            ) : null}
          </fieldset>
        </article>
      ))}

      <button
        type="button"
        className={styles.addQuestion}
        disabled={disabled}
        onClick={addQuestion}
      >
        Add question
      </button>
    </div>
  )
}

export default QuestionnaireBuilder
