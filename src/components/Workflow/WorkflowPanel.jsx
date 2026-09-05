import { useMemo, useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import WorkflowStatusBadge from './WorkflowStatusBadge.jsx'
import { activityLabel, actorName } from './format.js'
import { actorsForCompany } from '../../workflow/actors.js'
import {
  canApprove,
  canAssign,
  canComment,
  canCreateTask,
  canMarkReady,
  canRequestChanges,
  canTransition,
  commentNavigation,
  DEFAULT_COMPANY_ID,
  getApprovalBlockers,
  getWorkflowSummary,
  isTaskOverdue,
  TASK_SOURCE,
  TASK_STATUS,
  WORKFLOW_STATUS,
} from '../../workflow/index.js'
import { getWorkflowActor } from '../../workflow/actors.js'
import { formatDateTime } from '../../utils/format.js'
import { analyzeProposalCoaching } from '../../coach/index.js'
import { useProposalHealth } from '../../hooks/useProposalHealth.js'
import { useProposalIntelligence } from '../../hooks/useProposalIntelligence.js'
import { useProposalConsistency } from '../../hooks/useProposalConsistency.js'
import { useEditorWorkspace } from '../Editor/EditorWorkspaceContext.jsx'
import styles from './WorkflowPanel.module.css'

const SOURCE_LABEL = {
  [TASK_SOURCE.MANUAL]: 'Manual',
  [TASK_SOURCE.HEALTH]: 'Health',
  [TASK_SOURCE.CONSISTENCY]: 'Consistency',
  [TASK_SOURCE.COACH]: 'Coach',
}

function WorkflowPanel(props) {
  if (!props.open) return null
  return <WorkflowPanelBody {...props} />
}

function WorkflowPanelBody({
  proposal,
  blocks,
  onClose,
  workflow,
  loading,
  error,
  actorId,
  onActorChange,
  actions,
}) {
  const { scrollToBlock, setInspectorOpen, setActiveBlockId } = useEditorWorkspace()
  const health = useProposalHealth(proposal, blocks)
  const intelligence = useProposalIntelligence(proposal, blocks)
  const consistency = useProposalConsistency(proposal, blocks)
  const coach = useMemo(
    () =>
      analyzeProposalCoaching({
        proposal,
        health,
        diagnostics: health?.suggestions,
        intelligence,
        consistency,
      }),
    [proposal, health, intelligence, consistency],
  )

  const [commentBody, setCommentBody] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const actor = getWorkflowActor(actorId)
  const summary = workflow
    ? getWorkflowSummary({ proposal, workflow, health, intelligence, consistency, coach })
    : null
  const blockers = workflow ? getApprovalBlockers(workflow) : null
  const companyActors = actorsForCompany(workflow?.companyId || DEFAULT_COMPANY_ID)

  async function run(label, fn) {
    setBusy(true)
    setFormError('')
    try {
      await fn()
    } catch (caught) {
      setFormError(caught.message || `Could not ${label}.`)
    } finally {
      setBusy(false)
    }
  }

  function jumpToBlock(blockId) {
    if (!blockId) return
    setActiveBlockId(blockId)
    setInspectorOpen(true)
    scrollToBlock(blockId)
  }

  const canSend = workflow && canTransition(actor, workflow, workflow.status, WORKFLOW_STATUS.IN_REVIEW)
  const canResubmit =
    workflow?.status === WORKFLOW_STATUS.CHANGES_REQUESTED &&
    canTransition(actor, workflow, workflow.status, WORKFLOW_STATUS.IN_REVIEW)
  const showApprove = workflow && canApprove(actor, workflow)
  const showChanges = workflow && canRequestChanges(actor, workflow)
  const showRequestChanges =
    showChanges &&
    (workflow.status === WORKFLOW_STATUS.IN_REVIEW ||
      workflow.status === WORKFLOW_STATUS.APPROVED ||
      workflow.status === WORKFLOW_STATUS.READY_TO_SEND)
  const showReady =
    workflow?.status === WORKFLOW_STATUS.APPROVED && canMarkReady(actor)

  return (
    <aside className={styles.panel} aria-label="Proposal workflow">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Internal</p>
          <h2 className={styles.title}>Workflow</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close workflow"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.scroll}>
        {loading && !workflow ? <p className={styles.muted}>Loading workflow…</p> : null}
        {error ? <p className={styles.alert}>{error.message}</p> : null}
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}

        {workflow && summary ? (
          <>
            <section className={styles.card} aria-labelledby="wf-summary-heading">
              <div className={styles.cardHead}>
                <h3 id="wf-summary-heading">Proposal Workflow</h3>
                <WorkflowStatusBadge status={workflow.status} />
              </div>
              <p className={styles.muted}>{summary.statusDescription}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>Owner</dt>
                  <dd>{summary.ownerName}</dd>
                </div>
                <div>
                  <dt>Reviewers</dt>
                  <dd>{summary.reviewerNames.join(', ') || 'None'}</dd>
                </div>
                <div>
                  <dt>Pending approvals</dt>
                  <dd>{summary.pendingApprovals}</dd>
                </div>
                <div>
                  <dt>Open comments</dt>
                  <dd>{summary.openComments}</dd>
                </div>
                <div>
                  <dt>Open tasks</dt>
                  <dd>{summary.openTasks}</dd>
                </div>
              </dl>
              <p className={styles.next} role="status">
                Next action: {summary.nextAction}
              </p>
              {summary.healthScore != null ? (
                <p className={styles.scores}>
                  Health: {summary.healthScore}
                  {summary.consistencyScore != null
                    ? ` · Consistency: ${summary.consistencyScore}`
                    : ''}
                  {summary.readiness ? ` · ${summary.readiness}` : ''}
                </p>
              ) : null}
              {blockers?.blocked && workflow.status === WORKFLOW_STATUS.IN_REVIEW ? (
                <p className={styles.alert}>{blockers.message}</p>
              ) : null}
            </section>

            <section className={styles.card}>
              <h3>Acting as</h3>
              <label className={styles.field}>
                <span className={styles.hidden}>Workflow actor</span>
                <select
                  className={styles.select}
                  value={actorId}
                  onChange={(event) => onActorChange?.(event.target.value)}
                >
                  {companyActors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.role})
                    </option>
                  ))}
                </select>
              </label>
              {canAssign(actor) ? (
                <label className={styles.field}>
                  <span>Assign reviewer</span>
                  <select
                    className={styles.select}
                    defaultValue=""
                    disabled={busy}
                    onChange={(event) => {
                      const reviewerId = event.target.value
                      event.target.value = ''
                      if (reviewerId) run('assign reviewer', () => actions.assign({ reviewerId }))
                    }}
                  >
                    <option value="">Choose reviewer</option>
                    {companyActors
                      .filter((item) => item.id !== workflow.ownerId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <div className={styles.actions}>
                {canSend && workflow.status === WORKFLOW_STATUS.DRAFT ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() =>
                      run('send for review', () =>
                        actions.transition(WORKFLOW_STATUS.IN_REVIEW),
                      )
                    }
                  >
                    Send for Review
                  </button>
                ) : null}
                {canResubmit ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() =>
                      run('resubmit', () => actions.transition(WORKFLOW_STATUS.IN_REVIEW))
                    }
                  >
                    Resubmit
                  </button>
                ) : null}
                {showApprove && workflow.status === WORKFLOW_STATUS.IN_REVIEW ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => run('approve', () => actions.approve())}
                  >
                    Approve
                  </button>
                ) : null}
                {showRequestChanges ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      run('request changes', () => actions.requestChanges(changeNote))
                    }
                  >
                    Request Changes
                  </button>
                ) : null}
                {showReady ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() =>
                      run('mark ready', () =>
                        actions.transition(WORKFLOW_STATUS.READY_TO_SEND),
                      )
                    }
                  >
                    Mark Ready
                  </button>
                ) : null}
              </div>
              {showRequestChanges ? (
                <label className={styles.field}>
                  <span>Change note</span>
                  <textarea
                    className={styles.input}
                    rows={2}
                    value={changeNote}
                    onChange={(event) => setChangeNote(event.target.value)}
                  />
                </label>
              ) : null}
            </section>

            <section className={styles.card} aria-labelledby="wf-approvals-heading">
              <h3 id="wf-approvals-heading">Approvals</h3>
              {(workflow.approvals ?? []).length === 0 ? (
                <p className={styles.muted}>No reviewers assigned yet.</p>
              ) : (
                <ul className={styles.list}>
                  {workflow.approvals.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <div>
                        <p className={styles.itemTitle}>{actorName(item.reviewerId)}</p>
                        <p className={styles.muted}>
                          {item.status.replace('_', ' ')}
                          {item.note ? ` · ${item.note}` : ''}
                        </p>
                      </div>
                      <time className={styles.muted} dateTime={item.updatedAt}>
                        {formatDateTime(item.updatedAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.card} aria-labelledby="wf-comments-heading">
              <h3 id="wf-comments-heading">Comments</h3>
              {canComment(actor) ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault()
                    run('add comment', async () => {
                      await actions.addComment(commentBody)
                      setCommentBody('')
                    })
                  }}
                >
                  <label className={styles.field}>
                    <span>Internal comment</span>
                    <textarea
                      className={styles.input}
                      rows={3}
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className={styles.secondary} disabled={busy}>
                    Add comment
                  </button>
                </form>
              ) : null}
              <ul className={styles.list}>
                {[...(workflow.comments ?? [])]
                  .sort((a, b) => Number(a.resolved) - Number(b.resolved))
                  .map((comment) => {
                    const nav = commentNavigation(comment)
                    return (
                      <li key={comment.id} className={styles.item}>
                        <div className={styles.itemBody}>
                          <p className={styles.itemTitle}>
                            {comment.authorName || actorName(comment.authorId)}
                            {comment.resolved ? ' · Resolved' : ''}
                          </p>
                          <p>{comment.body}</p>
                          <p className={styles.muted}>{formatDateTime(comment.createdAt)}</p>
                          {nav ? (
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => jumpToBlock(nav.blockId)}
                            >
                              Open section
                            </button>
                          ) : null}
                        </div>
                        {canComment(actor) ? (
                          <button
                            type="button"
                            className={styles.ghost}
                            disabled={busy}
                            onClick={() =>
                              run(
                                comment.resolved ? 'reopen comment' : 'resolve comment',
                                () =>
                                  actions.patchComment(
                                    comment.id,
                                    comment.resolved ? 'reopen' : 'resolve',
                                  ),
                              )
                            }
                          >
                            {comment.resolved ? 'Reopen' : 'Resolve'}
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
              </ul>
            </section>

            <section className={styles.card} aria-labelledby="wf-tasks-heading">
              <h3 id="wf-tasks-heading">Tasks</h3>
              {canCreateTask(actor) ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault()
                    run('create task', async () => {
                      await actions.createTask({ title: taskTitle })
                      setTaskTitle('')
                    })
                  }}
                >
                  <label className={styles.field}>
                    <span>New task</span>
                    <input
                      className={styles.input}
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className={styles.secondary} disabled={busy}>
                    Create task
                  </button>
                </form>
              ) : null}
              <div className={styles.findings}>
                {health?.suggestions?.[0] ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() =>
                      run('create health task', () =>
                        actions.createTask({
                          finding: health.suggestions[0],
                          source: TASK_SOURCE.HEALTH,
                        }),
                      )
                    }
                  >
                    Task from Health
                  </button>
                ) : null}
                {consistency?.contradictions?.[0] ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() =>
                      run('create consistency task', () =>
                        actions.createTask({
                          finding: consistency.contradictions[0],
                          source: TASK_SOURCE.CONSISTENCY,
                        }),
                      )
                    }
                  >
                    Task from Consistency
                  </button>
                ) : null}
                {coach?.items?.[0] ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() =>
                      run('create coach task', () =>
                        actions.createTask({
                          finding: coach.items[0],
                          source: TASK_SOURCE.COACH,
                        }),
                      )
                    }
                  >
                    Task from Coach
                  </button>
                ) : null}
              </div>
              <ul className={styles.list}>
                {(workflow.tasks ?? []).map((task) => (
                  <li key={task.id} className={styles.item}>
                    <div>
                      <p className={styles.itemTitle}>{task.title}</p>
                      <p className={styles.muted}>
                        {SOURCE_LABEL[task.source] || 'Manual'}
                        {task.assigneeId ? ` · ${actorName(task.assigneeId)}` : ''}
                        {task.dueAt ? ` · Due ${formatDateTime(task.dueAt)}` : ''}
                        {isTaskOverdue(task) ? ' · Overdue' : ''}
                      </p>
                    </div>
                    {task.status !== TASK_STATUS.DONE ? (
                      <button
                        type="button"
                        className={styles.ghost}
                        disabled={busy}
                        onClick={() =>
                          run('complete task', () =>
                            actions.patchTask(task.id, { status: TASK_STATUS.DONE }),
                          )
                        }
                      >
                        Complete
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.ghost}
                        disabled={busy}
                        onClick={() =>
                          run('reopen task', () =>
                            actions.patchTask(task.id, { status: TASK_STATUS.OPEN }),
                          )
                        }
                      >
                        Reopen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.card} aria-labelledby="wf-activity-heading">
              <h3 id="wf-activity-heading">Activity</h3>
              <ol className={styles.timeline}>
                {[...(workflow.activity ?? [])]
                  .slice()
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      <p>{activityLabel(event)}</p>
                      <time className={styles.muted} dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                    </li>
                  ))}
              </ol>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  )
}

export default WorkflowPanel
