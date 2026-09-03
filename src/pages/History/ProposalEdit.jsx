import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { makeProposal, PROJECT_TYPES } from '../../models/proposal.js'
import { DEFAULT_LAYOUT_ID } from '../../layouts/ids.js'
import { useProposal } from '../../hooks/useProposal.js'
import { useUpdateProposal } from '../../hooks/useUpdateProposal.js'
import { useExportProposalPdf } from '../../hooks/useExportProposalPdf.js'
import ProposalForm from '../NewProposal/ProposalForm.jsx'
import { PATH, proposalPath } from '../../workspace/paths.js'
import { ensureProposalBlocks } from '../../blocks/hydrate.js'
import { computeCommercials } from '../../utils/commercialTotals.js'
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
  const { runExport, exporting, error: exportError } = useExportProposalPdf()

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

  function handleBlocksChange(next) {
    setBlocks(next)

    const pricing = next.find((block) => block.type === BLOCK_TYPE.PRICING)
    if (!pricing) return

    const nextAmount = String(
      computeCommercials(pricing.data.modules ?? []).grandTotal,
    )

    setDraft((current) => {
      const base = current ?? (proposal ? valuesFromProposal(proposal) : null)
      if (!base || base.amount === nextAmount) return current
      return { ...base, amount: nextAmount }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!id || !values) return

    const updated = await update(id, toEditableChanges(values, documentBlocks))

    if (updated) {
      navigate(proposalPath(updated.id))
    }
  }

  async function handleDownloadPdf() {
    if (!proposal || !values || exporting) return

    const preview = makeProposal({
      ...proposal,
      ...toEditableChanges(values, documentBlocks),
      id: proposal.id,
      createdAt: proposal.createdAt,
      versions: proposal.versions,
      currentVersion: proposal.currentVersion,
      shareToken: proposal.shareToken,
      notes: proposal.notes,
      status: proposal.status,
      tags: proposal.tags,
    })

    await runExport(preview, 'download')
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

  const busy = submitting || Boolean(exporting)

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Edit branding details, pricing, layout, validity dates and every content
          block — including team, images and PDFs. Disabling a block hides it
          without deleting its content. Download PDF uses the current editor
          values, including unsaved changes.
        </p>
        <button
          type="button"
          className={styles.export}
          onClick={handleDownloadPdf}
          disabled={busy}
        >
          {exporting === 'download' ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>

      {exportError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not generate the PDF</p>
          <p className={styles.bannerText}>
            {exportError.message || 'Something went wrong. Please try again.'}
          </p>
        </div>
      ) : null}

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
            onChange={handleBlocksChange}
            disabled={submitting}
            currency={proposal.currency}
          />
        </ProposalForm>
      </div>
    </section>
  )
}

export default ProposalEdit
