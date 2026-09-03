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
  fullscreen,
  onToggleFullscreen,
  onAccept,
  onReject,
  onAskQuestion,
  onDownload,
  onPrint,
  onShare,
  onSave,
}) {
  const { saved } = useViewer()

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="toolbar" aria-label="Proposal actions">
        {canRespond ? (
          <>
            <Action icon="check" label="Accept" primary disabled={busy} onClick={onAccept} />
            <Action icon="xCircle" label="Reject" danger disabled={busy} onClick={onReject} />
            <Action icon="message" label="Ask question" disabled={busy} onClick={onAskQuestion} />
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
