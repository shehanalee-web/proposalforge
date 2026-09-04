import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import styles from './SettingsSection.module.css'

function SettingsSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
      </button>
      {open ? <div className={styles.body}>{children}</div> : null}
    </section>
  )
}

export default SettingsSection
