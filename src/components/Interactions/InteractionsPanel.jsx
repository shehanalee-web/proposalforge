import { useMemo, useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import InteractionStatusBadge from './InteractionStatusBadge.jsx'
import { INTERACTION_STATUS, INTERACTION_TYPE } from '../../interactions/types.js'
import { INTERACTION_TYPE_LABELS } from '../../interactions/statuses.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './InteractionsPanel.module.css'

function InteractionsPanel(props) {
  if (!props.open) return null
  return <InteractionsPanelBody {...props} />
}

function InteractionsPanelBody({
  proposal,
  onClose,
  interactions,
  loading,
  error,
  actions,
}) {
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const list = Array.isArray(interactions) ? interactions : []
    if (statusFilter === 'all') return list
    return list.filter((item) => item.status === statusFilter)
  }, [interactions, statusFilter])

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
    <aside className={styles.panel} aria-label="Client interactions">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>Client interactions</p>
          <h2 className={styles.title}>{proposal?.title || 'Proposal'}</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close interactions"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={styles.scroll}>
        {loading && !interactions?.length ? (
          <p className={styles.muted}>Loading interactions…</p>
        ) : null}
        {error ? (
          <p className={styles.alert} role="alert">
            {error.message || 'Could not load interactions.'}
          </p>
        ) : null}
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}

        <label className={styles.field}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value={INTERACTION_STATUS.OPEN}>Open</option>
            <option value={INTERACTION_STATUS.ACKNOWLEDGED}>Acknowledged</option>
            <option value={INTERACTION_STATUS.RESOLVED}>Resolved</option>
          </select>
        </label>

        {filtered.length === 0 ? (
          <p className={styles.muted} role="status">
            No client interactions yet.
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <p className={styles.type}>
                    {INTERACTION_TYPE_LABELS[item.type] || item.type}
                  </p>
                  <InteractionStatusBadge status={item.status} />
                </div>
                <p className={styles.message}>{item.message}</p>
                {item.blockId ? (
                  <p className={styles.muted}>
                    {item.blockUnavailable
                      ? `Section unavailable (${item.blockLabel || item.blockId})`
                      : `Section: ${item.blockLabel || item.blockId}`}
                  </p>
                ) : null}
                <p className={styles.muted}>
                  Submitted {item.createdAt ? formatDateTime(item.createdAt) : '—'}
                </p>
                {item.acknowledgedAt ? (
                  <p className={styles.muted}>
                    Acknowledged {formatDateTime(item.acknowledgedAt)}
                  </p>
                ) : null}
                {item.resolvedAt ? (
                  <p className={styles.muted}>Resolved {formatDateTime(item.resolvedAt)}</p>
                ) : null}
                <div className={styles.actions}>
                  {item.status === INTERACTION_STATUS.OPEN ? (
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => run('acknowledge', () => actions.acknowledge(item.id))}
                    >
                      Acknowledge
                    </button>
                  ) : null}
                  {item.status !== INTERACTION_STATUS.RESOLVED ? (
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => run('resolve', () => actions.resolve(item.id))}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {filtered.some((item) => item.type === INTERACTION_TYPE.APPROVAL) ? (
          <p className={styles.note}>
            Client approval is recorded as evidence. It does not change proposal
            workflow on its own.
          </p>
        ) : null}
      </div>
    </aside>
  )
}

export default InteractionsPanel
