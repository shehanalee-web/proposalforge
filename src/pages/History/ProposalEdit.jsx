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
  pasteBlock,
  removeBlock,
  reorderBlocks,
  setBlockEnabled,
  updateBlockSettings,
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
import ProposalSettingsPanel from '../../components/ProposalSettings/ProposalSettingsPanel.jsx'
import BlockInspector from '../../components/BlockInspector/BlockInspector.jsx'
import ClientResponsesPanel from '../../components/ClientResponses/ClientResponsesPanel.jsx'
import CollaborationPanel from '../../components/Collaboration/CollaborationPanel.jsx'
import ClientWorkspacePanel from '../../components/ClientWorkspace/ClientWorkspacePanel.jsx'
import WorkflowPanel from '../../components/Workflow/WorkflowPanel.jsx'
import WorkflowStrip from '../../components/Workflow/WorkflowStrip.jsx'
import SendProposalDialog from '../../components/SendProposal/SendProposalDialog.jsx'
import { ProposalThemeProvider } from '../../theme/ProposalThemeContext.jsx'
import { hasQuestionnaire } from '../../models/questionnaire.js'
import { useRestoreProposalVersion } from '../../hooks/useRestoreProposalVersion.js'
import { useSaveProposalVersion } from '../../hooks/useSaveProposalVersion.js'
import { useDeleteProposalVersion } from '../../hooks/useDeleteProposalVersion.js'
import VersionHistoryPanel from './VersionHistoryPanel.jsx'
import ActivityPanel from './ActivityPanel.jsx'
import styles from './ProposalEdit.module.css'
import { useProposalWorkflow } from '../../hooks/useProposalWorkflow.js'
import { DEFAULT_ACTOR_ID } from '../../workflow/actors.js'

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
    settingsOpen,
    setSettingsOpen,
    inspectorOpen,
    setInspectorOpen,
    responsesOpen,
    setResponsesOpen,
    collaborationOpen,
    setCollaborationOpen,
    clientOpen,
    setClientOpen,
    workflowOpen,
    setWorkflowOpen,
    copyBlock,
    takeClipboard,
    activeBlockId,
    scrollToBlock,
    focusSearch,
    toggleExpanded,
  } = useEditorWorkspace()

  const { proposal, loading, error, notFound, refetch, setProposal } = useProposal(id)
  const [workflowActorId, setWorkflowActorId] = useState(DEFAULT_ACTOR_ID)
  const workflowFlow = useProposalWorkflow(id, workflowActorId)
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
  const {
    restore,
    submitting: restoring,
    error: restoreError,
  } = useRestoreProposalVersion()
  const {
    saveVersion,
    submitting: savingVersion,
    error: saveVersionError,
  } = useSaveProposalVersion()
  const {
    removeVersion,
    submitting: deletingVersion,
    error: deleteVersionError,
  } = useDeleteProposalVersion()

  const [draft, setDraft] = useState(null)
  const [blocks, setBlocks] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
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

  function handleImproveApply(next) {
    if (!next?.blocks) return
    handleBlocksChange(next.blocks)
    if (next.summary == null) return

    setDraft((current) => {
      const base = current ?? (proposal ? valuesFromProposal(proposal) : null)
      if (!base) return current
      return { ...base, summary: next.summary }
    })
  }

  const activeBlock = documentBlocks.find((block) => block.id === activeBlockId) ?? null

  function handlePasteAt(index = null) {
    const source = takeClipboard()
    if (!source) return
    const { blocks: next, created } = pasteBlock(documentBlocks, source, index)
    handleBlocksChange(next)
    if (created) {
      setInspectorOpen(true)
    }
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

  function applyProposalRecord(next) {
    if (!next) return
    setProposal(next)
    setDraft(valuesFromProposal(next))
    setBlocks(ensureProposalBlocks(next))
  }

  async function handleRestoreVersion(versionId) {
    if (!id) return null
    const restored = await restore(id, versionId)
    applyProposalRecord(restored)
    return restored
  }

  async function handleSaveVersion() {
    if (!id) return null
    const next = await saveVersion(id)
    if (next) setProposal(next)
    return next
  }

  async function handleDeleteVersion(versionId) {
    if (!id) return
    const next = await removeVersion(id, versionId)
    if (next) setProposal(next)
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
    onCopy: () => {
      if (activeBlock) copyBlock(activeBlock)
    },
    onPaste: () => handlePasteAt(activeIndex >= 0 ? activeIndex + 1 : null),
  })

  useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  if (notFound) {
    return (
      <ProposalThemeProvider proposalId={id} proposal={proposal}>
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
      </ProposalThemeProvider>
    )
  }

  if (error) {
    return (
      <ProposalThemeProvider proposalId={id} proposal={proposal}>
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
      </ProposalThemeProvider>
    )
  }

  if (loading || !values || servicesLoading) {
    return (
      <ProposalThemeProvider proposalId={id} proposal={proposal}>
        <section className={styles.page}>
          <p className={styles.intro}>Loading proposal…</p>
          <div className={styles.skeleton} aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className={styles.skeletonRow} />
            ))}
          </div>
        </section>
      </ProposalThemeProvider>
    )
  }

  const busy = submitting || Boolean(exporting)
  const pageClass = [
    styles.page,
    sidebarOpen && styles.pageSidebarOpen,
    settingsOpen && styles.pageSettingsOpen,
    inspectorOpen && !settingsOpen && !responsesOpen && !collaborationOpen && !clientOpen && !workflowOpen && styles.pageInspectorOpen,
    responsesOpen && styles.pageResponsesOpen,
    collaborationOpen && styles.pageCollaborationOpen,
    clientOpen && styles.pageClientOpen,
    workflowOpen && styles.pageCollaborationOpen,
    outlineOpen && !previewMode && styles.pageOutlineOpen,
    previewMode && styles.pagePreview,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ProposalThemeProvider proposalId={id} proposal={proposal}>
    <section
      className={pageClass}
      data-mode={previewMode ? 'preview' : 'edit'}
    >
      <AiSidebar
        proposal={proposal}
        blocks={documentBlocks}
        onAction={() => {}}
        onApplyImprovement={handleImproveApply}
      />
      <ProposalSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ClientResponsesPanel
        proposal={proposal}
        open={responsesOpen}
        onClose={() => setResponsesOpen(false)}
      />
      <CollaborationPanel
        proposal={proposal}
        open={collaborationOpen}
        onClose={() => setCollaborationOpen(false)}
        onProposalChange={setProposal}
      />
      <ClientWorkspacePanel
        proposal={proposal}
        open={clientOpen}
        onClose={() => setClientOpen(false)}
        onProposalChange={setProposal}
        onSend={() => {
          setClientOpen(false)
          setSendOpen(true)
        }}
      />
      <WorkflowPanel
        proposal={proposal}
        blocks={documentBlocks}
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        workflow={workflowFlow.workflow}
        loading={workflowFlow.loading}
        error={workflowFlow.error}
        actorId={workflowActorId}
        onActorChange={setWorkflowActorId}
        actions={workflowFlow}
      />
      {historyOpen && proposal ? (
        <VersionHistoryPanel
          proposal={proposal}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestoreVersion}
          restoring={restoring}
          restoreError={restoreError}
          onSaveVersion={handleSaveVersion}
          savingVersion={savingVersion}
          saveVersionError={saveVersionError}
          onDeleteVersion={handleDeleteVersion}
          deleting={deletingVersion}
          deleteError={deleteVersionError}
        />
      ) : null}
      {activityOpen && proposal ? (
        <ActivityPanel
          proposal={proposal}
          onClose={() => setActivityOpen(false)}
        />
      ) : null}
      <SendProposalDialog
        proposal={proposal}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={(sent) => {
          setSendOpen(false)
          if (sent) setProposal(sent)
        }}
      />
      <BlockInspector
        block={activeBlock}
        open={inspectorOpen && !settingsOpen && !responsesOpen && !collaborationOpen && !clientOpen && !workflowOpen && !previewMode}
        onClose={() => setInspectorOpen(false)}
        onEnabled={(value) =>
          handleBlocksChange(setBlockEnabled(documentBlocks, activeBlockId, value))
        }
        onSettings={(settings) =>
          handleBlocksChange(updateBlockSettings(documentBlocks, activeBlockId, settings))
        }
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
        onSend={() => {
          setSettingsOpen(false)
          setResponsesOpen(false)
          setCollaborationOpen(false)
          setClientOpen(false)
          setWorkflowOpen(false)
          setHistoryOpen(false)
          setActivityOpen(false)
          setSendOpen(true)
        }}
        hasResponses={hasQuestionnaire(proposal?.questionnaire)}
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((open) => !open)}
        activityOpen={activityOpen}
        onToggleActivity={() => setActivityOpen((open) => !open)}
      />

      <WorkflowStrip
        workflow={workflowFlow.workflow}
        onOpen={() => {
          setSettingsOpen(false)
          setResponsesOpen(false)
          setCollaborationOpen(false)
          setClientOpen(false)
          setHistoryOpen(false)
          setActivityOpen(false)
          setWorkflowOpen(true)
        }}
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
          onDuplicate={(blockId) =>
            handleBlocksChange(duplicateBlock(documentBlocks, blockId))
          }
          onRemove={(blockId) => handleBlocksChange(removeBlock(documentBlocks, blockId))}
          onCopy={(block) => copyBlock(block)}
          onPaste={(index) => handlePasteAt(index)}
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
                proposalId={proposal.id}
              />
            </ProposalForm>
          )}
        </div>
      </div>
    </section>
    </ProposalThemeProvider>
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
