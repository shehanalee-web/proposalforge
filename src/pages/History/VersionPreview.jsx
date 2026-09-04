import { formatAnswer } from '../../forms/answer.js'
import { PROPOSAL_STATUS_LABELS } from '../../models/proposal.js'
import {
  hasQuestionnaire,
  isAnswered,
  isQuestionnaireSubmitted,
  QUESTIONNAIRE_STATUS,
  responsesByQuestionId,
} from '../../models/questionnaire.js'
import { getBlockMeta } from '../../blocks/editor/blockMeta.js'
import { getLayout } from '../../layouts/registry.js'
import { formatCurrency, formatDate, formatTime } from '../../utils/format.js'
import { versionLabel } from '../../models/proposalVersion.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import styles from './VersionHistoryPanel.module.css'

const QUESTIONNAIRE_LABEL = {
  [QUESTIONNAIRE_STATUS.DRAFT]: 'Not started',
  [QUESTIONNAIRE_STATUS.IN_PROGRESS]: 'In progress',
  [QUESTIONNAIRE_STATUS.SUBMITTED]: 'Submitted',
}

function Group({ title, children }) {
  return (
    <section className={styles.group}>
      <h4 className={styles.groupTitle}>{title}</h4>
      <div className={styles.groupBody}>{children}</div>
    </section>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className={styles.groupRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function includedSections(snapshot) {
  const headings = (snapshot.sections ?? [])
    .map((section) => section.heading?.trim())
    .filter(Boolean)

  if (headings.length > 0) return headings

  return (snapshot.blocks ?? [])
    .filter((block) => block.enabled !== false)
    .map((block) => getBlockMeta(block.type).short)
}

function VersionPreview({ version }) {
  if (!version) return null

  const snapshot = version.snapshot ?? {}
  const metadata = snapshot.metadata ?? {}
  const status = version.status || metadata.status
  const questionnaire = snapshot.questionnaire
  const byId = responsesByQuestionId(questionnaire)
  const uploads = snapshot.uploads ?? []
  const amount = Number(snapshot.pricing?.amount ?? 0)
  const currency = snapshot.pricing?.currency ?? 'USD'
  const layout = snapshot.layoutId ? getLayout(snapshot.layoutId) : null
  const client = metadata.clientName || metadata.company
  const sections = includedSections(snapshot)
  const hasForm = hasQuestionnaire(questionnaire)
  const submitted = isQuestionnaireSubmitted(questionnaire)
  const answered = hasForm
    ? questionnaire.questions.filter((question) =>
        isAnswered(question, byId[question.id]?.value),
      )
    : []
  const showOptional = hasForm || uploads.length > 0

  return (
    <div className={styles.preview}>
      <p className={styles.previewTitle}>{versionLabel(version)}</p>
      <p className={styles.meta}>
        {formatDate(version.createdAt)} · {formatTime(version.createdAt)} ·{' '}
        {version.createdBy || version.updatedBy || 'Studio'}
      </p>

      <Group title="Proposal summary">
        <dl className={styles.groupList}>
          <MetaRow label="Status">
            <StatusBadge compact status={status} label={PROPOSAL_STATUS_LABELS[status]} />
          </MetaRow>
          <MetaRow label="Price">{formatCurrency(amount, currency)}</MetaRow>
          {layout ? <MetaRow label="Layout">{layout.label}</MetaRow> : null}
          {client ? <MetaRow label="Client">{client}</MetaRow> : null}
          <MetaRow label="Created">
            {formatDate(version.createdAt)} · {formatTime(version.createdAt)}
          </MetaRow>
        </dl>
      </Group>

      {sections.length > 0 ? (
        <Group title="Included sections">
          <ul className={styles.chipList}>
            {sections.map((name) => (
              <li key={name} className={styles.chip}>
                {name}
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {showOptional ? (
        <Group title="Optional content">
          {hasForm ? (
            <div className={styles.optionalBlock}>
              <p className={styles.optionalLabel}>Questionnaire</p>
              {submitted ? (
                <p className={styles.optionalCopy}>
                  {QUESTIONNAIRE_LABEL[questionnaire.status]}
                </p>
              ) : (
                <p className={styles.emptyNote}>No questionnaire submitted</p>
              )}
            </div>
          ) : null}

          {hasForm ? (
            <div className={styles.optionalBlock}>
              <p className={styles.optionalLabel}>Responses</p>
              {answered.length === 0 ? (
                <p className={styles.emptyNote}>No client responses</p>
              ) : (
                questionnaire.questions.map((question) => (
                  <article key={question.id} className={styles.previewItem}>
                    <p className={styles.previewHeading}>
                      {question.title?.trim() || 'Untitled question'}
                    </p>
                    <p>
                      {isAnswered(question, byId[question.id]?.value)
                        ? formatAnswer(question, byId[question.id]?.value)
                        : <span className={styles.emptyNote}>No client responses</span>}
                    </p>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {uploads.length > 0 ? (
            <div className={styles.optionalBlock}>
              <p className={styles.optionalLabel}>Files</p>
              {uploads.map((file) => (
                <p key={file.id || file.name}>{file.name || 'Untitled file'}</p>
              ))}
            </div>
          ) : hasForm ? (
            <div className={styles.optionalBlock}>
              <p className={styles.optionalLabel}>Files</p>
              <p className={styles.emptyNote}>No uploaded files</p>
            </div>
          ) : null}
        </Group>
      ) : null}
    </div>
  )
}

export default VersionPreview
