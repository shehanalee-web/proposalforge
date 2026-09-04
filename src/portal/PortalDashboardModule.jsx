import { useId, useState } from 'react'
import Icon from '../components/Icon/Icon.jsx'
import styles from './PortalDashboardModule.module.css'

function PortalDashboardModule({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const headingId = useId()

  return (
    <section className={styles.module} aria-labelledby={headingId}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.icon}>
          <Icon name={icon} size={14} />
        </span>
        <span className={styles.title} id={headingId}>
          {title}
        </span>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
      </button>
      <div className={`${styles.collapse} ${open ? styles.open : ''}`}>
        <div className={styles.body}>{children}</div>
      </div>
    </section>
  )
}

export default PortalDashboardModule
