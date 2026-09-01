import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { BUILTIN_BLOCK_TYPES } from '../../blocks/ids.js'
import { CONTENT_BLOCK_TYPE_LABELS } from '../../models/contentBlock.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'

function ContentLibrary() {
  return (
    <WorkspacePlaceholder moduleId={WORKSPACE_MODULE.CONTENT_LIBRARY}>
      <ul className={styles.catalog} aria-label="Live content block types">
        {BUILTIN_BLOCK_TYPES.map((type) => (
          <li key={type} className={styles.chip}>
            {CONTENT_BLOCK_TYPE_LABELS[type] ?? type}
          </li>
        ))}
      </ul>
    </WorkspacePlaceholder>
  )
}

export default ContentLibrary
