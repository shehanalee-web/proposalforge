import { useCallback } from 'react'
import { useAsyncData } from './useAsyncData.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import {
  addWorkflowCommentApi,
  assignWorkflowApi,
  createWorkflowTaskApi,
  fetchWorkflow,
  patchWorkflowCommentApi,
  patchWorkflowTaskApi,
  postWorkflowApprovalApi,
  transitionWorkflowApi,
} from '../services/workflowService.js'

export function useProposalWorkflow(proposalId, actorId = DEFAULT_ACTOR_ID) {
  const task = useCallback(() => {
    if (!proposalId) return Promise.resolve(null)
    return fetchWorkflow({ proposalId, actorId })
  }, [proposalId, actorId])

  const { data, loading, error, refetch, setData } = useAsyncData(task, {
    enabled: Boolean(proposalId),
    initialData: null,
  })

  const run = useCallback(
    async (fn) => {
      const workflow = await fn()
      setData(workflow)
      return workflow
    },
    [setData],
  )

  return {
    workflow: data,
    loading,
    error,
    refetch,
    setWorkflow: setData,
    actorId,
    transition: (to, note) =>
      run(() => transitionWorkflowApi({ proposalId, actorId, to, note })),
    assign: (body) => run(() => assignWorkflowApi({ proposalId, actorId, ...body })),
    addComment: (body, blockId) =>
      run(async () => {
        const result = await addWorkflowCommentApi({ proposalId, actorId, body, blockId })
        return result.workflow ?? result
      }),
    patchComment: (commentId, action) =>
      run(() => patchWorkflowCommentApi({ proposalId, actorId, commentId, action })),
    createTask: (body) =>
      run(async () => {
        const result = await createWorkflowTaskApi({ proposalId, actorId, ...body })
        return result.workflow ?? result
      }),
    patchTask: (taskId, changes) =>
      run(() => patchWorkflowTaskApi({ proposalId, actorId, taskId, changes })),
    approve: (note) =>
      run(() => postWorkflowApprovalApi({ proposalId, actorId, action: 'approve', note })),
    requestChanges: (note, blockId) =>
      run(() =>
        postWorkflowApprovalApi({
          proposalId,
          actorId,
          action: 'request_changes',
          note,
          blockId,
        }),
      ),
  }
}
