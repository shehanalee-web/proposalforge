import { useProposalIntelligence } from '../../hooks/useProposalIntelligence.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './ProposalIntelligence.module.css'

const ROWS = [
  ['Health', 'health'],
  ['Readiness', 'readiness'],
  ['Highest Priority', 'priority'],
  ['Largest Business Risk', 'risk'],
  ['Best Quick Win', 'win'],
  ['Estimated Client Confidence', 'confidence'],
]

/**
 * Compact intelligence summary above AI Improvements. Health Score is
 * shown as-is from the existing engine.
 */
function ProposalIntelligence({ proposal, blocks }) {
  const report = useProposalIntelligence(proposal, blocks)
  const { summary } = report
  const values = {
    health: summary.healthScore == null ? '—' : String(summary.healthScore),
    readiness: summary.readinessLabel,
    priority: summary.highestPriority,
    risk: summary.largestRisk,
    win: summary.bestQuickWin,
    confidence: `${summary.clientConfidence}%`,
  }

  return (
    <SidebarSection
      title="Proposal Intelligence"
      icon="activity"
      badge={`${summary.clientConfidence}%`}
    >
      <div className={styles.root}>
        {ROWS.map(([label, key]) => (
          <div key={key} className={styles.row}>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{values[key]}</span>
          </div>
        ))}
      </div>
    </SidebarSection>
  )
}

export default ProposalIntelligence
