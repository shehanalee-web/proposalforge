import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID, WORKFLOW_ROLE } from './types.js'

export const WORKFLOW_ACTORS = Object.freeze([
  {
    id: 'user-studio-sarah',
    name: 'Sarah',
    email: 'sarah@studio.test',
    role: WORKFLOW_ROLE.OWNER,
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: 'user-studio-david',
    name: 'David',
    email: 'david@studio.test',
    role: WORKFLOW_ROLE.REVIEWER,
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: 'user-studio-alex',
    name: 'Alex',
    email: 'alex@studio.test',
    role: WORKFLOW_ROLE.EDITOR,
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: 'user-studio-sam',
    name: 'Sam',
    email: 'sam@studio.test',
    role: WORKFLOW_ROLE.VIEWER,
    companyId: DEFAULT_COMPANY_ID,
  },
  {
    id: 'user-harborline-lee',
    name: 'Lee',
    email: 'lee@harborline.test',
    role: WORKFLOW_ROLE.OWNER,
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  },
])

export const DEFAULT_ACTOR_ID = 'user-studio-sarah'

export function getWorkflowActor(id) {
  return WORKFLOW_ACTORS.find((actor) => actor.id === id) ?? null
}

export function resolveWorkflowActor(input = {}) {
  if (input && typeof input === 'object' && input.id) {
    const known = getWorkflowActor(input.id)
    return {
      id: String(input.id),
      name: String(input.name ?? known?.name ?? '').trim() || 'Studio',
      email: String(input.email ?? known?.email ?? '').trim(),
      role: String(input.role ?? known?.role ?? WORKFLOW_ROLE.VIEWER),
      companyId: String(input.companyId ?? known?.companyId ?? DEFAULT_COMPANY_ID),
    }
  }
  const id = String(input ?? DEFAULT_ACTOR_ID).trim() || DEFAULT_ACTOR_ID
  return getWorkflowActor(id) ?? getWorkflowActor(DEFAULT_ACTOR_ID)
}

export function actorsForCompany(companyId) {
  const scoped = String(companyId ?? '').trim()
  return WORKFLOW_ACTORS.filter((actor) => actor.companyId === scoped)
}
