import { useCallback } from 'react'
import { useParams } from 'react-router'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import { fetchPublicPortalView } from '../../services/proposalPortalService.js'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format.js'
import { UNRESOLVED_FACT } from '../../generate/types.js'
import styles from './ProposalPortal.module.css'

function textOrUnresolved(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function Section({ title, children }) {
  if (!children) return null
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function ProposalPortal() {
  const { portalId } = useParams()
  const task = useCallback(() => {
    if (!portalId) return Promise.resolve(null)
    return fetchPublicPortalView(portalId)
  }, [portalId])
  const { data, loading, error } = useAsyncData(task, {
    enabled: Boolean(portalId),
    initialData: null,
  })

  const unavailable = error?.unavailable
  const view = data?.view
  const access = data?.portal

  if (loading && !view) {
    return (
      <div className={styles.shell}>
        <p className={styles.state}>Loading proposal…</p>
      </div>
    )
  }

  if (unavailable || error) {
    return (
      <div className={styles.shell}>
        <main className={styles.unavailable} role="alert">
          <p className={styles.kicker}>Proposal</p>
          <h1 className={styles.title}>This proposal is not available</h1>
          <p className={styles.lead}>
            {unavailable?.message || error?.message || 'This proposal is not available.'}
          </p>
        </main>
      </div>
    )
  }

  if (!view) {
    return (
      <div className={styles.shell}>
        <p className={styles.state}>This proposal is not available.</p>
      </div>
    )
  }

  const pricing = view.pricing
  const summary = textOrUnresolved(view.summary)

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.kicker}>{view.studioName || 'Proposal'}</p>
        <h1 className={styles.title}>{view.title || 'Proposal'}</h1>
        <p className={styles.meta}>
          {[view.company, view.clientName, view.projectType].filter(Boolean).join(' · ')}
        </p>
        <p className={styles.status} role="status">
          {access?.expiresAt
            ? `Valid until ${formatDateTime(access.expiresAt)}`
            : view.validUntil
              ? `Offer valid until ${formatDate(view.validUntil)}`
              : 'Published proposal'}
        </p>
      </header>

      <main className={styles.document}>
        {summary ? (
          <Section title="Summary">
            <p className={styles.body}>{summary}</p>
          </Section>
        ) : null}

        {view.sections.map((section, index) => (
          <Section key={`${section.heading}-${index}`} title={section.heading || 'Section'}>
            {section.body ? <p className={styles.body}>{section.body}</p> : null}
          </Section>
        ))}

        {view.deliverables.length ? (
          <Section title="Deliverables">
            <ul className={styles.list}>
              {view.deliverables.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <strong>{item.title || 'Deliverable'}</strong>
                  {item.body ? <p className={styles.body}>{item.body}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {view.timeline.length ? (
          <Section title="Timeline">
            <ol className={styles.timeline}>
              {view.timeline.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <div className={styles.timeHead}>
                    <strong>{item.title || 'Milestone'}</strong>
                    {item.date ? <span>{item.date}</span> : null}
                  </div>
                  {item.body ? <p className={styles.body}>{item.body}</p> : null}
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {pricing ? (
          <Section title="Investment">
            {pricing.notes ? <p className={styles.body}>{pricing.notes}</p> : null}
            {pricing.items.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.caption}>Pricing</caption>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.items.map((item, index) => (
                      <tr key={`${item.description}-${index}`}>
                        <td>{item.description || UNRESOLVED_FACT}</td>
                        <td>
                          {item.amount == null
                            ? UNRESOLVED_FACT
                            : formatCurrency(item.amount, pricing.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {Number.isFinite(pricing.amount) && pricing.amount > 0 ? (
              <p className={styles.total}>
                Total {formatCurrency(pricing.amount, pricing.currency)}
              </p>
            ) : null}
          </Section>
        ) : null}

        {view.exclusions ? (
          <Section title="Exclusions">
            <p className={styles.body}>{view.exclusions}</p>
          </Section>
        ) : null}

        {view.warranty ? (
          <Section title="Warranty">
            <p className={styles.body}>{view.warranty}</p>
          </Section>
        ) : null}

        {view.terms ? (
          <Section title="Terms">
            <p className={styles.body}>{view.terms}</p>
          </Section>
        ) : null}
      </main>
    </div>
  )
}

export default ProposalPortal
