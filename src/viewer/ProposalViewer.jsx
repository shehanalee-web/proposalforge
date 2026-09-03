import { useMemo, useRef, useState } from 'react'
import { ViewerProvider, useViewer } from './ViewerContext.jsx'
import { listViewerSections } from './sectionMeta.js'
import { useReadingProgress } from './useReadingProgress.js'
import { scrollToSection, useScrollSpy } from './useScrollSpy.js'
import { useFullscreen } from './useFullscreen.js'
import { useViewerKeyboard } from './useViewerKeyboard.js'
import ReadingProgress from './ReadingProgress.jsx'
import ViewerToc from './ViewerToc.jsx'
import ViewerDocument from './ViewerDocument.jsx'
import ViewerActionBar from './ViewerActionBar.jsx'
import ViewerDialog from './ViewerDialog.jsx'
import ViewerToast from './ViewerToast.jsx'
import GalleryLightbox from './GalleryLightbox.jsx'
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
  const articleRef = useRef(null)
  const sections = useMemo(
    () => listViewerSections(proposal.blocks ?? []),
    [proposal.blocks],
  )
  const sectionIds = sections.map((section) => section.id)
  const activeId = useScrollSpy(sectionIds)
  const progress = useReadingProgress(articleRef)
  const { active: fullscreen, toggle: toggleFullscreen } = useFullscreen(shellRef)
  const {
    lightbox,
    setLightbox,
    closeGallery,
    flash,
    notice,
    saved,
    setSaved,
  } = useViewer()

  const [dialog, setDialog] = useState(null)
  const [question, setQuestion] = useState('')

  const lightboxOpen = Boolean(lightbox)

  useViewerKeyboard({
    sectionIds,
    activeId,
    onJump: scrollToSection,
    onFullscreen: toggleFullscreen,
    lightboxOpen,
    onLightboxClose: closeGallery,
    onLightboxPrev: () =>
      setLightbox((current) =>
        current
          ? {
              ...current,
              index:
                (current.index - 1 + current.items.length) % current.items.length,
              zoom: 1,
            }
          : current,
      ),
    onLightboxNext: () =>
      setLightbox((current) =>
        current
          ? {
              ...current,
              index: (current.index + 1) % current.items.length,
              zoom: 1,
            }
          : current,
      ),
    onLightboxZoomIn: () =>
      setLightbox((current) =>
        current ? { ...current, zoom: Math.min(3, current.zoom + 0.25) } : current,
      ),
    onLightboxZoomOut: () =>
      setLightbox((current) =>
        current ? { ...current, zoom: Math.max(1, current.zoom - 0.25) } : current,
      ),
  })

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
      <ReadingProgress value={progress} />
      <ViewerToast message={notice} />

      <div className={styles.frame} ref={articleRef}>
        <ViewerToc sections={sections} activeId={activeId} />

        <div className={styles.main}>
          {notices.map((item) => (
            <aside key={item.id} className={`${styles.banner} ${styles[item.tone] ?? ''}`}>
              <p className={styles.bannerTitle}>{item.title}</p>
              {item.body ? <p className={styles.bannerBody}>{item.body}</p> : null}
            </aside>
          ))}

          <ViewerDocument proposal={proposal} status={status} />
        </div>
      </div>

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

      <GalleryLightbox />

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
