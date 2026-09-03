import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'

function Services() {
  return (
    <WorkspacePlaceholder moduleId={WORKSPACE_MODULE.SERVICES}>
      <p className={styles.emptyNote}>
        No services yet. Proposal types on Create Proposal remain the starting
        point until this library is filled.
      </p>
    </WorkspacePlaceholder>
  )
}

export default Services
