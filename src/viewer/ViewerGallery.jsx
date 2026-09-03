import { useViewer } from './ViewerContext.jsx'
import styles from './ViewerGallery.module.css'

function ViewerGallery({ instance }) {
  const { openGallery } = useViewer()
  const items = (instance.data.items ?? []).filter((item) => item.url?.trim())
  if (items.length === 0) return null

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Gallery</h3>
      <ul className={styles.grid}>
        {items.map((item, index) => (
          <li key={item.id ?? index}>
            <button
              type="button"
              className={styles.card}
              onClick={() => openGallery(items, index)}
            >
              <img src={item.url} alt={item.caption || `Proposal image ${index + 1}`} />
              {item.caption ? <span className={styles.caption}>{item.caption}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ViewerGallery
