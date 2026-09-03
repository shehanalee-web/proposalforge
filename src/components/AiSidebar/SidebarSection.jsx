import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import styles from './SidebarSection.module.css'

/**
 * Collapsible sidebar section with a header, optional icon and badge.
 *
 * @param {{
 *   title: string,
 *   icon?: string,
 *   badge?: string | number,
 *   defaultOpen?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
function SidebarSection({ title, icon, badge, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.left}>
          {icon ? <Icon name={icon} size={14} className={styles.icon} /> : null}
          <span className={styles.title}>{title}</span>
        </span>
        <span className={styles.right}>
          {badge !== undefined ? (
            <span className={styles.badge}>{badge}</span>
          ) : null}
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            size={12}
            className={styles.chevron}
          />
        </span>
      </button>

      {open ? <div className={styles.body}>{children}</div> : null}
    </section>
  )
}

export default SidebarSection
