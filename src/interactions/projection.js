import { INTERACTION_SOURCE, INTERACTION_STATUS } from './types.js'

export const INTERNAL_INTERACTION_KEYS = Object.freeze([
  'companyId',
  'source',
  'actorId',
  'actorName',
  'acknowledgedBy',
  'resolvedBy',
  'activity',
  'notes',
  'comments',
  'clientActivity',
  'versions',
  'currentVersion',
  'shareToken',
  'shareAccess',
  'generation',
  'approval',
  'signature',
  'payment',
  'analytics',
  'uploads',
  'uploadFolders',
  'questionnaire',
  'lastEmail',
  'health',
  'intelligence',
  'consistency',
  'coach',
  'improve',
  'tasks',
  'reviewerIds',
  'assigneeIds',
  'ownerId',
  'prompt',
  'prompts',
  'provider',
  'apiKey',
  'apiKeys',
  'knowledge',
  'knowledgeIds',
  'knowledgeIdsUsed',
  'blocks',
  'sections',
  'items',
  'summary',
  'proposal',
  'portal',
  'workflow',
  'updatedAt',
])

export function presentClientInteraction(record, { blockMissing = false } = {}) {
  return {
    kind: 'client_interaction',
    id: record?.id ?? '',
    portalId: record?.portalId ?? '',
    proposalId: record?.proposalId ?? '',
    type: record?.type ?? '',
    status: record?.status ?? INTERACTION_STATUS.OPEN,
    message: record?.message ?? '',
    blockId: record?.blockId ?? '',
    blockLabel: record?.blockLabel ?? '',
    blockUnavailable: Boolean(blockMissing && record?.blockId),
    createdAt: record?.createdAt ?? null,
    acknowledgedAt: record?.acknowledgedAt ?? null,
    resolvedAt: record?.resolvedAt ?? null,
  }
}

export function presentStudioInteraction(record, extras = {}) {
  return {
    kind: 'studio_interaction',
    id: record.id,
    companyId: record.companyId,
    portalId: record.portalId,
    proposalId: record.proposalId,
    type: record.type,
    status: record.status,
    source: record.source ?? INTERACTION_SOURCE.CLIENT,
    actorName: record.actorName,
    message: record.message,
    blockId: record.blockId,
    blockLabel: record.blockLabel,
    blockUnavailable: Boolean(extras.blockMissing && record.blockId),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    acknowledgedAt: record.acknowledgedAt,
    acknowledgedBy: record.acknowledgedBy,
    resolvedAt: record.resolvedAt,
    resolvedBy: record.resolvedBy,
    activity: record.activity ?? [],
  }
}

export function assertClientSafeInteraction(view) {
  if (!view || view.kind !== 'client_interaction') return false
  return INTERNAL_INTERACTION_KEYS.every((key) => !(key in view))
}

export function presentUnavailableInteractions(reason, message) {
  return {
    kind: 'client_interactions_unavailable',
    reason,
    message,
  }
}
