import { listThemes } from '../../theme/registry.js'
import styles from './ThemePicker.module.css'

function ThemePicker({ value, onChange }) {
  return (
    <ul className={styles.grid}>
      {listThemes().map((theme) => (
        <li key={theme.id}>
          <button
            type="button"
            className={`${styles.card} ${value === theme.id ? styles.on : ''}`}
            onClick={() => onChange(theme.id)}
          >
            <span
              className={styles.swatch}
              style={{
                background: theme.tokens.colors.background,
                color: theme.tokens.colors.accent,
              }}
            >
              <i style={{ background: theme.tokens.colors.accent }} />
              <i style={{ background: theme.tokens.colors.surface }} />
              <i style={{ background: theme.tokens.colors.text }} />
            </span>
            <span className={styles.copy}>
              <strong>{theme.label}</strong>
              <em>{theme.description}</em>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default ThemePicker
