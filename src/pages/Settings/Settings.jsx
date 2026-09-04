import { useState } from 'react'
import { useSettings } from '../../hooks/useSettings.js'
import { useUpdateSettings } from '../../hooks/useUpdateSettings.js'
import SettingsForm from './SettingsForm.jsx'
import AiSettings from '../../components/AiSettings/AiSettings.jsx'
import styles from './Settings.module.css'

const SKELETON_ROWS = 4

function toFormValues(settings) {
  return {
    studioName: settings.studioName,
    contactEmail: settings.contactEmail,
    defaultProjectType: settings.defaultProjectType,
    currency: settings.currency,
    about: settings.about,
  }
}

function Settings() {
  const { settings, loading, error, refetch } = useSettings()
  const {
    update,
    submitting,
    error: saveError,
    fieldErrors,
    reset,
  } = useUpdateSettings()

  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(false)

  const values = draft ?? (settings ? toFormValues(settings) : null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function handleChange(name, value) {
    if (!values) return

    setSaved(false)
    reset()
    setDraft({ ...values, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!values) return

    const updated = await update({
      studioName: values.studioName,
      contactEmail: values.contactEmail,
      defaultProjectType: values.defaultProjectType,
      about: values.about,
    })

    if (updated) {
      setDraft(toFormValues(updated))
      setSaved(true)
    }
  }

  if (error) {
    return (
      <section className="studio-page">
        <div className="studio-banner" role="alert">
          <p className="studio-banner-title">Could not load settings</p>
          <p className="studio-banner-text">
            {error.message || 'Something went wrong while fetching settings.'}
          </p>
          <button type="button" className={`studio-btn-secondary ${styles.retry}`} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (loading || !values) {
    return (
      <section className="studio-page">
        <header className="studio-hero">
          <p className="studio-kicker">Studio profile</p>
          <p className="studio-intro">Loading studio profile…</p>
        </header>
        <div className={`studio-panel ${styles.panel}`}>
          <div className={styles.skeleton} aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className={`studio-skeleton ${styles.skeletonRow}`} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="studio-page">
      <header className="studio-hero">
        <p className="studio-kicker">Studio profile</p>
        <p className="studio-intro">
          These details identify your studio on proposals. Company name, email
          and description stay in sync with Brand Kit.
        </p>
      </header>

      {saved ? (
        <p className="studio-success" role="status">
          Settings saved.
        </p>
      ) : null}

      {requestError ? (
        <div className="studio-banner" role="alert">
          <p className="studio-banner-title">Could not save settings</p>
          <p className="studio-banner-text">
            {requestError.message || 'Something went wrong. Please try again.'}
          </p>
          <button
            type="button"
            className={`studio-btn-secondary ${styles.retry}`}
            onClick={handleSubmit}
            disabled={submitting}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className={`studio-panel ${styles.panel}`}>
        <SettingsForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          fieldErrors={fieldErrors}
        />
      </div>

      <AiSettings />
    </section>
  )
}

export default Settings
