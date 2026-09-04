import Icon from '../components/Icon/Icon.jsx'
import StatusBadge from '../components/StatusBadge/StatusBadge.jsx'
import { getDisplayStatus } from '../models/proposal.js'
import { assetRefUrl } from '../models/brandKit.js'
import { formatDate } from '../utils/format.js'
import { useBrandKit } from '../hooks/useBrandKit.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalShell.module.css'

function PortalHeader({ asideOpen, onToggleAside }) {
  const { proposal } = usePortal()
  const { kit } = useBrandKit()
  const company = kit?.companyName || 'Proposal'
  const logo =
    assetRefUrl(kit?.logos?.light) ||
    assetRefUrl(kit?.logos?.primary) ||
    ''
  const status = getDisplayStatus(proposal)

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        {logo ? (
          <img src={logo} alt="" className={styles.logo} />
        ) : (
          <span className={styles.mark} aria-hidden="true">
            {company.slice(0, 1)}
          </span>
        )}
        <div>
          <p className={styles.company}>{company}</p>
          <p className={styles.kicker}>Client proposal</p>
        </div>
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title}>{proposal.title}</h1>
        <p className={styles.prepared}>
          Prepared for {proposal.clientName}
          {proposal.company ? ` · ${proposal.company}` : ''}
        </p>
      </div>

      <div className={styles.meta}>
        <StatusBadge status={status} />
        {proposal.validUntil ? (
          <span className={styles.valid}>Valid until {formatDate(proposal.validUntil)}</span>
        ) : null}
        <button
          type="button"
          className={styles.asideToggle}
          onClick={onToggleAside}
          aria-expanded={asideOpen}
          aria-controls="portal-aside"
        >
          <Icon name="menu" size={16} />
          Details
        </button>
      </div>
    </header>
  )
}

export default PortalHeader
