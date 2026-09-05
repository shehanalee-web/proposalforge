import { TASK_STATUS } from './types.js'

/**
 * Isolated overdue check. Does not affect Health or scoring.
 *
 * @param {{ dueAt?: string | null, status?: string }} task
 * @param {number | Date} [now]
 */
export function isTaskOverdue(task, now = Date.now()) {
  if (!task?.dueAt) return false
  if (task.status === TASK_STATUS.DONE || task.status === TASK_STATUS.CANCELLED) {
    return false
  }
  const due = new Date(task.dueAt).getTime()
  if (!Number.isFinite(due)) return false
  const clock = now instanceof Date ? now.getTime() : Number(now)
  return due < clock
}

export function openTasks(workflow) {
  return (workflow?.tasks ?? []).filter(
    (item) => item.status !== TASK_STATUS.DONE && item.status !== TASK_STATUS.CANCELLED,
  )
}

export function overdueTasks(workflow, now = Date.now()) {
  return (workflow?.tasks ?? []).filter((item) => isTaskOverdue(item, now))
}

export function findingTaskFields(finding = {}, source) {
  const title =
    String(finding.title ?? finding.nextAction ?? finding.recommendation ?? '').trim() ||
    'Follow up on finding'
  const description = String(
    finding.description ??
      finding.message ??
      finding.suggestion ??
      finding.explanation ??
      finding.recommendation ??
      '',
  ).trim()
  return {
    title,
    description,
    source,
    sourceId: String(finding.id ?? finding.code ?? '').trim() || null,
    blockId: finding.blockId ?? finding.navigateTo ?? null,
  }
}
