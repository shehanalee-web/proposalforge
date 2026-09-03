import { useMemo } from 'react'
import Icon from '../Icon/Icon.jsx'
import { listEnabledBlocks } from '../../blocks/instance.js'
import { isBlockDataEmpty } from '../../blocks/schemas.js'
import SidebarSection from './SidebarSection.jsx'
import styles from './HealthScore.module.css'

/**
 * Proposal Health Score — placeholder checklist that reports how
 * complete the current proposal feels. Scores are derived from
 * block presence, not AI.
 */

const CHECKS = [
  {
    id: 'cover',
    label: 'Cover / Hero filled',
    test: (blocks) =>
      blocks.some((b) => b.type === 'cover' && !isBlockDataEmpty(b.type, b.data)),
  },
  {
    id: 'summary',
    label: 'Executive summary written',
    test: (blocks) =>
      blocks.some(
        (b) => b.type === 'executive-summary' && !isBlockDataEmpty(b.type, b.data),
      ),
  },
  {
    id: 'pricing',
    label: 'Pricing added',
    test: (blocks) =>
      blocks.some(
        (b) => b.type === 'pricing' && !isBlockDataEmpty(b.type, b.data),
      ),
  },
  {
    id: 'team',
    label: 'Team introduced',
    test: (blocks) =>
      blocks.some(
        (b) => b.type === 'team' && !isBlockDataEmpty(b.type, b.data),
      ),
  },
  {
    id: 'terms',
    label: 'Terms & conditions set',
    test: (blocks) =>
      blocks.some(
        (b) => b.type === 'terms' && !isBlockDataEmpty(b.type, b.data),
      ),
  },
  {
    id: 'signature',
    label: 'Signature block present',
    test: (blocks) => blocks.some((b) => b.type === 'signature'),
  },
]

function HealthScore({ blocks }) {
  const enabled = useMemo(
    () => listEnabledBlocks(blocks ?? []),
    [blocks],
  )

  const results = useMemo(
    () => CHECKS.map((check) => ({ ...check, pass: check.test(enabled) })),
    [enabled],
  )

  const passed = results.filter((r) => r.pass).length
  const total = results.length
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <SidebarSection title="Proposal Health" icon="check" badge={`${pct}%`}>
      <div className={styles.root}>
        {/* Progress bar */}
        <div className={styles.bar}>
          <div
            className={styles.barFill}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Checklist */}
        <ul className={styles.list}>
          {results.map((item) => (
            <li
              key={item.id}
              className={`${styles.item} ${item.pass ? styles.itemPass : ''}`}
            >
              <Icon name={item.pass ? 'check' : 'close'} size={12} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </SidebarSection>
  )
}

export default HealthScore
