import { useMemo, useRef } from 'react'
import { useViewer } from './ViewerContext.jsx'
import { listViewerSections } from './sectionMeta.js'
import { useReadingProgress } from './useReadingProgress.js'
import { scrollToSection, useScrollSpy } from './useScrollSpy.js'
import { useViewerKeyboard } from './useViewerKeyboard.js'
import ReadingProgress from './ReadingProgress.jsx'
import ViewerToc from './ViewerToc.jsx'
import ViewerDocument from './ViewerDocument.jsx'
import ViewerToast from './ViewerToast.jsx'
import GalleryLightbox from './GalleryLightbox.jsx'
import { useProposalTheme } from '../theme/ProposalThemeContext.jsx'
import styles from './ProposalViewer.module.css'

/**
 * Read-only proposal stage: TOC, themed document, lightbox, keyboard.
 * Must render inside ViewerProvider. Does not include studio editor chrome.
 */
function ViewerStage({
  proposal,
  status,
  notices = [],
  embedded = false,
  onFullscreen,
  children,
}) {
  const articleRef = useRef(null)
  const sections = useMemo(
    () => listViewerSections(proposal.blocks ?? [], proposal),
    [proposal],
  )
  const sectionIds = sections.map((section) => section.id)
  const activeId = useScrollSpy(sectionIds)
  const progress = useReadingProgress(articleRef)
  const { tokens, cssVars } = useProposalTheme()
  const {
    lightbox,
    setLightbox,
    closeGallery,
    notice,
  } = useViewer()

  const lightboxOpen = Boolean(lightbox)

  useViewerKeyboard({
    sectionIds,
    activeId,
    onJump: scrollToSection,
    onFullscreen,
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

  return (
    <div
      className={`${styles.stage} ${embedded ? styles.stageEmbedded : ''}`}
      style={cssVars}
    >
      {tokens.page.showProgress ? <ReadingProgress value={progress} /> : null}
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

          <ViewerDocument proposal={proposal} status={status} readOnly />
          {children}
        </div>
      </div>

      <GalleryLightbox />
    </div>
  )
}

export default ViewerStage
