import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import PortalStatusBadge from './PortalStatusBadge.jsx'
import { portalActivityLabel } from './format.js'
import { getPortalStatusMeta } from '../../portal/statuses.js'
import { PORTAL_STATUS } from '../../portal/types.js'
import { formatDateTime } from '../../utils/format.js'
import { portalPath } from '../../workspace/paths.js'
import styles from './PortalPanel.module.css'

function PortalPanel(props) {
  if (!props.open) return null
  return <PortalPanelBody {...props} />
}

function PortalPanelBody({
  proposal,
  onClose,
  portal,
  loading,
  error,
  actions,
}) {
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const status = portal?.status ?? PORTAL_STATUS.DRAFT
  const meta = getPortalStatusMeta(status)
  const published = status === PORTAL_STATUS.PUBLISHED
  const activity = portal?.activity ?? []

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

  const publicHref = portal?.publicPath || (portal?.id ? portalPath(portal.id) : '')

  return (
    <aside className={styles.panel} aria-label="Client portal">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>Client portal</p>
          <h2 className={styles.title}>{proposal?.title || 'Proposal'}</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close portal"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={styles.scroll}>
        {loading && !portal ? <p className={styles.muted}>Loading portal…</p> : null}
        {error ? (
          <p className={styles.alert} role="alert">
            {error.message || 'Could not load portal access.'}
          </p>
        ) : null}
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <PortalStatusBadge status={status} />
            <p className={styles.muted}>{meta.description}</p>
          </div>
          <p className={styles.note} role="status">
            Publishing is an explicit action. Approval or Ready to Send never publishes on its own.
          </p>
          <p className={styles.note}>
            Access uses a revocable portal identifier. It is not enterprise authentication.
          </p>
        </section>

        <section className={styles.card}>
          <h3 className={styles.sectionTitle}>Publish</h3>
          <label className={styles.field}>
            <span>Optional expiry</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              disabled={busy}
            />
          </label>
          <div className={styles.actions}>
            {!portal ? (
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => run('create portal access', () => actions.create())}
              >
                Create draft access
              </button>
            ) : null}
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() =>
                run('publish', () =>
                  actions.publish({
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                    clientLabel: proposal?.title,
                  }),
                )
              }
            >
              {published ? 'Update publication' : 'Publish to client'}
            </button>
            {published ? (
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() => run('revoke', () => actions.revoke())}
              >
                Revoke access
              </button>
            ) : null}
          </div>
        </section>

        {publicHref ? (
          <section className={styles.card}>
            <h3 className={styles.sectionTitle}>Client view</h3>
            <p className={styles.muted}>
              {published
                ? 'Open the client-facing page. Internal scores and comments are not included.'
                : 'Preview the client-safe page. Clients cannot see this until you publish.'}
            </p>
            <a className={styles.link} href={publicHref} target="_blank" rel="noreferrer">
              Open client preview
            </a>
            {portal?.publishedAt ? (
              <p className={styles.muted}>Published {formatDateTime(portal.publishedAt)}</p>
            ) : null}
            {portal?.expiresAt ? (
              <p className={styles.muted}>Expires {formatDateTime(portal.expiresAt)}</p>
            ) : null}
          </section>
        ) : null}

        <section className={styles.card}>
          <h3 className={styles.sectionTitle}>Activity</h3>
          {activity.length === 0 ? (
            <p className={styles.muted}>No portal events yet.</p>
          ) : (
            <ol className={styles.activity}>
              {activity
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className={styles.item}>
                    <span className={styles.itemTitle}>{portalActivityLabel(event)}</span>
                    <span className={styles.muted}>{formatDateTime(event.createdAt)}</span>
                  </li>
                ))}
            </ol>
          )}
        </section>
      </div>
    </aside>
  )
}

export default PortalPanel
