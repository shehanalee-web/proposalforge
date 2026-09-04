import Icon from '../components/Icon/Icon.jsx'
import ActivityTimeline from '../components/ActivityTimeline/ActivityTimeline.jsx'
import {
  ACTIVITY_AUDIENCE,
  buildProposalTimeline,
} from '../models/clientActivity.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalAside.module.css'

function PortalActivity({ bare = false }) {
  const { proposal } = usePortal()
  const events = buildProposalTimeline(proposal, {
    audience: ACTIVITY_AUDIENCE.CLIENT,
  })

  const body =
    events.length > 0 ? (
      <ActivityTimeline
        events={events}
        clientLabel="You"
        studioLabel="Studio"
      />
    ) : (
      <p className={styles.empty}>Activity will appear here as you move through this proposal.</p>
    )

  if (bare) return body

  return (
    <section className={styles.panel} aria-labelledby="portal-activity-heading">
      <header className={styles.head}>
        <p className={styles.kicker} id="portal-activity-heading">
          Activity
        </p>
        <Icon name="clock" size={14} />
      </header>
      {body}
    </section>
  )
}

export default PortalActivity
