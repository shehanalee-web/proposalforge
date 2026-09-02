import { useState } from 'react'
import { makeBrandKit } from '../../models/brandKit.js'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { useUpdateBrandKit } from '../../hooks/useUpdateBrandKit.js'
import BrandKitForm from './BrandKitForm.jsx'
import styles from './BrandKit.module.css'

const SKELETON_CARDS = 4

function BrandKit() {
  const { kit, loading, error, refetch } = useBrandKit()
  const {
    update,
    submitting,
    error: saveError,
    fieldErrors,
    reset,
  } = useUpdateBrandKit()

  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(false)

  const values = draft ?? (kit ? makeBrandKit(kit) : null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function handleChange(updater) {
    if (!values) return

    setSaved(false)
    reset()
    setDraft(makeBrandKit(updater(values)))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!values) return

    const updated = await update(values)

    if (updated) {
      setDraft(makeBrandKit(updated))
      setSaved(true)
    }
  }

  if (error) {
    return (
      <section className="studio-page">
        <div className="studio-banner" role="alert">
          <p className="studio-banner-title">Could not load Brand Kit</p>
          <p className="studio-banner-text">
            {error.message || 'Something went wrong while fetching company identity.'}
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
      <section className={`studio-page ${styles.page}`}>
        <header className="studio-hero">
          <p className="studio-kicker">Company identity</p>
          <p className={`studio-intro ${styles.lede}`}>Loading your workspace identity…</p>
        </header>
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div key={index} className={`studio-skeleton ${styles.skeletonCard}`} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={`studio-page ${styles.page}`}>
      <header className="studio-hero">
        <p className="studio-kicker">Company identity</p>
        <p className={`studio-intro ${styles.lede}`}>
          Set this once. Every proposal and template inherits logos, colours,
          type, contact details, legal copy, team and testimonials automatically.
        </p>
      </header>

      {saved ? (
        <p className="studio-success" role="status">
          Brand Kit saved. Future proposals and templates will use this identity.
        </p>
      ) : null}

      {requestError ? (
        <div className="studio-banner" role="alert">
          <p className="studio-banner-title">Could not save Brand Kit</p>
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

      <BrandKitForm
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitting={submitting}
        fieldErrors={fieldErrors}
      />

      <div className={`studio-panel ${styles.bar}`}>
        <p className={styles.barCopy}>
          Saving writes identity for the whole workspace — not a single document.
        </p>
        <button
          type="submit"
          form="brand-kit-form"
          className={`studio-btn-primary ${styles.save}`}
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save Brand Kit'}
        </button>
      </div>
    </section>
  )
}

export default BrandKit
