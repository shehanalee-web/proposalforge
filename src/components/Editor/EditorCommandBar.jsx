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
  hasResponses = false,
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
          className={styles.export}
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>
    </div>
  )
}

export default EditorCommandBar
