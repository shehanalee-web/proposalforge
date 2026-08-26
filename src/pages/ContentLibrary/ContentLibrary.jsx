import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { listContentBlockTypes } from '../../models/contentBlock.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'

function ContentLibrary() {
  const types = listContentBlockTypes()

  return (
    <WorkspacePlaceholder moduleId={WORKSPACE_MODULE.CONTENT_LIBRARY}>
      <ul className={styles.catalog} aria-label="Registered content block types">
        {types.map((item) => (
          <li key={item.type} className={styles.chip}>
            {item.label}
          </li>
        ))}
      </ul>
    </WorkspacePlaceholder>
  )
}

export default ContentLibrary
