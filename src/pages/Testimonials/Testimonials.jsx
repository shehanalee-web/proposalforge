import { Link } from 'react-router'
import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'
import { PATH } from '../../workspace/paths.js'

function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'PF'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function Testimonials() {
  const { kit } = useBrandKit()
  const items = kit?.testimonials ?? []

  return (
    <WorkspacePlaceholder
      moduleId={WORKSPACE_MODULE.TESTIMONIALS}
      action={
        <Link to={PATH.BRAND_KIT} className={styles.action}>
          Edit in Brand Kit
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className={styles.emptyNote}>
          No testimonials yet. Add quotes in Brand Kit and they appear here and
          on proposals with a Testimonials block.
        </p>
      ) : (
        <ul className={styles.records}>
          {items.map((item) => (
            <li key={item.id} className={styles.record}>
              {item.portrait?.url ? (
                <img src={item.portrait.url} alt="" className={styles.portrait} />
              ) : (
                <span className={styles.portraitFallback}>
                  {initials(item.authorName)}
                </span>
              )}
              <div className={styles.recordBody}>
                <p className={styles.recordTitle}>
                  {item.authorName.trim() || 'Untitled'}
                </p>
                <p className={styles.recordMeta}>
                  {[item.authorRole, item.company].filter(Boolean).join(' · ') ||
                    'No attribution'}
                </p>
                {item.quote.trim() ? (
                  <p className={styles.recordQuote}>{item.quote}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePlaceholder>
  )
}

export default Testimonials
