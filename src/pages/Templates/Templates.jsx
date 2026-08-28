import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import { formatCurrency } from '../../utils/format.js'
import { getLayout } from '../../layouts/registry.js'
import { toDuplicateTemplate } from '../../utils/duplicateTemplate.js'
import { exportTemplate } from '../../utils/exportTemplate.js'
import { getProposalTypeLabel } from '../../models/proposalType.js'
import { useTemplates } from '../../hooks/useTemplates.js'
import { useCreateTemplate } from '../../hooks/useCreateTemplate.js'
import { useDeleteTemplate } from '../../hooks/useDeleteTemplate.js'
import { useUpdateTemplate } from '../../hooks/useUpdateTemplate.js'
import { setDefaultTemplate } from '../../services/templateService.js'
import { PATH, templateEditPath } from '../../workspace/paths.js'
import styles from './Templates.module.css'

const SKELETON_ROWS = 3

function Templates() {
  const { templates, loading, error, refetch } = useTemplates()
  const { create, submitting: duplicating } = useCreateTemplate()
  const { update, submitting: renaming } = useUpdateTemplate()
  const { remove, submitting: deleting, error: deleteError } = useDeleteTemplate()

  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [actionError, setActionError] = useState(null)

  const isInitialLoad = loading && templates.length === 0
  const locked = duplicating || deleting || renaming

  async function handleDuplicate(template) {
    setOpenMenuId(null)
    setBusyId(template.id)
    setActionError(null)

    const created = await create(toDuplicateTemplate(template))

    setBusyId(null)

    if (created) {
      await refetch()
    }
  }

  async function handleSetDefault(template) {
    setOpenMenuId(null)
    setBusyId(template.id)
    setActionError(null)

    try {
      await setDefaultTemplate(template.id)
      await refetch()
    } catch (caught) {
      setActionError(caught)
    } finally {
      setBusyId(null)
    }
  }

  function handleExport(template) {
    setOpenMenuId(null)
    exportTemplate(template)
  }

  function startRename(template) {
    setOpenMenuId(null)
    setRenameTarget(template)
    setRenameValue(template.title)
    setActionError(null)
  }

  async function confirmRename(event) {
    event.preventDefault()
    if (!renameTarget) return

    const title = renameValue.trim()
    if (!title) return

    setBusyId(renameTarget.id)

    const updated = await update(renameTarget.id, { title })

    setBusyId(null)

    if (updated) {
      setRenameTarget(null)
      await refetch()
    } else {
      setActionError(new Error('Could not rename the template. Please try again.'))
    }
  }

  async function confirmDelete(id) {
    setBusyId(id)
    setActionError(null)

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
            Save reusable sections, pricing and terms here. New proposals pick
            a type from Create Proposal — they do not start from this list.
          </p>
          <Link to={PATH.NEW_TEMPLATE} className={styles.primary}>
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
          const typeLabel = getProposalTypeLabel(template.proposalType)

          return (
            <li key={template.id} className={`${styles.card} ${openMenuId === template.id ? styles.cardMenuOpen : ''}`}>
              <div className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>{template.title}</h2>
                  {template.isDefault ? (
                    <span className={styles.badge}>Default</span>
                  ) : null}
                </div>
                {template.description ? (
                  <p className={styles.cardDescription}>{template.description}</p>
                ) : (
                  <p className={styles.cardDescriptionMuted}>No description</p>
                )}
                <p className={styles.meta}>
                  {typeLabel ? `${typeLabel} · ` : ''}
                  {formatCurrency(template.amount, template.currency)}
                  {' · '}
                  {getLayout(template.defaultLayoutId).label}
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
                  <Link
                    to={templateEditPath(template.id)}
                    className={styles.primary}
                  >
                    Open Template
                  </Link>
                  <OverflowMenu
                    open={openMenuId === template.id}
                    disabled={busy || locked}
                    onToggle={() =>
                      setOpenMenuId((current) =>
                        current === template.id ? null : template.id,
                      )
                    }
                    onClose={() => setOpenMenuId(null)}
                    items={[
                      {
                        id: 'duplicate',
                        label: busy && duplicating ? 'Duplicating…' : 'Duplicate',
                        onSelect: () => handleDuplicate(template),
                      },
                      {
                        id: 'rename',
                        label: 'Rename',
                        onSelect: () => startRename(template),
                      },
                      {
                        id: 'default',
                        label: template.isDefault
                          ? 'Default template'
                          : 'Set as Default',
                        disabled: template.isDefault,
                        onSelect: () => handleSetDefault(template),
                      },
                      {
                        id: 'export',
                        label: 'Export',
                        onSelect: () => handleExport(template),
                      },
                      {
                        id: 'delete',
                        label: 'Delete',
                        danger: true,
                        onSelect: () => {
                          setOpenMenuId(null)
                          setPendingDeleteId(template.id)
                        },
                      },
                    ]}
                  />
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
          Manage reusable templates for proposal types. Open a template to edit
          it. Creating a proposal happens from Create Proposal, not from this
          library.
        </p>
        {templates.length > 0 ? (
          <Link to={PATH.NEW_TEMPLATE} className={styles.primary}>
            Create template
          </Link>
        ) : null}
      </div>

      {deleteError || actionError ? (
        <p className={styles.banner} role="alert">
          {(deleteError || actionError).message ||
            'Could not update the template. Please try again.'}
        </p>
      ) : null}

      <div className={styles.panel}>{renderContent()}</div>

      {renameTarget ? (
        <div className={styles.renameBackdrop}>
          <form
            className={styles.renameDialog}
            onSubmit={confirmRename}
            aria-labelledby="rename-template-title"
          >
            <h2 id="rename-template-title" className={styles.renameTitle}>
              Rename template
            </h2>
            <label className={styles.renameLabel} htmlFor="rename-template">
              Template name
            </label>
            <input
              id="rename-template"
              className={styles.renameInput}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              required
            />
            <div className={styles.renameActions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={renaming || !renameValue.trim()}
              >
                {renaming ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function OverflowMenu({ open, disabled, items, onToggle, onClose }) {
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) onClose()
    }

    function handleKey(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  return (
    <div className={styles.overflow} ref={rootRef}>
      <button
        type="button"
        className={styles.overflowTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Template actions"
        disabled={disabled}
        onClick={onToggle}
      >
        <Icon name="more" size={16} />
      </button>
      {open ? (
        <ul className={styles.overflowMenu} role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={
                  item.danger ? styles.overflowDanger : styles.overflowItem
                }
                disabled={disabled || item.disabled}
                onClick={item.onSelect}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default Templates
