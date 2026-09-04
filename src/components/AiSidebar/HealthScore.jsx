import { useMemo } from 'react'
import Icon from '../Icon/Icon.jsx'
import {
  FINDING_SEVERITY,
  FINDING_SEVERITY_LABELS,
  RISK_LEVEL,
  RISK_LEVEL_LABELS,
} from '../../insights/ids.js'
import { useProposalHealth } from '../../hooks/useProposalHealth.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './HealthScore.module.css'

/**
 * Live proposal health. Completeness still uses the original checklist;
 * diagnostics explain why a gap hurts the document — severity, reason,
 * and a concrete fix.
 */

function severityClass(severity) {
  if (severity === FINDING_SEVERITY.CRITICAL) return styles.findingCritical
  if (severity === FINDING_SEVERITY.WARNING) return styles.findingWarning
  return styles.findingInfo
}

function HealthScore({ proposal, blocks }) {
  const report = useProposalHealth(proposal, blocks)
  const diagnostics = useMemo(
    () => report.suggestions.slice(0, 5),
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

        {diagnostics.length > 0 ? (
          <ul className={styles.findings}>
            {diagnostics.map((item) => (
              <li
                key={item.id}
                className={`${styles.finding} ${severityClass(item.severity)}`}
              >
                <p className={styles.findingTitle}>{item.title}</p>
                <p className={styles.findingMeta}>
                  {FINDING_SEVERITY_LABELS[item.severity]}
                </p>
                <p className={styles.findingReason}>
                  <span className={styles.findingLabel}>Why</span>
                  {item.message}
                </p>
                <p className={styles.findingFix}>
                  <span className={styles.findingLabel}>Improve</span>
                  {item.suggestion}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.meta}>No diagnostic issues on this draft.</p>
        )}
      </div>
    </SidebarSection>
  )
}

export default HealthScore
