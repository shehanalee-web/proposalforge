import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../../workflow/actors.js'
import { FORGE_ACTION } from '../../forge/types.js'
import styles from './ProposalCommercial.module.css'

function Card({ title, kicker, children }) {
  return (
    <section className={styles.card} data-forge-actions="true">
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  )
}

/**
 * Studio-only Forge action surface.
 * Never mutates proposals automatically. Follow-ups require an explicit click.
 */
export function ForgeActionsCard({ proposal, actorId = DEFAULT_ACTOR_ID, onFollowupChange }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resultMessage, setResultMessage] = useState('')

  const proposalId = proposal?.id
  const companyId = proposal?.companyId || DEFAULT_COMPANY_ID

  const load = useCallback(async () => {
    if (!proposalId) return
    try {
      const response = await fetch(
        `/api/forge/proposal/${encodeURIComponent(proposalId)}?companyId=${encodeURIComponent(companyId)}&actorId=${encodeURIComponent(actorId)}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Could not load Forge summary.')
        return
      }
      setView(payload)
      setError(null)
    } catch {
      setError('Could not load Forge summary.')
    }
  }, [proposalId, companyId, actorId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!proposalId) return
      try {
        const response = await fetch(
          `/api/forge/proposal/${encodeURIComponent(proposalId)}?companyId=${encodeURIComponent(companyId)}&actorId=${encodeURIComponent(actorId)}`,
        )
        const payload = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setError(payload.message || 'Could not load Forge summary.')
          return
        }
        setView(payload)
        setError(null)
      } catch {
        if (!cancelled) setError('Could not load Forge summary.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proposalId, companyId, actorId])

  async function runAction(action, extras = {}) {
    if (!proposalId || busy) return
    setBusy(true)
    setError(null)
    setResultMessage('')
    try {
      const response = await fetch(
        `/api/forge/proposal/${encodeURIComponent(proposalId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            actorId,
            action,
            ...extras,
          }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.message || 'Forge action failed.')
        return
      }
      setResultMessage(payload.message || 'Done.')
      if (payload.summary || payload.suggestion) {
        setView((prev) => ({
          ...(prev || {}),
          summary: payload.summary || prev?.summary,
          suggestion: payload.suggestion || prev?.suggestion,
          draftMessage: payload.draftMessage ?? prev?.draftMessage,
        }))
      }
      if (
        action === FORGE_ACTION.CREATE_FOLLOWUP ||
        action === FORGE_ACTION.UPDATE_FOLLOWUP
      ) {
        onFollowupChange?.(payload.followup)
        await load()
      }
    } catch {
      setError('Forge action failed.')
    } finally {
      setBusy(false)
    }
  }

  const summary = view?.summary
  const suggestion = view?.suggestion
  const draft = view?.draftMessage || ''

  return (
    <Card title="Forge" kicker="Studio actions">
      <p className={styles.note}>
        Deterministic living + interaction + follow-up intelligence. Nothing is
        sent or applied to the proposal automatically.
      </p>

      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}
      {resultMessage ? <p className={styles.muted}>{resultMessage}</p> : null}

      {summary?.available ? (
        <>
          <p className={styles.cardTitle} style={{ fontSize: '0.95rem' }}>
            Situation
          </p>
          <p className={styles.note}>{summary.narrative}</p>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Opens</dt>
              <dd>{summary.engagement?.opens ?? 0}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Selection</dt>
              <dd>
                {summary.selection?.hasSelection
                  ? summary.selection.packageTitle ||
                    summary.selection.alternativeTitle ||
                    'Yes'
                  : 'None'}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Open feedback</dt>
              <dd>{summary.interactions?.openCount ?? 0}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Open follow-ups</dt>
              <dd>{summary.followups?.openCount ?? 0}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className={styles.muted}>Load a proposal to see Forge summary.</p>
      )}

      {suggestion ? (
        <div className={styles.audit}>
          <p className={styles.kicker}>Suggested next action</p>
          <p className={styles.cardTitle} style={{ fontSize: '0.95rem' }}>
            {suggestion.title}
          </p>
          <p className={styles.note}>{suggestion.description}</p>
        </div>
      ) : null}

      {draft ? (
        <div className={styles.placeholder}>
          <p className={styles.kicker}>Draft message (not sent)</p>
          <p className={styles.note}>{draft}</p>
        </div>
      ) : null}

      <div className={styles.row}>
        <button
          type="button"
          className={styles.publish}
          disabled={busy || !proposalId}
          onClick={() => runAction(FORGE_ACTION.SUMMARIZE_LIVING_STATE)}
        >
          {busy ? 'Working…' : 'Summarize'}
        </button>
        <button
          type="button"
          className={styles.publish}
          disabled={busy || !proposalId}
          onClick={() => runAction(FORGE_ACTION.SUGGEST_NEXT_ACTION)}
        >
          Suggest next action
        </button>
        <button
          type="button"
          className={styles.publish}
          disabled={
            busy ||
            !proposalId ||
            !(suggestion?.createFollowup || suggestion?.updateFollowupId)
          }
          onClick={() =>
            runAction(
              suggestion?.updateFollowupId
                ? FORGE_ACTION.UPDATE_FOLLOWUP
                : FORGE_ACTION.CREATE_FOLLOWUP,
              suggestion?.updateFollowupId
                ? { followupId: suggestion.updateFollowupId }
                : {},
            )
          }
        >
          {suggestion?.updateFollowupId ? 'Update follow-up' : 'Create follow-up'}
        </button>
      </div>
    </Card>
  )
}
