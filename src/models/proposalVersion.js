/**
 * Proposal version history.
 *
 * Versions are stored on the proposal itself. Each snapshot is a deep copy of
 * the document at save time, so later edits cannot mutate past versions.
 */

export const DEFAULT_UPDATED_BY = 'Studio'

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
 * @property {import('./proposal.js').ProposalSection[]} sections
 * @property {import('./proposal.js').ProposalLineItem[]} items
 * @property {ProposalSnapshotPricing} pricing
 * @property {string} terms
 * @property {string} notes
 * @property {ProposalSnapshotMetadata} metadata
 * @property {string} layoutId
 * @property {import('../blocks/instance.js').BlockInstance[]} blocks
 * @property {object[]} images
 */

/**
 * @typedef {object} ProposalVersion
 * @property {string} versionId
 * @property {number} versionNumber
 * @property {string} createdAt
 * @property {string} updatedBy
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
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
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
    status: metadata.status ?? 'draft',
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

  return fields
}

/**
 * @param {Partial<ProposalVersion>} [input]
 * @returns {ProposalVersion}
 */
export function makeVersion(input = {}) {
  return {
    versionId: input.versionId ?? createId('ver'),
    versionNumber: Number(input.versionNumber ?? 1),
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedBy: input.updatedBy ?? DEFAULT_UPDATED_BY,
    status: input.status ?? 'draft',
    snapshot: cloneDeep(input.snapshot ?? snapshotFromProposal({})),
    restoredFrom:
      input.restoredFrom === undefined || input.restoredFrom === null
        ? null
        : Number(input.restoredFrom),
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
    type: block.type ?? '',
    enabled: Boolean(block.enabled),
    data: block.data ?? {},
  }))
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
  const versions = (proposal.versions ?? []).map(makeVersion)

  if (versions.length === 0) {
    const first = makeVersion({
      versionNumber: 1,
      createdAt: proposal.createdAt,
      updatedBy: DEFAULT_UPDATED_BY,
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

  const next = makeVersion({
    versionNumber,
    createdAt: proposal.updatedAt ?? new Date().toISOString(),
    updatedBy: options.updatedBy ?? DEFAULT_UPDATED_BY,
    status: proposal.status,
    snapshot,
    restoredFrom: options.restoredFrom ?? null,
  })

  return {
    ...proposal,
    versions: [...versions, next],
    currentVersion: versionNumber,
  }
}

/**
 * Append a version after a save, unless the document is identical to the last
 * snapshot.
 *
 * @param {import('./proposal.js').Proposal} proposal
 * @param {{ updatedBy?: string }} [options]
 * @returns {import('./proposal.js').Proposal}
 */
export function recordSaveVersion(proposal, options = {}) {
  const ensured = ensureProposalVersions(proposal)
  const latest = lastVersion(ensured.versions)
  const snapshot = snapshotFromProposal(ensured)

  if (latest && snapshotsEqual(latest.snapshot, snapshot)) {
    return ensured
  }

  return appendVersion(ensured, options)
}

/**
 * Append a restored snapshot as a new latest version. Older versions stay.
 *
 * @param {import('./proposal.js').Proposal} proposal
 * @param {{ restoredFrom: number, updatedBy?: string }} options
 * @returns {import('./proposal.js').Proposal}
 */
export function recordRestoreVersion(proposal, options) {
  return appendVersion(ensureProposalVersions(proposal), {
    updatedBy: options.updatedBy,
    restoredFrom: options.restoredFrom,
  })
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
    {
      key: 'blocks',
      label: 'Content blocks',
      current: left.blocks,
      selected: right.blocks,
      changed: changed('blocks'),
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
