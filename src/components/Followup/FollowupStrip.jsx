import FollowupStatusBadge from './FollowupStatusBadge.jsx'
import { reasonLabel } from '../../followup/reasons.js'
import { formatDate } from '../../utils/format.js'
import styles from './FollowupStrip.module.css'

function FollowupStrip({ nextAction, onOpen }) {
  return (
    <div className={styles.strip}>
      <div className={styles.main}>
        <p className={styles.kicker}>Next action</p>
        {nextAction ? (
          <>
            <div className={styles.row}>
              <FollowupStatusBadge status={nextAction.status} compact />
              <span className={styles.meta}>{nextAction.title}</span>
            </div>
            <p className={styles.next} role="status">
              Reason: {reasonLabel(nextAction.reason)}
              {nextAction.ownerName ? ` · Owner: ${nextAction.ownerName}` : ''}
              {nextAction.dueAt ? ` · Due: ${formatDate(nextAction.dueAt)}` : ''}
            </p>
          </>
        ) : (
          <p className={styles.next} role="status">
            No follow-up needed right now.
          </p>
        )}
      </div>
      <button type="button" className={styles.open} onClick={onOpen}>
        Open follow-up
      </button>
    </div>
  )
}

export default FollowupStrip
