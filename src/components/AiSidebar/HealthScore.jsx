import { useMemo } from 'react'
import Icon from '../Icon/Icon.jsx'
import { RISK_LEVEL, RISK_LEVEL_LABELS } from '../../insights/ids.js'
import { useProposalHealth } from '../../hooks/useProposalHealth.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './HealthScore.module.css'

/**
 * Live proposal health. Completeness still uses the original checklist;
 * score, risk and suggestions come from the Insights health engine.
 */

function HealthScore({ proposal, blocks }) {
  const report = useProposalHealth(proposal, blocks)
  const suggestions = useMemo(
    () => report.suggestions.slice(0, 3),
    [report.suggestions],
  )
  const riskClass =
    report.riskLevel === RISK_LEVEL.HIGH
      ? styles.riskHigh
      : report.riskLevel === RISK_LEVEL.MEDIUM
        ? styles.riskMedium
        : styles.riskLow

  return (
    <SidebarSection
      title="Proposal Health"
      icon="check"
      badge={`${report.overallScore}`}
    >
      <div className={styles.root}>
        <div className={styles.scoreRow}>
          <span className={styles.score}>{report.overallScore}</span>
          <span className={`${styles.risk} ${riskClass}`}>
            {RISK_LEVEL_LABELS[report.riskLevel]}
          </span>
        </div>

        <div className={styles.bar}>
          <div
            className={`${styles.barFill} ${riskClass}`}
            style={{ width: `${report.overallScore}%` }}
            role="progressbar"
            aria-valuenow={report.overallScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Proposal health score"
          />
        </div>

        <p className={styles.meta}>
          {RISK_LEVEL_LABELS[report.riskLevel]} · {report.completionPercent}% complete
        </p>

        <ul className={styles.list}>
          {report.checks.map((item) => (
            <li
              key={item.id}
              className={`${styles.item} ${item.pass ? styles.itemPass : ''}`}
            >
              <Icon name={item.pass ? 'check' : 'close'} size={12} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>

        {suggestions.length > 0 ? (
          <ul className={styles.tips}>
            {suggestions.map((item) => (
              <li key={item.id} className={styles.tip}>
                <Icon name="spark" size={12} />
                <span>{item.suggestion}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SidebarSection>
  )
}

export default HealthScore
