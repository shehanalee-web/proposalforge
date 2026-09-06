import { useEffect, useState } from 'react'
import { formatDateTime } from '../../utils/format.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import styles from './ProposalCommercial.module.css'

function Card({ title, kicker, children }) {
  return (
    <section className={styles.card} data-living-engagement="true">
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

/**
 * Read-only living engagement summary for studio proposal detail.
 * Does not expose client controls or create follow-ups.
 */
export function LivingEngagementCard({ proposal }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const proposalId = proposal?.id
    if (!proposalId) return undefined
    let cancelled = false
    const companyId = proposal.companyId || DEFAULT_COMPANY_ID

    ;(async () => {
      try {
        const response = await fetch(
          `/api/living/proposal/${encodeURIComponent(proposalId)}/events?companyId=${encodeURIComponent(companyId)}`,
        )
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setError(payload.message || 'Could not load living engagement.')
          return
        }
        setSummary(payload.summary ?? null)
        setError(null)
      } catch {
        if (!cancelled) setError('Could not load living engagement.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [proposal?.id, proposal?.companyId])

  return (
    <Card title="Living engagement" kicker="H14 events">
      {error ? <p>{error}</p> : null}
      <dl className={styles.facts}>
        <Fact label="Opens">{summary?.opens ?? 0}</Fact>
        <Fact label="Sections viewed">{summary?.sectionsViewed ?? 0}</Fact>
        <Fact label="Pricing viewed">{summary?.pricingViewed ?? 0}</Fact>
        <Fact label="Package selections">{summary?.packageSelections ?? 0}</Fact>
        <Fact label="Add-on selections">{summary?.addonSelections ?? 0}</Fact>
        <Fact label="Last engagement">
          {summary?.lastEngagementAt
            ? `${formatDateTime(summary.lastEngagementAt)}${
                summary.lastEngagementType ? ` · ${summary.lastEngagementType}` : ''
              }`
            : '—'}
        </Fact>
      </dl>
    </Card>
  )
}
