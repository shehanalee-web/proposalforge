import AddBlockPicker from './AddBlockPicker.jsx'
import styles from './BlockInsertSlot.module.css'

/**
 * Hover-reveal insert point between blocks.
 *
 * @param {{
 *   onAdd: (type: string) => void,
 *   disabled?: boolean,
 * }} props
 */
function BlockInsertSlot({ onAdd, disabled = false }) {
  return (
    <li className={styles.slot} aria-hidden={disabled}>
      <div className={styles.line} />
      <div className={styles.control}>
        <AddBlockPicker onAdd={onAdd} disabled={disabled} compact />
      </div>
    </li>
  )
}

export default BlockInsertSlot
