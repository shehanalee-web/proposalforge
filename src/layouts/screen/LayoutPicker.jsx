import { listLayouts } from '../registry.js'
import styles from './LayoutPicker.module.css'

function LayoutPicker({
  id = 'layoutId',
  name = 'layoutId',
  value,
  onChange,
  disabled = false,
  label = 'Layout',
}) {
  const layouts = listLayouts()

  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>{label}</legend>
      <p className={styles.hint}>
        Changes the page shape only. Content stays the same and can be switched
        at any time.
      </p>
      <div className={styles.grid} role="radiogroup" aria-label={label}>
        {layouts.map((layout) => {
          const selected = value === layout.id
          const previewClass =
            layout.orientation === 'landscape'
              ? `${styles.preview} ${styles.previewLandscape}`
              : `${styles.preview} ${styles.previewPortrait}`

          return (
            <label
              key={layout.id}
              className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}
            >
              <input
                className={styles.input}
                type="radio"
                name={name}
                id={`${id}-${layout.id}`}
                value={layout.id}
                checked={selected}
                onChange={(event) => onChange(event.target.value)}
              />
              <span className={previewClass} aria-hidden="true">
                <span className={styles.previewBar} />
                <span className={styles.previewLine} />
                <span className={styles.previewLine} />
              </span>
              <span className={styles.copy}>
                <span className={styles.title}>{layout.label}</span>
                <span className={styles.description}>{layout.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default LayoutPicker
