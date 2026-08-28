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
      <section className={styles.page}>
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not load Brand Kit</p>
          <p className={styles.bannerText}>
            {error.message || 'Something went wrong while fetching company identity.'}
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
        <header className={styles.hero}>
          <p className={styles.kicker}>Company identity</p>
          <h2 className={styles.title}>Brand Kit</h2>
          <p className={styles.lede}>Loading your workspace identity…</p>
        </header>
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div key={index} className={styles.skeletonCard} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Company identity</p>
        <h2 className={styles.title}>Brand Kit</h2>
        <p className={styles.lede}>
          Set this once. Every proposal and template inherits logos, colours,
          type, contact details, legal copy, team and testimonials automatically.
        </p>
      </header>

      {saved ? (
        <p className={styles.success} role="status">
          Brand Kit saved. Future proposals and templates will use this identity.
        </p>
      ) : null}

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not save Brand Kit</p>
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

      <BrandKitForm
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitting={submitting}
        fieldErrors={fieldErrors}
      />

      <div className={styles.bar}>
        <p className={styles.barCopy}>
          Saving writes identity for the whole workspace — not a single document.
        </p>
        <button
          type="submit"
          form="brand-kit-form"
          className={styles.save}
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save Brand Kit'}
        </button>
      </div>
    </section>
  )
}

export default BrandKit
