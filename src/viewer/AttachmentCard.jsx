import Icon from '../components/Icon/Icon.jsx'
import { getFileKind } from './fileKind.js'
import styles from './AttachmentCard.module.css'

function AttachmentCard({ item }) {
  const kind = getFileKind(item.name, item.mimeType, item.url)
  const name = item.name?.trim() || 'Untitled file'

  return (
    <article className={styles.card} data-kind={kind.kind}>
      <div className={styles.icon}>
        <Icon name={kind.icon} size={20} />
      </div>
      <div className={styles.copy}>
        <p className={styles.name}>{name}</p>
        <p className={styles.kind}>{kind.label}</p>
      </div>
      {item.url ? (
        <a
          className={styles.download}
          href={item.url}
          download={name}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="download" size={14} />
          Download
        </a>
      ) : (
        <span className={styles.pending}>Placeholder</span>
      )}
    </article>
  )
}

export default AttachmentCard
