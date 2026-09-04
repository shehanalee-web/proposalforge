import Icon from '../Icon/Icon.jsx'
import { formatAnswer } from '../../forms/answer.js'
import { questionnaireProgress } from '../../forms/progress.js'
import {
  hasQuestionnaire,
  isQuestionnaireSubmitted,
  QUESTIONNAIRE_STATUS,
  responsesByQuestionId,
} from '../../models/questionnaire.js'
import styles from './ClientResponsesPanel.module.css'

const STATUS_LABEL = {
  [QUESTIONNAIRE_STATUS.DRAFT]: 'Not started',
  [QUESTIONNAIRE_STATUS.IN_PROGRESS]: 'In progress',
  [QUESTIONNAIRE_STATUS.SUBMITTED]: 'Submitted',
}

function ClientResponsesPanel({ proposal, open, onClose }) {
  if (!open) return null

  const form = proposal?.questionnaire
  const empty = !hasQuestionnaire(form)
  const byId = responsesByQuestionId(form)
  const progress = form ? questionnaireProgress(form) : null
  const submitted = isQuestionnaireSubmitted(form)

  return (
    <aside className={styles.panel} aria-label="Client responses">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Client</p>
          <h2 className={styles.title}>Client responses</h2>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close responses">
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.scroll}>
        {empty ? (
          <p className={styles.note}>
            This proposal has no discovery questionnaire. Add questions on the
            template, then create a new proposal from it.
          </p>
        ) : (
          <>
            <p className={styles.meta}>
              {STATUS_LABEL[form.status] ?? form.status}
              {progress ? ` · ${progress.answered} of ${progress.total} answered` : ''}
              {submitted ? ' · Read-only' : ''}
            </p>
            <p className={styles.note}>
              Answers belong to this proposal. Changing the template will not
              rewrite them.
            </p>
            {form.questions.map((question) => (
              <article key={question.id} className={styles.item}>
                {question.sectionTitle ? (
                  <p className={styles.section}>{question.sectionTitle}</p>
                ) : null}
                <p className={styles.question}>{question.title || 'Untitled question'}</p>
                <p className={styles.answer}>{formatAnswer(question, byId[question.id]?.value)}</p>
                {question.internalNotes ? (
                  <p className={styles.internal}>{question.internalNotes}</p>
                ) : null}
              </article>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

export default ClientResponsesPanel
