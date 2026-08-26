import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatCurrency } from '../../utils/format.js'
import { proposalFromTemplate } from '../../utils/proposalFromTemplate.js'
import { toDuplicateTemplate } from '../../utils/duplicateTemplate.js'
import { useTemplates } from '../../hooks/useTemplates.js'
import { useCreateTemplate } from '../../hooks/useCreateTemplate.js'
import { useDeleteTemplate } from '../../hooks/useDeleteTemplate.js'
import styles from './Templates.module.css'

const SKELETON_ROWS = 3

function Templates() {
  const navigate = useNavigate()
  const { templates, loading, error, refetch } = useTemplates()
  const { create, submitting: duplicating } = useCreateTemplate()
  const { remove, submitting: deleting, error: deleteError } = useDeleteTemplate()
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const isInitialLoad = loading && templates.length === 0

  function startFromTemplate(template) {
    navigate('/new', {
      state: { draft: proposalFromTemplate(template), source: 'template' },
    })
  }

  async function handleDuplicate(template) {
    setBusyId(template.id)

    const created = await create(toDuplicateTemplate(template))

    setBusyId(null)

    if (created) {
      await refetch()
    }
  }

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
          <p className={styles.stateTitle}>Could not load templates</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching templates.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
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

    if (templates.length === 0) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No templates yet</p>
          <p className={styles.stateText}>
            Save reusable sections, pricing and terms so new proposals start
            closer to finished.
          </p>
          <Link to="/templates/new" className={styles.primary}>
            Create template
          </Link>
        </div>
      )
    }

    return (
      <ul className={styles.list}>
        {templates.map((template) => {
          const busy = busyId === template.id
          const pendingDelete = pendingDeleteId === template.id
          const sectionCount = template.sections.length
          const itemCount = template.items.length

          return (
            <li key={template.id} className={styles.card}>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{template.title}</h2>
                {template.description ? (
                  <p className={styles.cardDescription}>{template.description}</p>
                ) : (
                  <p className={styles.cardDescriptionMuted}>No description</p>
                )}
                <p className={styles.meta}>
                  {formatCurrency(template.amount, template.currency)}
                  {' · '}
                  {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
                  {' · '}
                  {itemCount} {itemCount === 1 ? 'line item' : 'line items'}
                </p>
              </div>

              {pendingDelete ? (
                <div className={styles.confirm}>
                  <p className={styles.confirmText}>Delete this template?</p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => confirmDelete(template.id)}
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
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => startFromTemplate(template)}
                    disabled={busy || duplicating || deleting}
                  >
                    Use template
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => handleDuplicate(template)}
                    disabled={busy || duplicating || deleting}
                  >
                    {busy && duplicating ? 'Duplicating…' : 'Duplicate'}
                  </button>
                  <Link
                    to={`/templates/${template.id}/edit`}
                    className={styles.secondary}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className={styles.dangerGhost}
                    onClick={() => setPendingDeleteId(template.id)}
                    disabled={busy || duplicating || deleting}
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
          Reusable proposal starting points. Using a template copies its data
          into a new proposal — the original stays unchanged.
        </p>
        {templates.length > 0 ? (
          <Link to="/templates/new" className={styles.primary}>
            Create template
          </Link>
        ) : null}
      </div>

      {deleteError ? (
        <p className={styles.banner} role="alert">
          {deleteError.message || 'Could not delete the template. Please try again.'}
        </p>
      ) : null}

      <div className={styles.panel}>{renderContent()}</div>
    </section>
  )
}

export default Templates
