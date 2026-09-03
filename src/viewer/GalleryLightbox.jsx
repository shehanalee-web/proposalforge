import Icon from '../components/Icon/Icon.jsx'
import { useViewer } from './ViewerContext.jsx'
import styles from './GalleryLightbox.module.css'

function GalleryLightbox() {
  const { lightbox, setLightbox, closeGallery } = useViewer()
  if (!lightbox) return null

  const { items, index, zoom } = lightbox
  const item = items[index]
  if (!item) return null

  const count = items.length

  function go(offset) {
    setLightbox((current) => {
      if (!current) return current
      const next = (current.index + offset + current.items.length) % current.items.length
      return { ...current, index: next, zoom: 1 }
    })
  }

  function setZoom(next) {
    setLightbox((current) =>
      current ? { ...current, zoom: Math.min(3, Math.max(1, next)) } : current,
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Gallery">
      <button type="button" className={styles.backdrop} aria-label="Close gallery" onClick={closeGallery} />

      <div className={styles.toolbar}>
        <p className={styles.meta}>
          {index + 1} / {count}
          {item.caption ? ` · ${item.caption}` : ''}
        </p>
        <div className={styles.tools}>
          <button type="button" onClick={() => setZoom(zoom - 0.25)} aria-label="Zoom out">
            <Icon name="zoomOut" size={16} />
          </button>
          <button type="button" onClick={() => setZoom(zoom + 0.25)} aria-label="Zoom in">
            <Icon name="zoomIn" size={16} />
          </button>
          <button
            type="button"
            aria-label="Full screen"
            onClick={() => {
              const root = document.documentElement
              if (document.fullscreenElement) {
                document.exitFullscreen?.()
              } else {
                root.requestFullscreen?.()
              }
            }}
          >
            <Icon name="maximize" size={16} />
          </button>
          <button type="button" onClick={closeGallery} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {count > 1 ? (
        <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous image">
          <Icon name="chevronLeft" size={22} />
        </button>
      ) : null}

      <div className={styles.stage}>
        <img
          src={item.url}
          alt={item.caption || `Image ${index + 1}`}
          style={{ transform: `scale(${zoom})` }}
        />
      </div>

      {count > 1 ? (
        <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(1)} aria-label="Next image">
          <Icon name="chevronRight" size={22} />
        </button>
      ) : null}

      {count > 1 ? (
        <ol className={styles.thumbs}>
          {items.map((entry, i) => (
            <li key={entry.id ?? i}>
              <button
                type="button"
                className={i === index ? styles.thumbOn : styles.thumb}
                onClick={() => setLightbox((current) => ({ ...current, index: i, zoom: 1 }))}
              >
                <img src={entry.url} alt="" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

export default GalleryLightbox
