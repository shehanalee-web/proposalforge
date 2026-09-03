import styles from './SettingsFields.module.css'

export function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function AreaField({ label, value, onChange, placeholder }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea
        rows={3}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id ?? option.value} value={option.id ?? option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ToggleField({ label, checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export function SliderField({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <label className={styles.field}>
      <span className={styles.sliderLabel}>
        {label}
        <em>
          {value}
          {unit}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <label className={styles.color}>
      <span>{label}</span>
      <span className={styles.colorRow}>
        <input
          type="color"
          value={value?.slice(0, 7) || '#14b8a6'}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
      </span>
    </label>
  )
}

export function FileField({ label, value, onChange, hint }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {value ? (
        <img src={value} alt="" className={styles.thumb} />
      ) : (
        <span className={styles.hint}>{hint || 'No file yet — local only.'}</span>
      )}
      <input
        type="file"
        accept="image/*,.ico"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => onChange(String(reader.result || ''))
          reader.readAsDataURL(file)
        }}
      />
    </label>
  )
}
