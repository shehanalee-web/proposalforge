import PortalStatusBadge from './PortalStatusBadge.jsx'
import { getPortalStatusMeta } from '../../portal/statuses.js'
import styles from './PortalStrip.module.css'

function PortalStrip({ portal, onOpen }) {
  const status = portal?.status ?? 'draft'
  const meta = getPortalStatusMeta(status)

  return (
    <div className={styles.strip}>
      <div className={styles.main}>
        <p className={styles.kicker}>Client portal</p>
        <div className={styles.row}>
          <PortalStatusBadge status={status} />
          <span className={styles.meta}>{meta.description}</span>
        </div>
      </div>
      <button type="button" className={styles.open} onClick={onOpen}>
        Open portal
      </button>
    </div>
  )
}

export default PortalStrip
