import styles from './blocks.module.css'

function TagsBlock({ proposal }) {
  const tags = proposal.tags ?? []

  if (tags.length === 0) return null

  return (
    <ul className={styles.tags}>
      {tags.map((tag) => (
        <li key={tag} className={styles.tag}>
          {tag}
        </li>
      ))}
    </ul>
  )
}

export default TagsBlock
