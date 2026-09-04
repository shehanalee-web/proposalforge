import { useProposalConsistency } from '../../hooks/useProposalConsistency.js'
import { useEditorWorkspace } from '../Editor/EditorWorkspaceContext.jsx'
import {
  CONSISTENCY_SEVERITY,
  CONSISTENCY_SEVERITY_LABELS,
} from '../../consistency/relationships.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './ProposalIntegrity.module.css'

const ROWS = [
  ['Consistency Score', 'score'],
  ['Total Contradictions', 'total'],
  ['Affected Sections', 'sections'],
  ['Highest Conflict', 'conflict'],
  ['Quick Fix', 'fix'],
]

function openBlock(workspace, blockId) {
  if (!blockId) return
  workspace.toggleExpanded(blockId, true)
  workspace.setActiveBlockId(blockId)
  workspace.setInspectorOpen(true)
  workspace.scrollToBlock(blockId)
}

/**
 * Compact integrity summary below Proposal Intelligence.
 */
function ProposalIntegrity({ proposal, blocks }) {
  const report = useProposalConsistency(proposal, blocks)
  const workspace = useEditorWorkspace()
  const { summary, contradictions } = report
  const values = {
    score: String(summary.score),
    total: String(summary.total),
    sections: summary.affectedSections,
    conflict: summary.highestConflict,
    fix: summary.quickFix,
  }

  return (
    <SidebarSection
      title="Proposal Integrity"
      icon="lock"
      badge={summary.score}
    >
      <div className={styles.root}>
        {ROWS.map(([label, key]) => (
          <button
            key={key}
            type="button"
            className={styles.row}
            onClick={() => openBlock(workspace, summary.navigateTo)}
          >
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{values[key]}</span>
          </button>
        ))}

        {contradictions.length > 0 ? (
          <ul className={styles.findings}>
            {contradictions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.finding} ${
                    item.severity === CONSISTENCY_SEVERITY.CRITICAL
                      ? styles.critical
                      : item.severity === CONSISTENCY_SEVERITY.MAJOR
                        ? styles.major
                        : styles.minor
                  }`}
                  onClick={() => openBlock(workspace, item.navigateTo)}
                >
                  <span className={styles.findingMeta}>
                    {CONSISTENCY_SEVERITY_LABELS[item.severity]}
                  </span>
                  <span className={styles.findingTitle}>{item.title}</span>
                  <span className={styles.findingCopy}>{item.explanation}</span>
                  <span className={styles.findingCopy}>{item.suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No cross-section contradictions detected.</p>
        )}
      </div>
    </SidebarSection>
  )
}

export default ProposalIntegrity
