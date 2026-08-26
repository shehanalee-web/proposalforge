import { useState } from 'react'
import { useSettings } from '../../hooks/useSettings.js'
import { useUpdateSettings } from '../../hooks/useUpdateSettings.js'
import SettingsForm from './SettingsForm.jsx'
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
      <section className={styles.page}>
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not load settings</p>
          <p className={styles.bannerText}>
            {error.message || 'Something went wrong while fetching settings.'}
          </p>
          <button type="button" className={styles.retry} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (loading || !values) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading studio profile…</p>
        <div className={styles.panel}>
          <div className={styles.skeleton} aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className={styles.skeletonRow} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        These details identify your studio on proposals. They reset when the
        page reloads — nothing is stored on this device yet.
      </p>

      {saved ? (
        <p className={styles.success} role="status">
          Settings saved.
        </p>
      ) : null}

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not save settings</p>
          <p className={styles.bannerText}>
            {requestError.message || 'Something went wrong. Please try again.'}
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={handleSubmit}
            disabled={submitting}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className={styles.panel}>
        <SettingsForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          fieldErrors={fieldErrors}
        />
      </div>
    </section>
  )
}

export default Settings
