import Icon from '../Icon/Icon.jsx'
import SaveStatus from './SaveStatus.jsx'
import { useEditorWorkspace } from './EditorWorkspaceContext.jsx'
import styles from './EditorCommandBar.module.css'

function EditorCommandBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  saveLabel,
  previewMode,
  onDownload,
  downloading = false,
  onSend,
  sending = false,
  hasResponses = false,
  historyOpen = false,
  onToggleHistory,
  activityOpen = false,
  onToggleActivity,
}) {
  const {
    setPreviewMode,
    outlineOpen,
    setOutlineOpen,
    focusSearch,
    settingsOpen,
    setSettingsOpen,
    responsesOpen,
    setResponsesOpen,
    collaborationOpen,
    setCollaborationOpen,
    clientOpen,
    setClientOpen,
    workflowOpen,
    setWorkflowOpen,
    portalOpen,
    setPortalOpen,
  } = useEditorWorkspace()

  return (
    <div className={styles.bar} data-editor-chrome>
      <div className={styles.group}>
        <button
          type="button"
          className={styles.tool}
          onClick={() => setOutlineOpen(!outlineOpen)}
          aria-pressed={outlineOpen}
          title="Toggle outline"
        >
          <Icon name="blockText" size={15} />
          <span className={styles.toolLabel}>Outline</span>
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Icon name="undo" size={15} />
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Icon name="redo" size={15} />
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={focusSearch}
          title="Search blocks (Ctrl+K)"
        >
          <Icon name="search" size={15} />
          <span className={styles.toolLabel}>Jump</span>
        </button>
      </div>

      <SaveStatus status={saveStatus} label={saveLabel} />

      <div className={styles.group}>
        <button
          type="button"
          className={`${styles.tool} ${previewMode ? styles.toolOn : ''}`}
          onClick={() => setPreviewMode(!previewMode)}
          aria-pressed={previewMode}
          title="Preview (Ctrl+P)"
        >
          <Icon name={previewMode ? 'eyeOff' : 'eye'} size={15} />
          <span className={styles.toolLabel}>
            {previewMode ? 'Editing' : 'Preview'}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${settingsOpen ? styles.toolOn : ''}`}
          onClick={() => {
            setSettingsOpen(!settingsOpen)
            if (!settingsOpen) {
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setClientOpen(false)
              setWorkflowOpen(false)
              setPortalOpen(false)
              if (historyOpen) onToggleHistory?.()
              if (activityOpen) onToggleActivity?.()
            }
          }}
          aria-pressed={settingsOpen}
          title="Proposal settings"
        >
          <Icon name="settings" size={15} />
          <span className={styles.toolLabel}>Design</span>
        </button>
        {hasResponses ? (
          <button
            type="button"
            className={`${styles.tool} ${responsesOpen ? styles.toolOn : ''}`}
            onClick={() => {
              setResponsesOpen(!responsesOpen)
              if (!responsesOpen) {
                setSettingsOpen(false)
                setCollaborationOpen(false)
                setClientOpen(false)
                setWorkflowOpen(false)
              setPortalOpen(false)
                if (historyOpen) onToggleHistory?.()
                if (activityOpen) onToggleActivity?.()
              }
            }}
            aria-pressed={responsesOpen}
            title="Client responses"
          >
            <Icon name="clipboard" size={15} />
            <span className={styles.toolLabel}>Responses</span>
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.tool} ${collaborationOpen ? styles.toolOn : ''}`}
          onClick={() => {
            setCollaborationOpen(!collaborationOpen)
            if (!collaborationOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setClientOpen(false)
              setWorkflowOpen(false)
              setPortalOpen(false)
              if (historyOpen) onToggleHistory?.()
              if (activityOpen) onToggleActivity?.()
            }
          }}
          aria-pressed={collaborationOpen}
          title="Collaboration"
        >
          <Icon name="message" size={15} />
          <span className={styles.toolLabel}>Collab</span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${clientOpen ? styles.toolOn : ''}`}
          onClick={() => {
            setClientOpen(!clientOpen)
            if (!clientOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setWorkflowOpen(false)
              setPortalOpen(false)
              if (historyOpen) onToggleHistory?.()
              if (activityOpen) onToggleActivity?.()
            }
          }}
          aria-pressed={clientOpen}
          title="Client workspace"
        >
          <Icon name="upload" size={15} />
          <span className={styles.toolLabel}>Client</span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${workflowOpen ? styles.toolOn : ''}`}
          onClick={() => {
            setWorkflowOpen(!workflowOpen)
            if (!workflowOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setClientOpen(false)
              setPortalOpen(false)
              if (historyOpen) onToggleHistory?.()
              if (activityOpen) onToggleActivity?.()
            }
          }}
          aria-pressed={workflowOpen}
          title="Proposal workflow"
        >
          <Icon name="check" size={15} />
          <span className={styles.toolLabel}>Workflow</span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${portalOpen ? styles.toolOn : ''}`}
          onClick={() => {
            setPortalOpen(!portalOpen)
            if (!portalOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setClientOpen(false)
              setWorkflowOpen(false)
              if (historyOpen) onToggleHistory?.()
              if (activityOpen) onToggleActivity?.()
            }
          }}
          aria-pressed={portalOpen}
          title="Client portal"
        >
          <Icon name="eye" size={15} />
          <span className={styles.toolLabel}>Portal</span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${historyOpen ? styles.toolOn : ''}`}
          onClick={() => {
            if (!historyOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setClientOpen(false)
              setWorkflowOpen(false)
              setPortalOpen(false)
              if (activityOpen) onToggleActivity?.()
            }
            onToggleHistory?.()
          }}
          aria-pressed={historyOpen}
          title="Version history"
        >
          <Icon name="history" size={15} />
          <span className={styles.toolLabel}>History</span>
        </button>
        <button
          type="button"
          className={`${styles.tool} ${activityOpen ? styles.toolOn : ''}`}
          onClick={() => {
            if (!activityOpen) {
              setSettingsOpen(false)
              setResponsesOpen(false)
              setCollaborationOpen(false)
              setClientOpen(false)
              setWorkflowOpen(false)
              setPortalOpen(false)
              if (historyOpen) onToggleHistory?.()
            }
            onToggleActivity?.()
          }}
          aria-pressed={activityOpen}
          title="Proposal activity"
        >
          <Icon name="activity" size={15} />
          <span className={styles.toolLabel}>Activity</span>
        </button>
        <button
          type="button"
          className={styles.export}
          onClick={onDownload}
          disabled={downloading || sending}
        >
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button
          type="button"
          className={styles.export}
          onClick={() => onSend?.()}
          disabled={downloading || sending}
        >
          {sending ? 'Sending…' : 'Send proposal'}
        </button>
      </div>
    </div>
  )
}

export default EditorCommandBar
