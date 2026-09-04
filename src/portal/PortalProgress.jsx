import { buildPortalProgress } from '../models/portalProgress.js'
import Icon from '../components/Icon/Icon.jsx'
import styles from './PortalProgress.module.css'

function PortalProgress({ proposal }) {
  const progress = buildPortalProgress(proposal)

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <span>{progress.complete} of {progress.total} complete</span>
        <span>{progress.percent}%</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${progress.percent}%` }} />
      </div>
      <ol className={styles.steps}>
        {progress.steps.map((step) => (
          <li key={step.id} className={styles.step} data-done={step.done}>
            <span className={styles.mark}>
              {step.done ? <Icon name="check" size={11} /> : null}
            </span>
            <span>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.state}>
                {step.done ? 'Complete' : step.skipped ? 'Skipped' : step.pendingLabel}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default PortalProgress
