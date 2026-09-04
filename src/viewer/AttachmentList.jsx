import AttachmentCard from './AttachmentCard.jsx'
import styles from './AttachmentList.module.css'

function AttachmentList({ instance }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.name?.trim() || item.url?.trim(),
  )
  if (items.length === 0) return null

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Attachments</h3>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <AttachmentCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AttachmentList
