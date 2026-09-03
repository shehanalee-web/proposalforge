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
}) {
  const { setPreviewMode, outlineOpen, setOutlineOpen, focusSearch } =
    useEditorWorkspace()

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
