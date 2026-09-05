import { useMemo, useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import FollowupStatusBadge from './FollowupStatusBadge.jsx'
import { FOLLOWUP_STATUS } from '../../followup/types.js'
import { FOLLOWUP_REASON_LABELS } from '../../followup/statuses.js'
import { actorsForCompany } from '../../workflow/actors.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { formatDate, formatDateTime } from '../../utils/format.js'
import styles from './FollowupPanel.module.css'

function FollowupPanel(props) {
  if (!props.open) return null
  return <FollowupPanelBody {...props} />
}

function FollowupPanelBody({
  proposal,
  onClose,
  followups,
  nextAction,
  loading,
  error,
  actions,
}) {
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [manualTitle, setManualTitle] = useState('Follow up')
  const [manualDue, setManualDue] = useState('')
  const [manualOwner, setManualOwner] = useState('')

  const companyActors = actorsForCompany(proposal?.companyId || DEFAULT_COMPANY_ID)

  const filtered = useMemo(() => {
    const list = Array.isArray(followups) ? followups : []
    return list.filter((item) => {
      if (statusFilter === 'open') {
        if (item.status !== FOLLOWUP_STATUS.OPEN && item.status !== FOLLOWUP_STATUS.IN_PROGRESS) {
          return false
        }
      } else if (statusFilter === 'overdue') {
        if (!item.overdue) return false
      } else if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      if (reasonFilter !== 'all' && item.reason !== reasonFilter) return false
      return true
    })
  }, [followups, statusFilter, reasonFilter])

  async function run(label, fn) {
    setBusy(true)
    setFormError('')
    try {
      await fn()
    } catch (caught) {
      setFormError(caught.message || `Could not ${label}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className={styles.panel} aria-label="Proposal follow-up">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>Follow-up</p>
          <h2 className={styles.title}>{proposal?.title || 'Proposal'}</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close follow-up"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={styles.scroll}>
        {loading && !followups?.length ? (
          <p className={styles.muted}>Loading follow-ups…</p>
        ) : null}
        {error ? (
          <p className={styles.alert} role="alert">
            {error.message || 'Could not load follow-ups.'}
          </p>
        ) : null}
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}

        <section className={styles.nextBox}>
          <p className={styles.kicker}>Next action</p>
          {nextAction ? (
            <>
              <p className={styles.nextTitle}>{nextAction.title}</p>
              <p className={styles.muted}>
                Reason: {FOLLOWUP_REASON_LABELS[nextAction.reason] || nextAction.reason}
              </p>
              <p className={styles.muted}>
                Owner: {nextAction.ownerName || 'Unassigned'}
                {nextAction.dueAt ? ` · Due: ${formatDate(nextAction.dueAt)}` : ''}
              </p>
              {nextAction.description ? (
                <p className={styles.muted}>{nextAction.description}</p>
              ) : null}
            </>
          ) : (
            <p className={styles.muted}>No actionable follow-up on this proposal.</p>
          )}
        </section>

        <label className={styles.field}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="open">Open</option>
            <option value="overdue">Overdue</option>
            <option value={FOLLOWUP_STATUS.COMPLETED}>Completed</option>
            <option value={FOLLOWUP_STATUS.DISMISSED}>Dismissed</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className={styles.field}>
          Reason
          <select
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value)}
          >
            <option value="all">All reasons</option>
            {Object.entries(FOLLOWUP_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {filtered.length === 0 ? (
          <p className={styles.muted} role="status">
            No follow-ups in this filter.
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <p className={styles.type}>{item.title}</p>
                  <FollowupStatusBadge status={item.status} />
                </div>
                <p className={styles.muted}>
                  {FOLLOWUP_REASON_LABELS[item.reason] || item.reason}
                  {item.overdue ? ' · Overdue' : ''}
                </p>
                <p className={styles.muted}>{item.description}</p>
                <p className={styles.muted}>
                  Owner: {item.ownerName || 'Unassigned'}
                  {item.dueAt ? ` · Due ${formatDateTime(item.dueAt)}` : ''}
                </p>
                {item.status === FOLLOWUP_STATUS.COMPLETED ||
                item.status === FOLLOWUP_STATUS.DISMISSED ? null : (
                  <div className={styles.actions}>
                    {item.status === FOLLOWUP_STATUS.OPEN ? (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={busy}
                        onClick={() => run('start', () => actions.start(item.id))}
                      >
                        Start
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => run('complete', () => actions.complete(item.id))}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busy}
                      onClick={() => run('dismiss', () => actions.dismiss(item.id))}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {item.status === FOLLOWUP_STATUS.COMPLETED ||
                item.status === FOLLOWUP_STATUS.DISMISSED ? null : (
                  <div className={styles.editRow}>
                    <label className={styles.field}>
                      Owner
                      <select
                        value={item.ownerActorId || ''}
                        disabled={busy}
                        onChange={(event) =>
                          run('assign', () => actions.assign(item.id, event.target.value))
                        }
                      >
                        <option value="">Unassigned</option>
                        {companyActors.map((actor) => (
                          <option key={actor.id} value={actor.id}>
                            {actor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      Due date
                      <input
                        type="date"
                        defaultValue={item.dueAt ? item.dueAt.slice(0, 10) : ''}
                        disabled={busy}
                        onBlur={(event) => {
                          const value = event.target.value
                          if (!value) return
                          const next = `${value}T17:00:00.000`
                          if (item.dueAt && item.dueAt.startsWith(value)) return
                          run('schedule', () => actions.schedule(item.id, next))
                        }}
                      />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          className={styles.manual}
          onSubmit={(event) => {
            event.preventDefault()
            run('create', () =>
              actions.create({
                title: manualTitle,
                dueAt: manualDue ? `${manualDue}T17:00:00.000` : undefined,
                ownerActorId: manualOwner || undefined,
              }),
            )
          }}
        >
          <p className={styles.kicker}>Manual follow-up</p>
          <label className={styles.field}>
            Title
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className={styles.field}>
            Owner
            <select
              value={manualOwner}
              onChange={(event) => setManualOwner(event.target.value)}
              disabled={busy}
            >
              <option value="">Default owner</option>
              {companyActors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Due date
            <input
              type="date"
              value={manualDue}
              onChange={(event) => setManualDue(event.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className={styles.primary} disabled={busy}>
            Create follow-up
          </button>
          <p className={styles.note}>
            This only records a studio reminder. It does not send email or messages.
          </p>
        </form>
      </div>
    </aside>
  )
}

export default FollowupPanel
