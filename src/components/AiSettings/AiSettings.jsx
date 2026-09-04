import { useEffect, useState } from 'react'
import { fetchAiSettings } from '../../improve/client.js'
import styles from './AiSettings.module.css'

/**
 * Read-only AI engine status. Provider, model and keys live in environment
 * variables — this panel never accepts or displays secrets.
 */
function AiSettings() {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let active = true
    fetchAiSettings()
      .then((next) => {
        if (active) setSettings(next)
      })
      .catch(() => {
        if (active) {
          setSettings({
            provider: 'mock',
            model: 'mock',
            configuredVia: 'environment',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  const rows = settings
    ? [
        ['Provider', settings.provider],
        ['Model', settings.model],
        ['Temperature', settings.temperature],
        ['Max tokens', settings.maxTokens],
        ['Streaming', settings.supportsStreaming && settings.streaming ? 'On' : 'Off'],
        ['API key', settings.hasApiKey ? 'Configured' : 'Not set'],
      ]
    : []

  return (
    <section className={`studio-panel ${styles.panel}`} aria-labelledby="ai-engine-heading">
      <h2 id="ai-engine-heading" className={styles.title}>
        AI engine
      </h2>
      <p className={styles.lead}>
        Improvements use the provider in <code>AI_PROVIDER</code>. Keys stay on
        the server. Incomplete config falls back to the mock generator.
      </p>
      {settings ? (
        <dl className={styles.list}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.row}>
              <dt>{label}</dt>
              <dd>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.lead}>Loading AI configuration…</p>
      )}
      {settings?.fallback ? (
        <p className={styles.note}>
          Requested {settings.requestedProvider}, using {settings.provider}.
        </p>
      ) : null}
    </section>
  )
}

export default AiSettings
