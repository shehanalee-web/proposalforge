import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import { proposalEditPath } from '../../workspace/paths.js'
import { useCreateProposalDialog } from '../../hooks/useCreateProposalDialog.js'
import styles from './CreateProposalDialog.module.css'

const EMPTY = {
  title: '',
  clientName: '',
}

function valuesFromSeed(seed) {
  return {
    title: seed?.title ?? seed?.draft?.title ?? '',
    clientName: seed?.clientName ?? seed?.draft?.clientName ?? '',
  }
}

function Field({ id, label, error, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CreateProposalDialog() {
  const navigate = useNavigate()
  const { open, seed, closeCreate } = useCreateProposalDialog()
  const { create, submitting, error, fieldErrors, reset } = useCreateProposal()
  const dialogRef = useRef(null)
  const titleId = useId()
  const [values, setValues] = useState(EMPTY)

  const requestError =
    error && Object.keys(fieldErrors).length === 0 ? error : null

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return

    if (open && !node.open) {
      // oxlint-disable-next-line react/set-state-in-effect -- reset the form when the dialog opens
      setValues(valuesFromSeed(seed))
      reset()
      node.showModal()
    } else if (!open && node.open) {
      node.close()
    }
  }, [open, seed, reset])

  function handleNativeClose() {
    if (open) closeCreate()
  }

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const extras = seed?.draft ? { ...seed.draft } : {}
    const created = await create({
      ...extras,
      title: values.title,
      clientName: values.clientName,
    })

    if (created) {
      closeCreate()
      navigate(proposalEditPath(created.id))
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={handleNativeClose}
      onCancel={handleNativeClose}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Duplicate proposal
          </h2>
          <p className={styles.lede}>
            Name the copy and confirm the client. Layout, pricing and content
            stay with this draft until you edit them.
          </p>
        </header>

        <div className={styles.body}>
          {requestError ? (
            <p className={styles.error} role="alert">
              {requestError.message || 'Could not duplicate the proposal.'}
            </p>
          ) : null}

          <Field id="create-title" label="Proposal title" error={fieldErrors.title}>
            <input
              id="create-title"
              name="title"
              type="text"
              className={styles.input}
              value={values.title}
              onChange={handleChange}
              disabled={submitting}
              autoComplete="off"
              autoFocus
              required
              aria-invalid={Boolean(fieldErrors.title)}
            />
          </Field>

          <Field
            id="create-client"
            label="Client name"
            error={fieldErrors.clientName}
          >
            <input
              id="create-client"
              name="clientName"
              type="text"
              className={styles.input}
              value={values.clientName}
              onChange={handleChange}
              disabled={submitting}
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.clientName)}
            />
          </Field>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancel}
            onClick={closeCreate}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Duplicating…' : 'Duplicate'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}

export default CreateProposalDialog
