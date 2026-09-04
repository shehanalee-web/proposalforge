import { useRef, useState } from 'react'
import { ViewerProvider, useViewer } from './ViewerContext.jsx'
import { useFullscreen } from './useFullscreen.js'
import ViewerStage from './ViewerStage.jsx'
import ViewerActionBar from './ViewerActionBar.jsx'
import ViewerDialog from './ViewerDialog.jsx'
import styles from './ProposalViewer.module.css'

function ViewerInner({
  proposal,
  status,
  notices = [],
  busy = false,
  canRespond = true,
  onAccept,
  onReject,
  onAskQuestion,
  onDownload,
  onPrint,
  onShare,
  onSave,
}) {
  const shellRef = useRef(null)
  const { active: fullscreen, toggle: toggleFullscreen } = useFullscreen(shellRef)
  const { flash, saved, setSaved } = useViewer()
  const [dialog, setDialog] = useState(null)
  const [question, setQuestion] = useState('')

  function handleAccept() {
    if (onAccept) {
      onAccept()
      return
    }
    flash('Accepted — ready to connect later.')
  }

  function handleReject() {
    if (onReject) {
      onReject()
      return
    }
    setDialog('reject')
  }

  function handleAsk() {
    if (onAskQuestion) {
      onAskQuestion()
      return
    }
    setDialog('question')
  }

  function handleShare() {
    if (onShare) {
      onShare()
      return
    }
    const url = window.location.href
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Link copied'),
        () => flash('Share is ready to connect later.'),
      )
      return
    }
    flash('Share is ready to connect later.')
  }

  function handleSave() {
    if (onSave) {
      onSave()
      return
    }
    setSaved((value) => !value)
    flash(saved ? 'Removed from saved' : 'Saved on this device')
  }

  return (
    <div
      ref={shellRef}
      className={`${styles.shell} ${fullscreen ? styles.fullscreen : ''}`}
    >
      <ViewerStage
        proposal={proposal}
        status={status}
        notices={notices}
        onFullscreen={toggleFullscreen}
      />

      <ViewerActionBar
        busy={busy}
        canRespond={canRespond}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onAccept={handleAccept}
        onReject={handleReject}
        onAskQuestion={handleAsk}
        onDownload={onDownload}
        onPrint={onPrint}
        onShare={handleShare}
        onSave={handleSave}
      />

      <ViewerDialog
        open={dialog === 'reject'}
        title="Reject this proposal?"
        description="This stays on the page until a backend is connected."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button type="button" className={styles.ghost} onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => {
                setDialog(null)
                flash('Marked as rejected')
              }}
            >
              Reject
            </button>
          </>
        }
      />

      <ViewerDialog
        open={dialog === 'question'}
        title="Ask a question"
        description="Your note stays local until messaging is connected."
        onClose={() => setDialog(null)}
        footer={
          <>
            <button type="button" className={styles.ghost} onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setDialog(null)
                setQuestion('')
                flash('Question saved locally')
              }}
            >
              Send
            </button>
          </>
        }
      >
        <textarea
          className={styles.textarea}
          rows={5}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What would you like to know?"
        />
      </ViewerDialog>
    </div>
  )
}

function ProposalViewer(props) {
  return (
    <ViewerProvider>
      <ViewerInner {...props} />
    </ViewerProvider>
  )
}

export default ProposalViewer
