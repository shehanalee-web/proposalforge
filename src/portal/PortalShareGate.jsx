import { useState } from 'react'
import { SHARE_ACCESS_STATE } from '../models/shareAccess.js'
import styles from '../pages/ClientPortal/ClientPortal.module.css'
import formStyles from './PortalRequestChanges.module.css'

function PortalShareGate({ inspect, error, submitting, onSubmit }) {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const expired = inspect?.state === SHARE_ACCESS_STATE.EXPIRED

  if (expired) {
    return (
      <div className={styles.shell} data-surface="client-portal">
        <main className={styles.main}>
          <div className={styles.state}>
            <p className={styles.stateTitle}>This link has expired</p>
            <p className={styles.stateText}>
              Ask the studio for a new client link if you still need access.
            </p>
          </div>
        </main>
      </div>
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({ password, email })
  }

  return (
    <div className={styles.shell} data-surface="client-portal">
      <main className={styles.main}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>
            {inspect?.title ? inspect.title : 'Open proposal'}
          </p>
          <p className={styles.stateText}>
            This client link is protected. Confirm access to continue.
          </p>
          <form className={formStyles.form} onSubmit={handleSubmit}>
            {error ? (
              <p className={formStyles.banner} role="alert">
                {error.message}
              </p>
            ) : null}
            {inspect?.requireEmail ? (
              <label className={formStyles.field}>
                <span className={formStyles.label}>
                  Client email
                  {inspect.emailHint ? (
                    <span className={formStyles.required}>{inspect.emailHint}</span>
                  ) : null}
                </span>
                <input
                  className={formStyles.input}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={submitting}
                />
              </label>
            ) : null}
            {inspect?.requirePassword ? (
              <label className={formStyles.field}>
                <span className={formStyles.label}>Link password</span>
                <input
                  className={formStyles.input}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                />
              </label>
            ) : null}
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Opening…' : 'Continue'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PortalShareGate
