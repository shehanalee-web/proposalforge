import Icon from '../../components/Icon/Icon.jsx'
import { getBlockMeta } from './blockMeta.js'
import styles from './BlockMiniToolbar.module.css'

function Tool({ label, icon, onClick, disabled, danger, placeholder }) {
  return (
    <button
      type="button"
      className={`${styles.tool} ${danger ? styles.danger : ''} ${placeholder ? styles.placeholder : ''}`}
      onClick={onClick}
      disabled={disabled || placeholder}
      title={label}
      aria-label={label}
    >
      <Icon name={icon} size={13} />
    </button>
  )
}

function BlockMiniToolbar({
  block,
  index,
  total,
  disabled,
  onMove,
  onDuplicate,
  onHide,
  onDelete,
  onAi,
}) {
  const meta = getBlockMeta(block.type)

  return (
    <div className={styles.bar} role="toolbar" aria-label={`${meta.short} actions`}>
      <Tool
        label="Move up"
        icon="arrowUp"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      />
      <Tool
        label="Move down"
        icon="arrowDown"
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
      />
      <Tool label="Duplicate" icon="duplicate" disabled={disabled} onClick={onDuplicate} />
      <Tool
        label={block.enabled ? 'Hide' : 'Show'}
        icon={block.enabled ? 'eye' : 'eyeOff'}
        disabled={disabled}
        onClick={onHide}
      />
      <Tool label="Delete" icon="trash" danger disabled={disabled} onClick={onDelete} />
      <Tool
        label="AI (coming later)"
        icon="spark"
        placeholder
        onClick={onAi}
      />
    </div>
  )
}

export default BlockMiniToolbar
