import WorkflowStatusBadge from './WorkflowStatusBadge.jsx'
import { getWorkflowSummary } from '../../workflow/summary.js'
import styles from './WorkflowStrip.module.css'

function WorkflowStrip({ workflow, health, intelligence, consistency, onOpen }) {
  if (!workflow) return null
  const summary = getWorkflowSummary({
    workflow,
    health,
    intelligence,
    consistency,
  })

  return (
    <div className={styles.strip}>
      <div className={styles.main}>
        <p className={styles.kicker}>Workflow</p>
        <div className={styles.row}>
          <WorkflowStatusBadge status={workflow.status} />
          <span className={styles.meta}>
            Owner: {summary.ownerName}
            {summary.reviewerNames.length
              ? ` · Reviewer: ${summary.reviewerNames.join(', ')}`
              : ''}
          </span>
        </div>
        <p className={styles.next} role="status">
          {summary.waitingFor
            ? `Waiting for: ${summary.waitingFor}`
            : summary.nextAction}
        </p>
      </div>
      <button type="button" className={styles.open} onClick={onOpen}>
        Open workflow
      </button>
    </div>
  )
}

export default WorkflowStrip
