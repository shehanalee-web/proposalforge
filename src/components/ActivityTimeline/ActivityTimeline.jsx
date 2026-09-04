import { PORTAL_ACTOR } from '../../models/portalPermissions.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './ActivityTimeline.module.css'

function ActivityTimeline({
  events = [],
  clientLabel = 'Client',
  studioLabel = 'Studio',
  empty = 'No activity recorded yet.',
}) {
  if (events.length === 0) {
    return <p className={styles.empty}>{empty}</p>
  }

  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles.event}>
          <span className={styles.dot} data-type={event.type} />
          <div>
            <p className={styles.label}>{event.label}</p>
            {event.detail ? <p className={styles.detail}>{event.detail}</p> : null}
            <p className={styles.meta}>
              {formatDateTime(event.at)}
              {event.actor === PORTAL_ACTOR.STUDIO
                ? ` · ${studioLabel}`
                : ` · ${clientLabel}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default ActivityTimeline
