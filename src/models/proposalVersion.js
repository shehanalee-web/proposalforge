/**
 * Proposal version history.
 *
 * Versions are stored on the proposal itself. Each snapshot is a deep copy of
 * the document at save time, so later edits cannot mutate past versions.
 * Restore always appends. Nothing in this log is rewritten.
 */

export const DEFAULT_UPDATED_BY = 'Studio'

export const VERSION_SOURCE = Object.freeze({
  INITIAL: 'initial',
  MANUAL: 'manual',
  SENT: 'sent',
  RESENT: 'resent',
  REQUEST_CHANGES: 'request_changes',
  APPROVED: 'approved',
  DECLINED: 'declined',
  CONTENT_EDIT: 'content_edit',
  RESTORED: 'restored',
})

export const VERSION_SOURCES = Object.freeze(Object.values(VERSION_SOURCE))

export const VERSION_REASON = Object.freeze({
  [VERSION_SOURCE.INITIAL]: 'Initial Draft',
  [VERSION_SOURCE.MANUAL]: 'Manual Save',
  [VERSION_SOURCE.SENT]: 'Sent',
  [VERSION_SOURCE.RESENT]: 'Resent',
  [VERSION_SOURCE.REQUEST_CHANGES]: 'Client Requested Changes',
  [VERSION_SOURCE.APPROVED]: 'Approved',
  [VERSION_SOURCE.DECLINED]: 'Declined',
  [VERSION_SOURCE.CONTENT_EDIT]: 'Revised',
  [VERSION_SOURCE.RESTORED]: 'Restored',
})

/**
 * @typedef {object} ProposalSnapshotPricing
 * @property {number} amount
 * @property {string} currency
 */

/**
 * @typedef {object} ProposalSnapshotMetadata
 * @property {string} clientName
 * @property {string} clientEmail
 * @property {string} company
 * @property {string} projectType
 * @property {string[]} tags
 * @property {string | null} validUntil
 * @property {string} status
 * @property {string[]} [serviceIds]
 */

/**
 * @typedef {object} ProposalSnapshot
 * @property {string} title
 * @property {string} description
 * @property {object[]} sections
 * @property {object[]} items
 * @property {ProposalSnapshotPricing} pricing
 * @property {string} terms
 * @property {string} notes
 * @property {ProposalSnapshotMetadata} metadata
 * @property {string} layoutId
 * @property {object[]} blocks
 * @property {object[]} images
 * @property {object | null} questionnaire
 * @property {object[]} uploads
 * @property {object | null} approval
 * @property {object | null} signature
 * @property {object | null} payment
 */

/**
 * @typedef {object} ProposalVersion
 * @property {string} id
 * @property {string} versionId
 * @property {string} proposalId
 * @property {number} versionNumber
 * @property {string} createdAt
 * @property {string} createdBy
 * @property {string} updatedBy
 * @property {string} reason
 * @property {string} source
 * @property {string} status
 * @property {ProposalSnapshot} snapshot
 * @property {number | null} restoredFrom
 */

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function cloneDeep(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function uploadMetadata(uploads = []) {
  return (uploads ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    kind: item.kind,
    storageKey: item.storageKey,
    url: item.url,
    currentVersion: item.currentVersion,
    uploadedBy: item.uploadedBy,
    uploadedByName: item.uploadedByName,
  }))
}

/**
 * @param {Partial<import('./proposal.js').Proposal>} proposal
 * @returns {ProposalSnapshot}
 */
export function snapshotFromProposal(proposal) {
  return cloneDeep({
    title: proposal.title ?? '',
    description: proposal.summary ?? '',
    sections: proposal.sections ?? [],
    items: proposal.items ?? [],
    pricing: {
      amount: Number(proposal.amount ?? 0),
      currency: proposal.currency ?? 'USD',
    },
    terms: proposal.terms ?? '',
    notes: proposal.notes ?? '',
    metadata: {
      clientName: proposal.clientName ?? '',
      clientEmail: proposal.clientEmail ?? '',
      company: proposal.company ?? '',
      projectType: proposal.projectType ?? '',
      tags: proposal.tags ?? [],
      validUntil: proposal.validUntil ?? null,
      status: proposal.status ?? 'draft',
      serviceIds: proposal.serviceIds ?? [],
    },
    layoutId: proposal.layoutId ?? '',
    blocks: proposal.blocks ?? [],
    images: proposal.images ?? [],
    questionnaire: proposal.questionnaire ?? null,
    uploads: uploadMetadata(proposal.uploads),
    approval: proposal.approval ?? null,
    signature: proposal.signature ?? null,
    payment: proposal.payment ?? null,
  })
}

/**
 * Map a snapshot back onto proposal fields. Ids, timestamps and version
 * history are left for the caller so restore can append rather than rewrite.
 *
 * @param {ProposalSnapshot} snapshot
 * @returns {Partial<import('./proposal.js').Proposal>}
 */
export function proposalFieldsFromSnapshot(snapshot) {
  const metadata = snapshot.metadata ?? {}
  const fields = {
    title: snapshot.title ?? '',
    summary: snapshot.description ?? '',
    sections: cloneDeep(snapshot.sections ?? []),
    items: cloneDeep(snapshot.items ?? []),
    amount: Number(snapshot.pricing?.amount ?? 0),
    currency: snapshot.pricing?.currency ?? 'USD',
    terms: snapshot.terms ?? '',
    notes: snapshot.notes ?? '',
    clientName: metadata.clientName ?? '',
    clientEmail: metadata.clientEmail ?? '',
    company: metadata.company ?? '',
    projectType: metadata.projectType,
    tags: cloneDeep(metadata.tags ?? []),
    validUntil: metadata.validUntil ?? null,
    status: metadata.status ?? snapshot.approval?.status ?? 'draft',
  }

  if (Array.isArray(metadata.serviceIds)) {
    fields.serviceIds = cloneDeep(metadata.serviceIds)
  }

  if (snapshot.layoutId) {
    fields.layoutId = snapshot.layoutId
  }

  if (Array.isArray(snapshot.blocks) && snapshot.blocks.length > 0) {
    fields.blocks = cloneDeep(snapshot.blocks)
  }

  if (Array.isArray(snapshot.images)) {
    fields.images = cloneDeep(snapshot.images)
  }

  if (snapshot.questionnaire) {
    fields.questionnaire = cloneDeep(snapshot.questionnaire)
  }

  if (Array.isArray(snapshot.uploads)) {
    fields.uploads = cloneDeep(snapshot.uploads)
  }

  if (snapshot.approval) {
    fields.approval = cloneDeep(snapshot.approval)
  }

  if (snapshot.signature) {
    fields.signature = cloneDeep(snapshot.signature)
  }

  if (snapshot.payment) {
    fields.payment = cloneDeep(snapshot.payment)
  }

  return fields
}

function inferSource(input = {}) {
  if (VERSION_SOURCES.includes(input.source)) return input.source
  if (input.restoredFrom != null) return VERSION_SOURCE.RESTORED
  if (Number(input.versionNumber ?? 1) === 1) return VERSION_SOURCE.INITIAL
  if (input.status === 'accepted') return VERSION_SOURCE.APPROVED
  if (input.status === 'declined') return VERSION_SOURCE.DECLINED
  if (input.status === 'revision_requested') return VERSION_SOURCE.REQUEST_CHANGES
  if (input.status === 'sent') return VERSION_SOURCE.SENT
  return VERSION_SOURCE.MANUAL
}

function normalizeSource(value, input = {}) {
  return VERSION_SOURCES.includes(value) ? value : inferSource(input)
}

function defaultReason(source, restoredFrom) {
  if (source === VERSION_SOURCE.RESTORED && restoredFrom != null) {
    return `Restored from v${restoredFrom}`
  }
  return VERSION_REASON[source] ?? VERSION_REASON[VERSION_SOURCE.MANUAL]
}

/**
 * @param {Partial<ProposalVersion>} [input]
 * @returns {ProposalVersion}
 */
export function makeVersion(input = {}) {
  const id = input.id ?? input.versionId ?? createId('ver')
  const restoredFrom =
    input.restoredFrom === undefined || input.restoredFrom === null
      ? null
      : Number(input.restoredFrom)
  const source = normalizeSource(input.source, input)
  const createdBy = input.createdBy ?? input.updatedBy ?? DEFAULT_UPDATED_BY

  return {
    id,
    versionId: input.versionId ?? id,
    proposalId: input.proposalId ?? '',
    versionNumber: Number(input.versionNumber ?? 1),
    createdAt: input.createdAt ?? new Date().toISOString(),
    createdBy,
    updatedBy: createdBy,
    reason: String(input.reason ?? '').trim() || defaultReason(source, restoredFrom),
    source,
    status: input.status ?? 'draft',
    snapshot: cloneDeep(input.snapshot ?? snapshotFromProposal({})),
    restoredFrom,
  }
}

function lastVersion(versions) {
  if (!versions?.length) return undefined
  return versions.reduce((latest, version) =>
    version.versionNumber > latest.versionNumber ? version : latest,
  )
}

function comparableBlocks(blocks) {
  return (blocks ?? []).map((block) => ({
    id: block.id ?? '',
    type: block.type ?? '',
    enabled: Boolean(block.enabled),
    data: block.data ?? {},
  }))
}

function comparableQuestionnaire(questionnaire) {
  if (!questionnaire) return null
  return {
    status: questionnaire.status ?? '',
    questions: (questionnaire.questions ?? []).map((question) => ({
      id: question.id,
      title: question.title,
      type: question.type,
    })),
    responses: (questionnaire.responses ?? []).map((response) => ({
      questionId: response.questionId,
      value: response.value ?? null,
    })),
  }
}

function comparableSnapshot(snapshot) {
  return {
    title: snapshot.title ?? '',
    description: snapshot.description ?? '',
    sections: (snapshot.sections ?? []).map((section) => ({
      heading: section.heading ?? '',
      body: section.body ?? '',
    })),
    items: (snapshot.items ?? []).map((item) => ({
      description: item.description ?? '',
      amount: Number(item.amount ?? 0),
    })),
    pricing: {
      amount: Number(snapshot.pricing?.amount ?? 0),
      currency: snapshot.pricing?.currency ?? 'USD',
    },
    terms: snapshot.terms ?? '',
    notes: snapshot.notes ?? '',
    metadata: {
      clientName: snapshot.metadata?.clientName ?? '',
      clientEmail: snapshot.metadata?.clientEmail ?? '',
      company: snapshot.metadata?.company ?? '',
      projectType: snapshot.metadata?.projectType ?? '',
      tags: snapshot.metadata?.tags ?? [],
      validUntil: snapshot.metadata?.validUntil ?? null,
      status: snapshot.metadata?.status ?? 'draft',
      serviceIds: snapshot.metadata?.serviceIds ?? [],
    },
    layoutId: snapshot.layoutId ?? '',
    blocks: comparableBlocks(snapshot.blocks),
    questionnaire: comparableQuestionnaire(snapshot.questionnaire),
    uploads: uploadMetadata(snapshot.uploads),
    approval: snapshot.approval?.status ?? '',
    signature: snapshot.signature?.status ?? '',
    payment: {
      status: snapshot.payment?.status ?? '',
      remainingBalance: Number(snapshot.payment?.remainingBalance ?? 0),
    },
  }
}

/**
 * @param {ProposalSnapshot} left
 * @param {ProposalSnapshot} right
 * @returns {boolean}
 */
export function snapshotsEqual(left, right) {
  return JSON.stringify(comparableSnapshot(left)) === JSON.stringify(comparableSnapshot(right))
}

/**
 * Seed Version 1 when a proposal has no history. Existing versions are cloned
 * so callers cannot mutate stored snapshots by reference.
 *
 * @template {import('./proposal.js').Proposal} T
 * @param {T} proposal
 * @returns {T}
 */
export function ensureProposalVersions(proposal) {
  const versions = (proposal.versions ?? []).map((item) =>
    makeVersion({ ...item, proposalId: item.proposalId || proposal.id }),
  )

  if (versions.length === 0) {
    const first = makeVersion({
      proposalId: proposal.id,
      versionNumber: 1,
      createdAt: proposal.createdAt,
      createdBy: DEFAULT_UPDATED_BY,
      source: VERSION_SOURCE.INITIAL,
      reason: VERSION_REASON[VERSION_SOURCE.INITIAL],
      status: proposal.status,
      snapshot: snapshotFromProposal(proposal),
    })

    return {
      ...proposal,
      versions: [first],
      currentVersion: 1,
    }
  }

  const latest = lastVersion(versions)

  return {
    ...proposal,
    versions,
    currentVersion: proposal.currentVersion || latest.versionNumber,
  }
}

function appendVersion(proposal, options = {}) {
  const versions = (proposal.versions ?? []).map(makeVersion)
  const latest = lastVersion(versions)
  const versionNumber = (latest?.versionNumber ?? 0) + 1
  const snapshot = snapshotFromProposal(proposal)
  const source = normalizeSource(options.source)
  const restoredFrom = options.restoredFrom ?? null

  const next = makeVersion({
    proposalId: proposal.id,
    versionNumber,
    createdAt: options.createdAt ?? proposal.updatedAt ?? new Date().toISOString(),
    createdBy: options.createdBy ?? options.updatedBy ?? DEFAULT_UPDATED_BY,
    source,
    reason: options.reason,
    status: proposal.status,
    snapshot,
    restoredFrom,
  })

  return {
    ...proposal,
    versions: [...versions, next],
    currentVersion: versionNumber,
  }
}

/**
 * Append a version after a save, unless the document is identical to the last
 * snapshot. Typing and local autosaves never reach this function.
 *
 * @param {import('./proposal.js').Proposal} proposal
 * @param {{ updatedBy?: string, createdBy?: string, source?: string, reason?: string, force?: boolean }} [options]
 * @returns {import('./proposal.js').Proposal}
 */
export function recordSaveVersion(proposal, options = {}) {
  const ensured = ensureProposalVersions(proposal)
  const latest = lastVersion(ensured.versions)
  const snapshot = snapshotFromProposal(ensured)

  if (!options.force && latest && snapshotsEqual(latest.snapshot, snapshot)) {
    return ensured
  }

  return appendVersion(ensured, {
    ...options,
    source: options.source ?? VERSION_SOURCE.MANUAL,
  })
}

/**
 * Always append a milestone version (sent, approved, declined, restore, …).
 *
 * @param {import('./proposal.js').Proposal} proposal
 * @param {{ source: string, reason?: string, createdBy?: string, updatedBy?: string, restoredFrom?: number | null }} options
 */
export function recordMilestoneVersion(proposal, options) {
  return appendVersion(ensureProposalVersions(proposal), options)
}

/**
 * Append a restored snapshot as a new latest version. Older versions stay.
 *
 * @param {import('./proposal.js').Proposal} proposal
 * @param {{ restoredFrom: number, updatedBy?: string, createdBy?: string }} options
 * @returns {import('./proposal.js').Proposal}
 */
export function recordRestoreVersion(proposal, options) {
  return recordMilestoneVersion(proposal, {
    source: VERSION_SOURCE.RESTORED,
    restoredFrom: options.restoredFrom,
    createdBy: options.createdBy ?? options.updatedBy,
    updatedBy: options.updatedBy,
    reason: `Restored from v${options.restoredFrom}`,
  })
}

function addedById(fromList, toList) {
  const known = new Set((fromList ?? []).map((item) => item.id).filter(Boolean))
  return (toList ?? []).filter((item) => item.id && !known.has(item.id))
}

/**
 * @param {ProposalSnapshot} current
 * @param {ProposalSnapshot} selected
 */
export function diffSnapshots(current, selected) {
  const left = comparableSnapshot(current)
  const right = comparableSnapshot(selected)

  function changed(key) {
    return JSON.stringify(left[key]) !== JSON.stringify(right[key])
  }

  return [
    {
      key: 'title',
      label: 'Title',
      current: left.title,
      selected: right.title,
      changed: changed('title'),
    },
    {
      key: 'description',
      label: 'Description',
      current: left.description,
      selected: right.description,
      changed: changed('description'),
    },
    {
      key: 'status',
      label: 'Status',
      current: left.metadata.status,
      selected: right.metadata.status,
      changed: left.metadata.status !== right.metadata.status,
    },
    {
      key: 'sections',
      label: 'Sections',
      current: left.sections,
      selected: right.sections,
      changed: changed('sections'),
    },
    {
      key: 'items',
      label: 'Items',
      current: left.items,
      selected: right.items,
      changed: changed('items'),
    },
    {
      key: 'pricing',
      label: 'Pricing',
      current: left.pricing,
      selected: right.pricing,
      changed: changed('pricing'),
    },
    {
      key: 'blocks',
      label: 'Content blocks',
      current: left.blocks,
      selected: right.blocks,
      changed: changed('blocks'),
    },
    {
      key: 'blocksAdded',
      label: 'Added blocks',
      current: [],
      selected: addedById(left.blocks, right.blocks),
      changed: addedById(left.blocks, right.blocks).length > 0,
    },
    {
      key: 'blocksRemoved',
      label: 'Removed blocks',
      current: addedById(right.blocks, left.blocks),
      selected: [],
      changed: addedById(right.blocks, left.blocks).length > 0,
    },
    {
      key: 'questionnaire',
      label: 'Questionnaire',
      current: left.questionnaire,
      selected: right.questionnaire,
      changed: changed('questionnaire'),
    },
    {
      key: 'responses',
      label: 'Client responses',
      current: left.questionnaire?.responses ?? [],
      selected: right.questionnaire?.responses ?? [],
      changed:
        JSON.stringify(left.questionnaire?.responses ?? []) !==
        JSON.stringify(right.questionnaire?.responses ?? []),
    },
    {
      key: 'uploads',
      label: 'Files',
      current: left.uploads,
      selected: right.uploads,
      changed: changed('uploads'),
    },
    {
      key: 'filesAdded',
      label: 'Files added',
      current: [],
      selected: addedById(left.uploads, right.uploads),
      changed: addedById(left.uploads, right.uploads).length > 0,
    },
    {
      key: 'filesRemoved',
      label: 'Files removed',
      current: addedById(right.uploads, left.uploads),
      selected: [],
      changed: addedById(right.uploads, left.uploads).length > 0,
    },
    {
      key: 'terms',
      label: 'Terms',
      current: left.terms,
      selected: right.terms,
      changed: changed('terms'),
    },
    {
      key: 'notes',
      label: 'Notes',
      current: left.notes,
      selected: right.notes,
      changed: changed('notes'),
    },
    {
      key: 'layout',
      label: 'Layout',
      current: left.layoutId,
      selected: right.layoutId,
      changed: changed('layoutId'),
    },
  ]
}

/**
 * @param {ProposalVersion[]} versions
 * @returns {number}
 */
export function latestVersionNumber(versions) {
  return lastVersion(versions)?.versionNumber ?? 0
}

export function versionLabel(version) {
  const number = version?.versionNumber ?? 0
  const reason = version?.reason || VERSION_REASON[version?.source] || 'Version'
  return `v${number} ${reason}`
}

export function findVersion(versions, versionId) {
  return (versions ?? []).find(
    (item) => item.versionId === versionId || item.id === versionId,
  )
}
