import styles from './blocks.module.css'

/**
 * Optional image strip.
 *
 * Layouts can include this block today. It renders nothing until the proposal
 * model grows an `images` array — no content is duplicated, and no layout
 * rewrite is required when assets arrive.
 */
function ImageGallery({ proposal }) {
  const images = Array.isArray(proposal.images)
    ? proposal.images.filter((image) => image?.src || image?.url)
    : []

  if (images.length === 0) return null

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Gallery</h3>
      <ul className={styles.gallery}>
        {images.map((image, index) => {
          const src = image.src ?? image.url
          const caption = image.caption ?? image.alt ?? ''

          return (
            <li key={image.id ?? `image-${index}`} className={styles.galleryItem}>
              <div className={styles.galleryFrame}>
                <img src={src} alt={caption || `Proposal image ${index + 1}`} />
              </div>
              {caption ? (
                <p className={styles.galleryCaption}>{caption}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ImageGallery
