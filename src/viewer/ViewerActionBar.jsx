import Icon from '../components/Icon/Icon.jsx'
import { useViewer } from './ViewerContext.jsx'
import styles from './ViewerActionBar.module.css'

function Action({ icon, label, onClick, disabled, primary, danger }) {
  return (
    <button
      type="button"
      className={[
        styles.action,
        primary && styles.primary,
        danger && styles.danger,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </button>
  )
}

function ViewerActionBar({
  busy = false,
  canRespond = true,
  showAccept = true,
  showReject = true,
  showAsk = true,
  showRevision = false,
  acceptLabel = 'Accept',
  rejectLabel = 'Reject',
  fullscreen,
  onToggleFullscreen,
  onAccept,
  onReject,
  onAskQuestion,
  onRequestChanges,
  onDownload,
  onPrint,
  onShare,
  onSave,
}) {
  const { saved } = useViewer()
  const respond =
    canRespond && (showAccept || showReject || showAsk || showRevision)

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="toolbar" aria-label="Proposal actions">
        {respond ? (
          <>
            {showAccept ? (
              <Action icon="check" label={acceptLabel} primary disabled={busy} onClick={onAccept} />
            ) : null}
            {showReject ? (
              <Action icon="xCircle" label={rejectLabel} danger disabled={busy} onClick={onReject} />
            ) : null}
            {showAsk ? (
              <Action icon="message" label="Ask question" disabled={busy} onClick={onAskQuestion} />
            ) : null}
            {showRevision ? (
              <Action icon="pen" label="Request Changes" disabled={busy} onClick={onRequestChanges} />
            ) : null}
          </>
        ) : null}
        <Action icon="download" label="Download PDF" disabled={busy} onClick={onDownload} />
        <Action icon="print" label="Print" disabled={busy} onClick={onPrint} />
        <Action icon="share" label="Share" disabled={busy} onClick={onShare} />
        <Action
          icon="bookmark"
          label={saved ? 'Saved' : 'Save'}
          disabled={busy}
          onClick={onSave}
        />
        <Action
          icon={fullscreen ? 'minimize' : 'maximize'}
          label={fullscreen ? 'Exit' : 'Full screen'}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  )
}

export default ViewerActionBar
