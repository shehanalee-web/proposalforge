import { getLayout } from '../../layouts/registry.js'
import { formatCurrency } from '../../utils/format.js'
import styles from './VersionCompare.module.css'

const EMPTY = '—'

function asText(value, key) {
  if (value == null || value === '') return EMPTY

  if (key === 'pricing') {
    return formatCurrency(value.amount, value.currency)
  }

  if (key === 'sections') {
    if (!value.length) return EMPTY

    return value
      .map((section, index) => {
        const heading = section.heading?.trim() || `Section ${index + 1}`
        const body = section.body?.trim() || EMPTY
        return `${heading}\n${body}`
      })
      .join('\n\n')
  }

  if (key === 'items') {
    if (!value.length) return EMPTY

    return value
      .map((item) => {
        const description = item.description?.trim() || EMPTY
        return `${description} — ${formatCurrency(item.amount)}`
      })
      .join('\n')
  }

  if (key === 'layout') {
    return value ? getLayout(value).label : EMPTY
  }

  if (key === 'blocks') {
    if (!value.length) return EMPTY

    return value
      .map((block) => {
        const state = block.enabled === false ? 'Off' : 'On'
        const heading =
          block.data?.heading?.trim() ||
          block.data?.kicker?.trim() ||
          block.data?.body?.trim()?.slice(0, 48) ||
          block.type
        return `${block.type} (${state}) — ${heading}`
      })
      .join('\n')
  }

  return String(value)
}

function VersionCompare({ rows }) {
  return (
    <div className={styles.compare}>
      <div className={`${styles.heading} ${styles.current}`}>Current</div>
      <div className={`${styles.heading} ${styles.selected}`}>Selected version</div>

      {rows.map((row) => (
        <section
          key={row.key}
          className={`${styles.row} ${row.changed ? styles.changed : ''}`}
        >
          <h4 className={styles.label}>{row.label}</h4>
          <pre className={`${styles.value} ${styles.current}`}>
            {asText(row.current, row.key)}
          </pre>
          <pre className={`${styles.value} ${styles.selected}`}>
            {asText(row.selected, row.key)}
          </pre>
        </section>
      ))}
    </div>
  )
}

export default VersionCompare
