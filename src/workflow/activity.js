import { makeWorkflowEvent } from './schema.js'
import { WORKFLOW_EVENT } from './types.js'

export function appendActivity(workflow, input) {
  const event = makeWorkflowEvent({
    proposalId: workflow.proposalId,
    companyId: workflow.companyId,
    ...input,
  })
  return {
    workflow: {
      ...workflow,
      activity: [...(workflow.activity ?? []), event],
    },
    event,
  }
}

export function getActivity(workflow) {
  return [...(workflow?.activity ?? [])].sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt)),
  )
}

export { WORKFLOW_EVENT }
