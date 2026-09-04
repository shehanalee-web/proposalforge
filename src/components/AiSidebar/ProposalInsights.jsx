import { useProposalIntelligence } from '../../hooks/useProposalIntelligence.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './ProposalInsights.module.css'

function stars(count) {
  const n = Math.max(1, Math.min(5, Number(count) || 1))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

/**
 * Horizon 5.5 insights below the Proposal Intelligence summary card.
 * The summary card itself is unchanged.
 */
function ProposalInsights({ proposal, blocks }) {
  const report = useProposalIntelligence(proposal, blocks)
  const insights = report.insights
  if (!insights) return null

  const { observations, executivePriority, strengths, clusters, forecast, reviewTime } = insights
  const timeline = report.timeline
  const hasTimeline =
    (timeline?.immediate?.length || 0) +
      (timeline?.recommended?.length || 0) +
      (timeline?.optional?.length || 0) >
    0

  return (
    <SidebarSection
      title="Executive Insights"
      icon="activity"
      badge={reviewTime?.label}
    >
      <div className={styles.root}>
        {executivePriority ? (
          <div className={styles.priority}>
            <span className={styles.label}>Executive Priority</span>
            <span className={styles.priorityHeadline}>{executivePriority.headline}</span>
            <span className={styles.value}>{executivePriority.detail}</span>
          </div>
        ) : null}

        {observations?.length ? (
          <div className={styles.block}>
            <span className={styles.label}>Executive Insights</span>
            <ul className={styles.list}>
              {observations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {strengths?.length ? (
          <div className={styles.block}>
            <span className={styles.label}>Business Strengths</span>
            <ul className={styles.list}>
              {strengths.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {clusters?.length ? (
          <div className={styles.block}>
            <span className={styles.label}>Weakness Clusters</span>
            <div className={styles.clusters}>
              {clusters.map((cluster) => (
                <div key={cluster.id} className={styles.cluster}>
                  <span className={styles.clusterTitle}>{cluster.label}</span>
                  <ul className={styles.list}>
                    {cluster.items.map((item) => (
                      <li key={item.id}>{item.title}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {forecast?.path?.length ? (
          <div className={styles.block}>
            <span className={styles.label}>Confidence Gain</span>
            <ol className={styles.path}>
              {forecast.path.map((step) => (
                <li key={step.id ?? step.code ?? 'current'}>
                  <span className={styles.pathLabel}>{step.label}</span>
                  <span className={styles.pathValue}>{step.confidence}%</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {forecast?.items?.length ? (
          <div className={styles.block}>
            <span className={styles.label}>Improvement Forecast</span>
            <div className={styles.forecasts}>
              {forecast.items.map((item) => (
                <article key={item.id} className={styles.forecast}>
                  <h3 className={styles.forecastTitle}>{item.title}</h3>
                  <p className={styles.meta}>
                    <span className={styles.kicker}>Expected Impact</span>
                    <span aria-label={`${item.stars} out of 5`}>{stars(item.stars)}</span>
                  </p>
                  <p className={styles.meta}>
                    <span className={styles.kicker}>Estimated Client Confidence</span>
                    {item.clientConfidence}
                  </p>
                  <p className={styles.meta}>
                    <span className={styles.kicker}>Estimated Proposal Clarity</span>
                    {item.proposalClarity}
                  </p>
                  {item.stars <= 1 && item.impactNote ? (
                    <p className={styles.note}>{item.impactNote}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {hasTimeline ? (
          <div className={styles.block}>
            <span className={styles.label}>Repair Timeline</span>
            <div className={styles.clusters}>
              {timeline.immediate?.length ? (
                <div className={styles.cluster}>
                  <span className={styles.clusterTitle}>Immediate</span>
                  <ul className={styles.list}>
                    {timeline.immediate.map((item) => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {timeline.recommended?.length ? (
                <div className={styles.cluster}>
                  <span className={styles.clusterTitle}>Recommended</span>
                  <ul className={styles.list}>
                    {timeline.recommended.map((item) => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {timeline.optional?.length ? (
                <div className={styles.cluster}>
                  <span className={styles.clusterTitle}>Optional</span>
                  <ul className={styles.list}>
                    {timeline.optional.map((item) => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {reviewTime ? (
          <div className={styles.block}>
            <span className={styles.label}>Estimated Review Time</span>
            <span className={styles.value}>{reviewTime.label}</span>
            <span className={styles.note}>{reviewTime.detail}</span>
          </div>
        ) : null}
      </div>
    </SidebarSection>
  )
}

export default ProposalInsights
