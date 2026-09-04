import QuestionField from '../forms/QuestionField.jsx'
import { questionnaireProgress } from '../forms/progress.js'
import { listVisibleQuestions } from '../forms/visibility.js'
import { useProposalQuestionnaire } from '../hooks/useProposalQuestionnaire.js'
import { isProposalLocked } from '../models/approval.js'
import {
  isQuestionnaireSubmitted,
  responsesByQuestionId,
} from '../models/questionnaire.js'
import Icon from '../components/Icon/Icon.jsx'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalQuestionnaire.module.css'

function PortalQuestionnaire({ onClose, onProposalChange }) {
  const { proposal, token } = usePortal()
  const form = proposal.questionnaire
  const flow = useProposalQuestionnaire({
    token,
    questionnaire: form,
    onProposalChange,
  })
  const current = flow.questionnaire
  const byId = responsesByQuestionId(current)
  const visible = listVisibleQuestions(current, byId)
  const progress = questionnaireProgress(current)
  const submitted = isQuestionnaireSubmitted(current) || isProposalLocked(proposal)

  async function handleClose() {
    await flow.flush()
    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await flow.submit()
  }

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.backdrop} aria-label="Close questionnaire" onClick={handleClose} />
      <aside className={styles.drawer} aria-labelledby="portal-questionnaire-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Discovery</p>
            <h2 id="portal-questionnaire-title" className={styles.title}>
              {current.title || 'Questionnaire'}
            </h2>
          </div>
          <button type="button" className={styles.close} onClick={handleClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className={styles.progress} aria-live="polite">
          <div className={styles.progressMeta}>
            <span>
              {progress.answered} of {progress.total} answered
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${progress.percent}%` }} />
          </div>
          <p className={styles.saveState}>
            {submitted
              ? 'Submitted. These answers are locked.'
              : flow.saving
                ? 'Saving…'
                : flow.savedAt
                  ? 'Saved. You can close this and return later.'
                  : 'Answers save automatically.'}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {current.description ? <p className={styles.intro}>{current.description}</p> : null}

          {flow.error && !Object.keys(flow.fieldErrors).length ? (
            <p className={styles.banner} role="alert">
              {flow.error.message}
            </p>
          ) : null}

          {visible.map((question, index) => {
            const previous = visible[index - 1]
            const section =
              question.sectionTitle &&
              question.sectionTitle !== previous?.sectionTitle
                ? question.sectionTitle
                : null
            return (
              <div key={question.id} className={styles.block}>
                {section ? <h3 className={styles.section}>{section}</h3> : null}
                <QuestionField
                  question={question}
                  value={byId[question.id]?.value}
                  disabled={submitted || flow.submitting}
                  error={flow.fieldErrors[question.id]}
                  onChange={(value) => flow.setAnswer(question.id, value)}
                />
              </div>
            )
          })}

          {visible.length === 0 ? (
            <p className={styles.intro}>There are no questions on this proposal.</p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={handleClose}>
              {submitted ? 'Close' : 'Save and close'}
            </button>
            {submitted ? null : (
              <button type="submit" className={styles.submit} disabled={flow.submitting}>
                {flow.submitting ? 'Submitting…' : 'Submit answers'}
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  )
}

export default PortalQuestionnaire
