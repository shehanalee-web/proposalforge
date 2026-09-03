import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'

function CaseStudies() {
  return (
    <WorkspacePlaceholder moduleId={WORKSPACE_MODULE.CASE_STUDIES}>
      <p className={styles.emptyNote}>
        No case studies yet. Past work added here will be reusable on any
        proposal layout.
      </p>
    </WorkspacePlaceholder>
  )
}

export default CaseStudies
