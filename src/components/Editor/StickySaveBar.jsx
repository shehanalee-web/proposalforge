import SaveStatus from './SaveStatus.jsx'
import styles from './StickySaveBar.module.css'

function StickySaveBar({
  submitting = false,
  submitLabel = 'Save changes',
  submittingLabel = 'Saving…',
  saveStatus = 'idle',
  saveLabel = 'All changes saved',
}) {
  return (
    <div className={styles.bar} data-editor-chrome>
      <SaveStatus status={saveStatus} label={saveLabel} />
      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  )
}

export default StickySaveBar
