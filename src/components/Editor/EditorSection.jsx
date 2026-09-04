import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import styles from './EditorSection.module.css'

/**
 * Collapsible editor section — Notion-style grouped fields.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   defaultOpen?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
function EditorSection({ title, description, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.title}>{title}</span>
        <Icon
          name={open ? 'chevronUp' : 'chevronDown'}
          size={14}
          className={styles.chevron}
        />
      </button>

      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}

      <div
        className={`${styles.body} ${open ? styles.bodyOpen : styles.bodyClosed}`}
        aria-hidden={!open}
      >
        <div className={styles.bodyInner}>{children}</div>
      </div>
    </section>
  )
}

export default EditorSection
