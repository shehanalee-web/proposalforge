import { useState } from 'react'
import { Link } from 'react-router'
import { PRICING_MODEL_LABELS } from '../../models/service.js'
import { useServices } from '../../hooks/useServices.js'
import { useDeleteService } from '../../hooks/useDeleteService.js'
import { PATH, serviceEditPath } from '../../workspace/paths.js'
import styles from './Services.module.css'

const SKELETON_ROWS = 4

function Services() {
  const { services, loading, error, refetch } = useServices()
  const { remove, submitting: deleting, error: deleteError } = useDeleteService()
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const isInitialLoad = loading && services.length === 0

  async function confirmDelete(id) {
    setBusyId(id)
    const deleted = await remove(id)
    setBusyId(null)
    setPendingDeleteId(null)

    if (deleted) {
      await refetch()
    }
  }

  function renderContent() {
    if (error) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load services</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the library.'}
          </p>
          <button type="button" className={styles.secondary} onClick={refetch}>
            Try again
          </button>
        </div>
      )
    }

    if (isInitialLoad) {
      return (
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.skeletonRow} />
          ))}
        </div>
      )
    }

    if (services.length === 0) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No services yet</p>
          <p className={styles.stateText}>
            Add what the company sells. Create Proposal will offer these
            instead of a fixed project-type list.
          </p>
          <Link to={PATH.NEW_SERVICE} className={styles.primary}>
            Add service
          </Link>
        </div>
      )
    }

    return (
      <ul className={styles.list}>
        {services.map((service) => {
          const busy = busyId === service.id
          const pendingDelete = pendingDeleteId === service.id
          const pricing = PRICING_MODEL_LABELS[service.pricingModel] ?? service.pricingModel

          return (
            <li key={service.id} className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>{service.name}</h2>
                </div>
                {service.description ? (
                  <p className={styles.cardDescription}>{service.description}</p>
                ) : (
                  <p className={styles.cardDescriptionMuted}>No description</p>
                )}
                <p className={styles.meta}>
                  {pricing}
                  {service.typicalDuration ? ` · ${service.typicalDuration}` : ''}
                  {service.deliverables.length > 0
                    ? ` · ${service.deliverables.length} deliverable${
                        service.deliverables.length === 1 ? '' : 's'
                      }`
                    : ''}
                </p>
              </div>

              {pendingDelete ? (
                <div className={styles.confirm}>
                  <p className={styles.confirmText}>
                    Delete this service? Existing proposals keep the name they
                    were created with.
                  </p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => confirmDelete(service.id)}
                      disabled={busy || deleting}
                    >
                      {busy ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setPendingDeleteId(null)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Link to={serviceEditPath(service.id)} className={styles.primary}>
                    Edit service
                  </Link>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setPendingDeleteId(service.id)}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          The company catalogue. Create Proposal copies a service’s template
          into a new document. Editing a service never rewrites proposals
          already sent.
        </p>
        {services.length > 0 ? (
          <Link to={PATH.NEW_SERVICE} className={styles.primary}>
            Add service
          </Link>
        ) : null}
      </div>

      {deleteError ? (
        <p className={styles.banner} role="alert">
          {deleteError.message || 'Could not delete the service. Please try again.'}
        </p>
      ) : null}

      <div className={styles.panel}>{renderContent()}</div>
    </section>
  )
}

export default Services
