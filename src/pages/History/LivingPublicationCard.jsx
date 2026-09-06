import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '../../utils/format.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import styles from './ProposalCommercial.module.css'

function Card({ title, kicker, children }) {
  return (
    <section className={styles.card} data-living-publication="true">
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
 * Studio publication surface: current published state, dirty flag, publish,
 * and historical immutable snapshots. Does not edit snapshots.
 */
export function LivingPublicationCard({ proposal }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const proposalId = proposal?.id
  const companyId = proposal?.companyId || DEFAULT_COMPANY_ID

  const load = useCallback(async () => {
    if (!proposalId) return
    try {
      const response = await fetch(
        `/api/living/proposal/${encodeURIComponent(proposalId)}/publication?companyId=${encodeURIComponent(companyId)}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not load publication state.')
        return
      }
      setState(payload)
      setError(null)
    } catch {
      setError('Could not load publication state.')
    }
  }, [proposalId, companyId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!proposalId) return
      try {
        const response = await fetch(
          `/api/living/proposal/${encodeURIComponent(proposalId)}/publication?companyId=${encodeURIComponent(companyId)}`,
        )
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setError(payload.message || 'Could not load publication state.')
          return
        }
        setState(payload)
        setError(null)
      } catch {
        if (!cancelled) setError('Could not load publication state.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proposalId, companyId])

  async function handlePublish() {
    if (!proposalId || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/living/proposal/${encodeURIComponent(proposalId)}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not publish Living Proposal.')
        return
      }
      await load()
    } catch {
      setError('Could not publish Living Proposal.')
    } finally {
      setBusy(false)
    }
  }

  const current = state?.current
  const snapshots = state?.snapshots ?? []

  return (
    <Card title="Living publication" kicker="H14 snapshots">
      {error ? <p className={styles.note}>{error}</p> : null}
      <dl className={styles.facts}>
        <Fact label="Status">{current ? 'Published' : 'Not published'}</Fact>
        <Fact label="Version">
          {current ? `v${current.snapshotNumber}` : '—'}
        </Fact>
        <Fact label="Published">
          {current?.publishedAt ? formatDateTime(current.publishedAt) : '—'}
        </Fact>
        <Fact label="Authored differs">
          {current ? (state?.hasUnpublishedChanges ? 'Yes' : 'No') : '—'}
        </Fact>
      </dl>

      <div className={styles.row}>
        <button
          type="button"
          className={styles.publish}
          onClick={handlePublish}
          disabled={busy || !proposalId}
        >
          {busy ? 'Publishing…' : current ? 'Publish update' : 'Publish Living Proposal'}
        </button>
        <p className={styles.note}>
          Creates an immutable snapshot. Client views use the latest published
          version; unpublished edits stay in the studio draft.
        </p>
      </div>

      {snapshots.length > 0 ? (
        <div className={styles.audit}>
          <p className={styles.kicker}>Historical snapshots</p>
          <ul>
            {snapshots.map((item) => (
              <li key={item.id}>
                <span>
                  v{item.snapshotNumber}
                  {item.sourceRevision != null ? ` · rev ${item.sourceRevision}` : ''}
                </span>
                <span>{item.publishedAt ? formatDateTime(item.publishedAt) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.muted}>No snapshots yet.</p>
      )}
    </Card>
  )
}
