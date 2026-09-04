import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FINDING_SEVERITY, FINDING_SEVERITY_LABELS } from '../../insights/ids.js'
import { useProposalImprovements } from '../../hooks/useProposalImprovements.js'
import Icon from '../Icon/Icon.jsx'
import SidebarSection from './SidebarSection.jsx'
import styles from './AiImprovements.module.css'

function severityClass(severity) {
  if (severity === FINDING_SEVERITY.CRITICAL) return styles.critical
  if (severity === FINDING_SEVERITY.WARNING) return styles.warning
  return styles.info
}

function ImprovePreview({ draft, onClose, onInsert }) {
  useEffect(() => {
    if (!draft) return undefined
    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onClose])

  if (!draft) return null

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="improve-preview-title">
      <button type="button" className={styles.backdrop} aria-label="Close preview" onClick={onClose} />
      <div className={styles.dialog}>
        <div className={styles.dialogHead}>
          <h2 id="improve-preview-title" className={styles.dialogTitle}>
            {draft.previewTitle || draft.title}
          </h2>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className={styles.dialogLead}>
          Review this draft before it is written into the proposal. Undo remains available after insert.
        </p>
        <pre className={styles.dialogBody}>{draft.previewBody}</pre>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.ghost} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.primary} onClick={onInsert}>
            Insert into proposal
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ImprovementCard({
  finding,
  draft,
  previewed,
  copied,
  onGenerate,
  onPreview,
  onInsert,
  onCopy,
}) {
  const ready = Boolean(draft)

  return (
    <article className={`${styles.card} ${severityClass(finding.severity)}`}>
      <h3 className={styles.cardTitle}>{finding.title}</h3>
      <p className={styles.severity}>{FINDING_SEVERITY_LABELS[finding.severity]}</p>
      <p className={styles.copy}>
        <span className={styles.label}>Why it matters</span>
        {finding.message}
      </p>
      <p className={styles.copy}>
        <span className={styles.label}>Suggested improvement</span>
        {finding.suggestion}
      </p>
      {ready ? (
        <pre className={styles.preview}>{draft.previewBody}</pre>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onGenerate}>
          Generate
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={onPreview}
          disabled={!ready}
        >
          Preview
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={onInsert}
          disabled={!ready || !previewed}
        >
          Insert
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={onCopy}
          disabled={!ready}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {ready && !previewed ? (
        <p className={styles.hint}>Preview the draft before inserting.</p>
      ) : null}
    </article>
  )
}

/**
 * Actionable AI improvement cards for each live health diagnostic.
 * Does not alter scoring or diagnostics — it only consumes findings.
 */
function AiImprovements({ proposal, blocks, onApply }) {
  const {
    findings,
    drafts,
    previewDraft,
    previewed,
    copiedCode,
    generate,
    preview,
    closePreview,
    insert,
    copy,
  } = useProposalImprovements({ proposal, blocks, onApply })

  return (
    <>
      <SidebarSection
        title="AI Improvements"
        icon="spark"
        badge={findings.length}
      >
        {findings.length === 0 ? (
          <p className={styles.empty}>No diagnostics to improve on this draft.</p>
        ) : (
          <div className={styles.list}>
            {findings.map((finding) => (
              <ImprovementCard
                key={finding.code}
                finding={finding}
                draft={drafts[finding.code]}
                previewed={Boolean(previewed[finding.code])}
                copied={copiedCode === finding.code}
                onGenerate={() => generate(finding)}
                onPreview={() => preview(finding)}
                onInsert={() => insert(finding)}
                onCopy={() => copy(finding)}
              />
            ))}
          </div>
        )}
      </SidebarSection>
      <ImprovePreview
        draft={previewDraft}
        onClose={closePreview}
        onInsert={() => {
          const finding = findings.find((item) => item.code === previewDraft?.findingCode)
          if (finding) insert(finding)
        }}
      />
    </>
  )
}

export default AiImprovements
