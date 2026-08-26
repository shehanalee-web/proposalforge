import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PROJECT_TYPES } from '../../models/proposal.js'
import { DEFAULT_LAYOUT_ID } from '../../layouts/ids.js'
import { useProposal } from '../../hooks/useProposal.js'
import { useUpdateProposal } from '../../hooks/useUpdateProposal.js'
import ProposalForm from '../NewProposal/ProposalForm.jsx'
import { PATH, proposalPath } from '../../workspace/paths.js'
import { ensureProposalBlocks } from '../../blocks/hydrate.js'
import { BLOCK_TYPE } from '../../blocks/ids.js'
import { updateBlocksByType } from '../../blocks/instance.js'
import BlockComposer from '../../blocks/BlockComposer.jsx'
import styles from './ProposalEdit.module.css'

const SKELETON_ROWS = 4

function valuesFromProposal(proposal) {
  return {
    title: proposal.title ?? '',
    clientName: proposal.clientName ?? '',
    clientEmail: proposal.clientEmail ?? '',
    company: proposal.company ?? '',
    projectType: proposal.projectType ?? PROJECT_TYPES[0],
    amount: Number.isFinite(proposal.amount) ? String(proposal.amount) : '',
    summary: proposal.summary ?? '',
    validUntil: proposal.validUntil ?? '',
    layoutId: proposal.layoutId ?? DEFAULT_LAYOUT_ID,
  }
}

function toEditableChanges(values, blocks) {
  return {
    title: values.title,
    clientName: values.clientName,
    clientEmail: values.clientEmail,
    company: values.company,
    projectType: values.projectType,
    amount: values.amount === '' ? 0 : Number(values.amount),
    summary: values.summary,
    validUntil: values.validUntil || null,
    layoutId: values.layoutId ?? DEFAULT_LAYOUT_ID,
    blocks,
  }
}

function ProposalEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proposal, loading, error, notFound, refetch } = useProposal(id)
  const {
    update,
    submitting,
    error: saveError,
    fieldErrors,
  } = useUpdateProposal()

  const [draft, setDraft] = useState(null)
  const [blocks, setBlocks] = useState(null)
  const values = draft ?? (proposal ? valuesFromProposal(proposal) : null)
  const documentBlocks = blocks ?? (proposal ? ensureProposalBlocks(proposal) : [])

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function handleChange(name, value) {
    if (!values) return

    setDraft({ ...values, [name]: value })

    if (name === 'summary') {
      setBlocks((current) =>
        updateBlocksByType(
          current ?? documentBlocks,
          BLOCK_TYPE.EXECUTIVE_SUMMARY,
          { body: value },
        ),
      )
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!id || !values) return

    const updated = await update(id, toEditableChanges(values, documentBlocks))

    if (updated) {
      navigate(proposalPath(updated.id))
    }
  }

  if (notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Proposal not found</p>
          <p className={styles.stateText}>
            This proposal does not exist, or it was lost when the app reloaded.
          </p>
          <Link to={PATH.PROPOSALS} className={styles.action}>
            Back to proposals
          </Link>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this proposal</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the proposal.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (loading || !values) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading proposal…</p>
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.skeletonRow} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        Update the essentials, layout and content blocks. Disabling a block hides
        it without deleting its content. Status is not changed here.
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not save the proposal</p>
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
        <ProposalForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          fieldErrors={fieldErrors}
          submitLabel="Save changes"
          submittingLabel="Saving…"
        >
          <BlockComposer
            blocks={documentBlocks}
            onChange={setBlocks}
            disabled={submitting}
          />
        </ProposalForm>
      </div>
    </section>
  )
}

export default ProposalEdit
