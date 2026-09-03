import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { makeProposal, PROJECT_TYPES } from '../../models/proposal.js'
import { DEFAULT_LAYOUT_ID } from '../../layouts/ids.js'
import { useProposal } from '../../hooks/useProposal.js'
import { useUpdateProposal } from '../../hooks/useUpdateProposal.js'
import { useExportProposalPdf } from '../../hooks/useExportProposalPdf.js'
import { useServices } from '../../hooks/useServices.js'
import { useHistoryStack } from '../../hooks/useHistoryStack.js'
import { useSaveStatus } from '../../hooks/useSaveStatus.js'
import { useEditorKeyboard } from '../../hooks/useEditorKeyboard.js'
import ProposalForm from '../NewProposal/ProposalForm.jsx'
import { PATH, proposalPath } from '../../workspace/paths.js'
import { ensureProposalBlocks } from '../../blocks/hydrate.js'
import { computeCommercials } from '../../utils/commercialTotals.js'
import { BLOCK_TYPE } from '../../blocks/ids.js'
import {
  duplicateBlock,
  removeBlock,
  reorderBlocks,
  updateBlocksByType,
} from '../../blocks/instance.js'
import BlockEditor from '../../blocks/editor/BlockEditor.jsx'
import BlockOutline from '../../blocks/editor/BlockOutline.jsx'
import AiSidebar from '../../components/AiSidebar/AiSidebar.jsx'
import { EditorLayoutProvider, useEditorLayout } from '../../components/Editor/EditorLayoutContext.jsx'
import {
  EditorWorkspaceProvider,
  useEditorWorkspace,
} from '../../components/Editor/EditorWorkspaceContext.jsx'
import EditorCommandBar from '../../components/Editor/EditorCommandBar.jsx'
import ProposalPreview from '../../components/Editor/ProposalPreview.jsx'
import styles from './ProposalEdit.module.css'

const SKELETON_ROWS = 4

function valuesFromProposal(proposal) {
  return {
    title: proposal.title ?? '',
    clientName: proposal.clientName ?? '',
    clientEmail: proposal.clientEmail ?? '',
    company: proposal.company ?? '',
    projectType: proposal.projectType ?? PROJECT_TYPES[0],
    serviceId: proposal.serviceIds?.[0] ?? '',
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
    serviceIds: values.serviceId ? [values.serviceId] : [],
    amount: values.amount === '' ? 0 : Number(values.amount),
    summary: values.summary,
    validUntil: values.validUntil || null,
    layoutId: values.layoutId ?? DEFAULT_LAYOUT_ID,
    blocks,
  }
}

function cloneSnapshot(values, blocks) {
  return JSON.parse(JSON.stringify({ values, blocks }))
}

function ProposalEditContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sidebarOpen } = useEditorLayout()
  const {
    previewMode,
    setPreviewMode,
    outlineOpen,
    activeBlockId,
    scrollToBlock,
    focusSearch,
    toggleExpanded,
  } = useEditorWorkspace()

  const { proposal, loading, error, notFound, refetch } = useProposal(id)
  const {
    update,
    submitting,
    error: saveError,
    fieldErrors,
  } = useUpdateProposal()
  const { runExport, exporting, error: exportError } = useExportProposalPdf()
  const { services, loading: servicesLoading } = useServices()
  const history = useHistoryStack()
  const save = useSaveStatus()

  const [draft, setDraft] = useState(null)
  const [blocks, setBlocks] = useState(null)
  const values = draft ?? (proposal ? valuesFromProposal(proposal) : null)
  const documentBlocks = blocks ?? (proposal ? ensureProposalBlocks(proposal) : [])
  const snapshot = useMemo(
    () => ({ values, blocks: documentBlocks }),
    [values, documentBlocks],
  )
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const debounceRef = useRef(0)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function remember() {
    if (history.applying.current) return
    history.push(cloneSnapshot(snapshotRef.current.values, snapshotRef.current.blocks))
  }

  function rememberSoon() {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(remember, 280)
  }

  function applySnapshot(next) {
    if (!next) return
    setDraft(next.values)
    setBlocks(next.blocks)
    queueMicrotask(() => history.finishApply())
  }

  function handleChange(name, value) {
    if (!values) return
    rememberSoon()
    save.markDirty()

    if (name === 'serviceId') {
      const service = services.find((entry) => entry.id === value)
      setDraft({
        ...values,
        serviceId: value,
        projectType: service?.name || values.projectType,
      })
      return
    }

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
    remember()
    save.markDirty()
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

    save.markSaving()
    const updated = await update(id, toEditableChanges(values, documentBlocks))

    if (updated) {
      save.markSaved()
      navigate(proposalPath(updated.id))
      return
    }

    save.markDirty()
  }

  async function handleDownloadPdf() {
    if (!proposal || !values || exporting) return
    save.markPreparing()

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
    save.markDirty()
  }

  const previewProposal = useMemo(() => {
    if (!proposal || !values) return null
    return makeProposal({
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
  }, [proposal, values, documentBlocks])

  const activeIndex = documentBlocks.findIndex((block) => block.id === activeBlockId)

  const onUndo = useCallback(() => {
    const previous = history.undo(cloneSnapshot(values, documentBlocks))
    applySnapshot(previous)
  }, [history, values, documentBlocks])

  const onRedo = useCallback(() => {
    const next = history.redo(cloneSnapshot(values, documentBlocks))
    applySnapshot(next)
  }, [history, values, documentBlocks])

  useEditorKeyboard({
    disabled: loading || !values,
    onUndo,
    onRedo,
    onTogglePreview: () => setPreviewMode((v) => !v),
    onFocusSearch: focusSearch,
    onNextBlock: () => {
      const next = documentBlocks[Math.min(activeIndex + 1, documentBlocks.length - 1)]
      if (next) scrollToBlock(next.id)
    },
    onPrevBlock: () => {
      const prev = documentBlocks[Math.max(activeIndex - 1, 0)]
      if (prev) scrollToBlock(prev.id)
    },
    onDuplicate: () => {
      if (!activeBlockId) return
      handleBlocksChange(duplicateBlock(documentBlocks, activeBlockId))
    },
    onDelete: () => {
      if (!activeBlockId) return
      handleBlocksChange(removeBlock(documentBlocks, activeBlockId))
    },
    onMove: (offset) => {
      if (activeIndex < 0) return
      handleBlocksChange(reorderBlocks(documentBlocks, activeIndex, activeIndex + offset))
    },
    onToggleExpand: (nextValue) => {
      if (!activeBlockId) return
      toggleExpanded(activeBlockId, nextValue)
    },
  })

  useEffect(() => () => window.clearTimeout(debounceRef.current), [])

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

  if (loading || !values || servicesLoading) {
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
  const pageClass = [
    styles.page,
    sidebarOpen && styles.pageSidebarOpen,
    outlineOpen && !previewMode && styles.pageOutlineOpen,
    previewMode && styles.pagePreview,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={pageClass}
      data-mode={previewMode ? 'preview' : 'edit'}
    >
      <AiSidebar
        proposal={proposal}
        blocks={documentBlocks}
        onAction={() => {}}
      />

      <div className={styles.toolbar}>
        <div className={styles.toolbarCopy}>
          <p className={styles.kicker}>
            {previewMode ? 'Preview' : 'Editing'}
          </p>
          <p className={styles.title}>{values.title || 'Untitled proposal'}</p>
        </div>
      </div>

      <EditorCommandBar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        saveStatus={save.status}
        saveLabel={save.label}
        previewMode={previewMode}
        onDownload={handleDownloadPdf}
        downloading={busy && Boolean(exporting)}
      />

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

      <div className={styles.workspace}>
        <BlockOutline
          blocks={documentBlocks}
          disabled={submitting}
          onReorder={(from, to) =>
            handleBlocksChange(reorderBlocks(documentBlocks, from, to))
          }
        />

        <div className={styles.panel}>
          {previewMode ? (
            <ProposalPreview proposal={previewProposal} />
          ) : (
            <ProposalForm
              values={values}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitting={submitting}
              fieldErrors={fieldErrors}
              services={services}
              submitLabel="Save changes"
              submittingLabel="Saving…"
              saveStatus={save.status}
              saveLabel={save.label}
            >
              <BlockEditor
                blocks={documentBlocks}
                onChange={handleBlocksChange}
                disabled={submitting}
                currency={proposal.currency}
              />
            </ProposalForm>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ProposalEdit() {
  return (
    <EditorLayoutProvider>
      <EditorWorkspaceProvider>
        <ProposalEditContent />
      </EditorWorkspaceProvider>
    </EditorLayoutProvider>
  )
}
