import Icon from '../Icon/Icon.jsx'
import { PORTAL_ACTOR } from '../../models/portalPermissions.js'
import { CLIENT_ACTIVITY_ICON } from '../../models/clientActivity.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './ActivityTimeline.module.css'

function ActivityTimeline({
  events = [],
  clientLabel = 'Client',
  studioLabel = 'Studio',
  empty = 'No activity recorded yet.',
  withIcons = false,
}) {
  if (events.length === 0) {
    return <p className={styles.empty}>{empty}</p>
  }

  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li
          key={event.id}
          className={`${styles.event} ${withIcons ? styles.eventIcons : ''}`}
        >
          <span className={`${styles.dot} ${withIcons ? styles.dotIcon : ''}`} data-type={event.type}>
            {withIcons ? (
              <Icon
                name={CLIENT_ACTIVITY_ICON[event.type] || 'activity'}
                size={12}
              />
            ) : null}
          </span>
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
