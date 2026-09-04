import Icon from '../../components/Icon/Icon.jsx'
import { getBlockMeta } from './blockMeta.js'
import styles from './BlockHeader.module.css'

function BlockHeader({
  block,
  expanded,
  disabled,
  onToggle,
  onKeyDown,
  gripProps,
}) {
  const meta = getBlockMeta(block.type)

  return (
    <div className={styles.header}>
      <button
        type="button"
        data-block-grip
        className={styles.grip}
        disabled={disabled}
        aria-label={`Move ${meta.short}`}
        {...gripProps}
      >
        <Icon name="grip" size={14} />
      </button>

      <button
        type="button"
        className={styles.titleBtn}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        aria-expanded={expanded}
      >
        <span className={styles.icon}>
          <Icon name={meta.icon} size={16} />
        </span>
        <span className={styles.copy}>
          <span className={styles.titleRow}>
            <span className={styles.title}>{meta.short}</span>
            <span className={styles.badge}>{meta.label}</span>
            {!block.enabled ? <span className={styles.hidden}>Hidden</span> : null}
          </span>
          <span className={styles.description}>{meta.description}</span>
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
        />
      </button>
    </div>
  )
}

export default BlockHeader
