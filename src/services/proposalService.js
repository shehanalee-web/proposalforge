import {
  DEFAULT_CURRENCY,
  DISPLAY_STATUS,
  PROPOSAL_STATUS,
  PROPOSAL_STATUSES,
  canClientRespond,
  getDisplayStatus,
  makeProposal,
  validateProposal,
} from '../models/proposal.js'
import {
  proposalFieldsFromSnapshot,
  recordRestoreVersion,
  recordSaveVersion,
} from '../models/proposalVersion.js'
import { NotFoundError, ValidationError, ForbiddenError } from './errors.js'
import { prepareProposalAssets } from './hydrateAssets.js'
import * as store from './proposalStore.js'
import {
  isQuestionnaireSubmitted,
  makeQuestionnaire,
  QUESTIONNAIRE_STATUS,
} from '../models/questionnaire.js'
import { validateQuestionnaire } from '../forms/validate.js'
import {
  appendActivity,
  CLIENT_ACTIVITY_TYPE,
  hasActivityType,
  makeActivityEvent,
} from '../models/clientActivity.js'
import {
  canEditComment,
  COMMENT_AUTHOR,
  COMMENT_VISIBILITY,
  commentMessageError,
  isClientVisibleComment,
  makeComment,
  normalizeCommentMessage,
  STUDIO_AUTHOR_NAME,
} from '../models/comment.js'
import { PORTAL_ACTOR } from '../models/portalPermissions.js'
import { scheduleCollaborationNotice } from '../collaboration/notify.js'
import {
  findComment,
  findThreadRoot,
  resolveReplyParentId,
} from '../collaboration/threads.js'
import { isPastValidUntil, isProposalLocked, canMutateClientFiles, makeProposalApproval } from '../models/approval.js'
import {
  isAllowedProposalUpload,
  makeProposalUpload,
  makeUploadVersion,
  PROPOSAL_UPLOAD_MAX_BYTES,
  UPLOAD_ACTOR,
} from '../models/upload.js'
import { createRecordId } from '../models/ids.js'
import { getStorageAdapter } from '../storage/adapter.js'
import { makeProposalSignature, SIGNATURE_STATUS } from '../models/signature.js'
import { makeProposalPayment } from '../models/payment.js'

/**
 * Public data access layer for proposals.
 *
 * Every function is async and returns plain data, so swapping the in-memory
 * store for HTTP calls later is a change inside this file only — no call site
 * in the app needs to be touched.
 */

/** Simulated network delay, so loading states can be built and tested. */
export const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function boot() {
  await store.ready()
  await delay()
}

function present(proposal) {
  return prepareProposalAssets(proposal)
}

export const SORTABLE_FIELDS = Object.freeze([
  'updatedAt',
  'createdAt',
  'title',
  'amount',
  'status',
])

function matchesSearch(proposal, term) {
  const query = term.trim().toLowerCase()

  if (!query) return true

  return [
    proposal.title,
    proposal.clientName,
    proposal.company,
    proposal.summary,
  ].some((field) => field.toLowerCase().includes(query))
}

function compareBy(field, order) {
  const direction = order === 'asc' ? 1 : -1

  return (a, b) => {
    const left = a[field]
    const right = b[field]

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction
    }

    return String(left).localeCompare(String(right)) * direction
  }
}

/**
 * @typedef {object} ListOptions
 * @property {string} [status]    Filter to a single status.
 * @property {string} [search]    Case-insensitive text match.
 * @property {string} [sortBy]    One of SORTABLE_FIELDS. Defaults to updatedAt.
 * @property {'asc'|'desc'} [sortOrder] Defaults to desc.
 * @property {number} [page]      1-based page number. Omit for no pagination.
 * @property {number} [pageSize]  Items per page. Omit for no pagination.
 */

/**
 * Fetch proposals with optional filtering, sorting and pagination.
 *
 * Returns an envelope rather than a bare array so that adding pagination to a
 * screen later does not change this function's contract.
 *
 * @param {ListOptions} [options]
 * @returns {Promise<{ items: import('../models/proposal.js').Proposal[], total: number }>}
 */
export async function fetchProposals(options = {}) {
  const {
    status,
    search = '',
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    page,
    pageSize,
  } = options

  await boot()

  let items = store.all()

  if (status === DISPLAY_STATUS.VIEWED) {
    items = items.filter(
      (proposal) => getDisplayStatus(proposal) === DISPLAY_STATUS.VIEWED,
    )
  } else if (status) {
    items = items.filter((proposal) => proposal.status === status)
  }

  if (search) {
    items = items.filter((proposal) => matchesSearch(proposal, search))
  }

  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'updatedAt'
  items.sort(compareBy(field, sortOrder))

  const total = items.length

  if (page && pageSize) {
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)
  }

  return { items: await Promise.all(items.map(present)), total }
}

/**
 * Fetch one proposal by id.
 *
 * @param {string} id
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError}
 */
export async function fetchProposalById(id) {
  await boot()

  const proposal = store.findById(id)

  if (!proposal) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  return present(await persistExpired(proposal))
}

/**
 * Create a proposal from partial input.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} input
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {ValidationError}
 */
export async function createProposal(input) {
  const proposal = makeProposal(input)
  const prepared = makeProposal({
    ...proposal,
    activity: recordActivity(proposal, {
      type: CLIENT_ACTIVITY_TYPE.PREPARED,
      actor: PORTAL_ACTOR.STUDIO,
      metadata: {
        visibility: COMMENT_VISIBILITY.CLIENT,
        detail: proposal.title
          ? `“${proposal.title}” was prepared.`
          : 'Proposal prepared.',
      },
    }),
  })
  const errors = validateProposal(prepared)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  await boot()

  return present(await store.insert(prepared))
}

/**
 * Apply a partial update to an existing proposal.
 *
 * `id`, `createdAt` and version history are preserved. A new version is
 * recorded only when the document changed since the last save.
 *
 * @param {string} id
 * @param {Partial<import('../models/proposal.js').Proposal>} changes
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function updateProposal(id, changes = {}) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const safeChanges = { ...changes }
  delete safeChanges.versions
  delete safeChanges.currentVersion
  delete safeChanges.id
  delete safeChanges.createdAt

  const updated = makeProposal({
    ...existing,
    ...safeChanges,
    id: existing.id,
    createdAt: existing.createdAt,
    versions: existing.versions,
    currentVersion: existing.currentVersion,
    shareToken: existing.shareToken,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  const recorded = recordSaveVersion(updated)

  await boot()

  return present(await store.replace(id, recorded))
}

/**
 * Re-apply a past snapshot as a new latest version. Older versions are kept.
 *
 * @param {string} id
 * @param {string} versionId
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError}
 */
export async function restoreProposalVersion(id, versionId) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const source = (existing.versions ?? []).find(
    (version) => version.versionId === versionId,
  )

  if (!source) {
    throw new NotFoundError(`No version found with id "${versionId}".`)
  }

  const restored = makeProposal({
    ...existing,
    ...proposalFieldsFromSnapshot(source.snapshot),
    id: existing.id,
    createdAt: existing.createdAt,
    versions: existing.versions,
    currentVersion: existing.currentVersion,
    shareToken: existing.shareToken,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateProposal(restored)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  const recorded = recordRestoreVersion(restored, {
    restoredFrom: source.versionNumber,
  })

  await boot()

  return present(await store.replace(id, recorded))
}

/**
 * Delete a proposal.
 *
 * @param {string} id
 * @returns {Promise<{ id: string }>}
 * @throws {NotFoundError}
 */
export async function deleteProposal(id) {
  await boot()

  const deleted = await store.remove(id)

  if (!deleted) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  return { id }
}

/**
 * @typedef {object} ProposalSummary
 * @property {number} total            Proposal count.
 * @property {number} pipelineValue    Value of proposals awaiting a decision.
 * @property {number} wonValue         Value of accepted proposals.
 * @property {number | null} acceptanceRate Accepted share of decided proposals,
 *   between 0 and 1. Null when nothing has been decided yet, which is distinct
 *   from a genuine zero percent.
 * @property {Record<string, number>} statusCounts Count per status.
 * @property {string} currency         Currency the totals are expressed in.
 * @property {number} versionCount     Saved snapshots across every proposal.
 */

/**
 * Aggregate figures across all proposals.
 *
 * Deliberately a separate call rather than something the UI derives from a
 * fetched list: totals must cover every record, so a paginated list could not
 * produce them correctly, and a real backend would answer this from a single
 * summary endpoint instead of sending every proposal to the browser.
 *
 * @returns {Promise<ProposalSummary>}
 */
export async function fetchProposalSummary() {
  await boot()

  const records = store.all()

  const statusCounts = Object.fromEntries(
    PROPOSAL_STATUSES.map((status) => [status, 0]),
  )

  let pipelineValue = 0
  let wonValue = 0
  let versionCount = 0

  for (const record of records) {
    versionCount += record.versions?.length ?? 0

    if (record.status in statusCounts) {
      statusCounts[record.status] += 1
    }

    if (
      record.status === PROPOSAL_STATUS.SENT ||
      record.status === PROPOSAL_STATUS.REVISION_REQUESTED
    ) {
      pipelineValue += record.amount
    }

    if (record.status === PROPOSAL_STATUS.ACCEPTED) {
      wonValue += record.amount
    }
  }

  const decided =
    statusCounts[PROPOSAL_STATUS.ACCEPTED] +
    statusCounts[PROPOSAL_STATUS.DECLINED]

  return {
    total: records.length,
    pipelineValue,
    wonValue,
    acceptanceRate:
      decided > 0 ? statusCounts[PROPOSAL_STATUS.ACCEPTED] / decided : null,
    statusCounts,
    currency: DEFAULT_CURRENCY,
    versionCount,
  }
}

function persistIdentity(existing, changes, timestamp) {
  return makeProposal({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    shareToken: existing.shareToken,
    versions: existing.versions,
    currentVersion: existing.currentVersion,
    updatedAt: timestamp,
  })
}

function recordActivity(existing, input) {
  const event = makeActivityEvent({
    ...input,
    proposalId: existing.id,
    derived: false,
  })
  scheduleCollaborationNotice(event)
  return appendActivity(existing, event)
}

function requireOpenProposal(existing, action) {
  if (isProposalLocked(existing)) {
    throw new ValidationError(`This proposal is locked.`, [
      { field: 'status', message: `Locked proposals cannot ${action}.` },
    ])
  }
}

function addCommentRecord(existing, input) {
  const messageError = commentMessageError(input.message)
  if (messageError) {
    throw new ValidationError(messageError, [
      { field: 'message', message: messageError },
    ])
  }

  const parentId = resolveReplyParentId(existing.comments, input.parentId)
  if (input.parentId && !parentId) {
    throw new NotFoundError('That conversation is no longer available.')
  }

  if (parentId && input.authorType === COMMENT_AUTHOR.CLIENT) {
    const root = findThreadRoot(existing.comments, parentId)
    if (!root || !isClientVisibleComment(root)) {
      throw new NotFoundError('That conversation is no longer available.')
    }
  }

  const comment = makeComment({
    proposalId: existing.id,
    parentId,
    authorType: input.authorType,
    authorName: input.authorName,
    message: input.message,
    visibility: input.visibility,
    sectionId: input.sectionId,
    sectionTitle: input.sectionTitle,
  })

  const comments = [...(existing.comments ?? []), comment]
  const activity = recordActivity(existing, {
    type: parentId ? CLIENT_ACTIVITY_TYPE.REPLIED : CLIENT_ACTIVITY_TYPE.COMMENTED,
    actor:
      comment.authorType === COMMENT_AUTHOR.CLIENT
        ? PORTAL_ACTOR.CLIENT
        : PORTAL_ACTOR.STUDIO,
    metadata: {
      visibility:
        comment.visibility === COMMENT_VISIBILITY.INTERNAL
          ? COMMENT_VISIBILITY.INTERNAL
          : COMMENT_VISIBILITY.CLIENT,
      commentId: comment.id,
      parentId,
      detail: comment.message,
      sectionId: comment.sectionId,
      sectionTitle: comment.sectionTitle,
    },
  })

  return persistIdentity(
    existing,
    { comments, activity },
    new Date().toISOString(),
  )
}

function requireById(id) {
  const existing = store.findById(id)
  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }
  return existing
}

function expireIfNeeded(existing) {
  if (
    existing.status !== PROPOSAL_STATUS.SENT ||
    !isPastValidUntil(existing.validUntil)
  ) {
    return existing
  }

  const now = new Date().toISOString()
  return persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.EXPIRED,
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.EXPIRED,
          decidedAt: now,
          summary: 'This proposal expired.',
          locked: true,
        },
        { ...existing, status: PROPOSAL_STATUS.EXPIRED },
      ),
    },
    now,
  )
}

async function persistExpired(existing) {
  const next = expireIfNeeded(existing)
  if (next === existing) return existing
  return store.replace(existing.id, next)
}

function validateUploadFile(file) {
  const name = file?.name || 'file'
  if (!isAllowedProposalUpload(name)) {
    throw new ValidationError('That file type is not allowed on this proposal.', [
      { field: 'file', message: 'Choose a supported reference file.' },
    ])
  }
  if (Number(file.size ?? 0) > PROPOSAL_UPLOAD_MAX_BYTES) {
    throw new ValidationError('That file is too large.', [
      { field: 'file', message: 'Files must be 48 MB or smaller.' },
    ])
  }
}

async function storeUploadBytes(proposal, file, uploadId) {
  validateUploadFile(file)
  const adapter = getStorageAdapter()
  return adapter.put({
    proposalId: proposal.id,
    uploadId,
    file,
  })
}

function requireByShareToken(token) {
  if (!token) {
    throw new NotFoundError('No proposal found for this client link.')
  }

  const proposal = store.findByShareToken(token)

  if (!proposal) {
    throw new NotFoundError('No proposal found for this client link.')
  }

  return proposal
}

/**
 * Load a proposal for the client portal and record that it was viewed.
 *
 * Viewing does not change `updatedAt`, so a client opening the link does not
 * shuffle studio sort order. Version snapshots stay untouched.
 *
 * @param {string} token
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError}
 */
export async function fetchClientProposal(token) {
  await boot()

  const existing = requireByShareToken(token)
  const current = await persistExpired(existing)
  const now = new Date().toISOString()
  const changes = { lastViewedAt: now }
  let activity = current.activity

  if (
    current.status !== PROPOSAL_STATUS.DRAFT &&
    !hasActivityType(current, CLIENT_ACTIVITY_TYPE.SENT)
  ) {
    activity = recordActivity(
      { ...current, activity },
      {
        type: CLIENT_ACTIVITY_TYPE.SENT,
        actor: PORTAL_ACTOR.STUDIO,
        createdAt: current.createdAt,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: current.clientName
            ? `Shared with ${current.clientName}.`
            : 'Shared with the client.',
        },
      },
    )
  }

  if (!hasActivityType({ ...current, activity }, CLIENT_ACTIVITY_TYPE.VIEWED)) {
    activity = recordActivity(
      { ...current, activity },
      {
        type: CLIENT_ACTIVITY_TYPE.VIEWED,
        actor: PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'Opened from the client link.',
        },
      },
    )
  }

  if (activity !== current.activity) {
    changes.activity = activity
  }

  const viewed = persistIdentity(current, changes, current.updatedAt)

  return present(await store.replace(current.id, viewed))
}

/**
 * Accept a proposal from the client portal.
 *
 * @param {string} token
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function acceptProposal(token) {
  await boot()

  const existing = requireByShareToken(token)

  if (existing.status === PROPOSAL_STATUS.ACCEPTED) {
    return present(existing)
  }

  if (existing.status === PROPOSAL_STATUS.DECLINED) {
    throw new ValidationError('This proposal can no longer be accepted.', [
      { field: 'status', message: 'Declined proposals cannot be accepted.' },
    ])
  }

  requireOpenProposal(existing, 'be approved')

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.ACCEPTED,
      acceptedAt: now,
      lastViewedAt: existing.lastViewedAt ?? now,
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.ACCEPTED,
          decidedAt: now,
          actor: PORTAL_ACTOR.CLIENT,
          summary: 'The client approved this proposal.',
          locked: true,
        },
        { ...existing, status: PROPOSAL_STATUS.ACCEPTED, acceptedAt: now },
      ),
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.ACCEPTED,
        actor: PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'The proposal was approved.',
        },
      }),
    },
    now,
  )

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  return present(await store.replace(existing.id, updated))
}

/**
 * Save client feedback and mark the proposal as needing a revision.
 *
 * Accepts a message string or `{ message, sectionId, sectionTitle }`.
 *
 * @param {string} token
 * @param {string | { message?: string, sectionId?: string, sectionTitle?: string }} comment
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function requestProposalChanges(token, comment) {
  const payload = typeof comment === 'string' ? { message: comment } : (comment ?? {})
  const feedback = normalizeCommentMessage(payload.message)

  if (!feedback) {
    throw new ValidationError('Please add a comment so the studio knows what to change.', [
      { field: 'message', message: 'A comment is required.' },
    ])
  }

  const messageError = commentMessageError(feedback)
  if (messageError) {
    throw new ValidationError(messageError, [
      { field: 'message', message: messageError },
    ])
  }

  await boot()

  const existing = requireByShareToken(token)
  requireOpenProposal(existing, 'request changes')

  const now = new Date().toISOString()
  const requestComment = makeComment({
    proposalId: existing.id,
    authorType: COMMENT_AUTHOR.CLIENT,
    authorName: existing.clientName || 'Client',
    message: feedback,
    visibility: COMMENT_VISIBILITY.CLIENT,
    sectionId: payload.sectionId ?? null,
    sectionTitle: payload.sectionTitle ?? '',
  })
  const comments = [...(existing.comments ?? []), requestComment]
  const activity = recordActivity(existing, {
    type: CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED,
    actor: PORTAL_ACTOR.CLIENT,
    metadata: {
      visibility: COMMENT_VISIBILITY.CLIENT,
      commentId: requestComment.id,
      detail: feedback,
      sectionId: requestComment.sectionId,
      sectionTitle: requestComment.sectionTitle,
    },
  })
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.REVISION_REQUESTED,
      clientFeedback: feedback,
      lastViewedAt: existing.lastViewedAt ?? now,
      comments,
      activity,
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.REVISION_REQUESTED,
          summary: feedback,
          locked: false,
        },
        { ...existing, status: PROPOSAL_STATUS.REVISION_REQUESTED },
      ),
    },
    now,
  )

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  return present(await store.replace(existing.id, updated))
}

/**
 * Autosave client answers. Does not rewrite questions on a frozen copy and
 * does not bump proposal `updatedAt`, so a draft answer does not reshuffle
 * the studio list.
 */
export async function saveQuestionnaireResponses(token, responses) {
  await boot()
  const existing = requireByShareToken(token)

  if (!existing.questionnaire) {
    throw new NotFoundError('This proposal has no questionnaire.')
  }

  if (isProposalLocked(existing)) {
    throw new ForbiddenError('This proposal is locked.')
  }

  if (isQuestionnaireSubmitted(existing.questionnaire)) {
    throw new ForbiddenError('Submitted answers cannot be changed.')
  }

  const questionnaire = makeQuestionnaire({
    ...existing.questionnaire,
    questions: existing.questionnaire.questions,
    responses,
    status: QUESTIONNAIRE_STATUS.IN_PROGRESS,
    frozen: true,
    proposalId: existing.id,
  })

  const changes = { questionnaire }
  if (!hasActivityType(existing, CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED)) {
    changes.activity = recordActivity(existing, {
      type: CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED,
      actor: PORTAL_ACTOR.CLIENT,
      metadata: {
        visibility: COMMENT_VISIBILITY.CLIENT,
        detail: 'Discovery questionnaire started.',
      },
    })
  }

  const updated = persistIdentity(
    existing,
    changes,
    existing.updatedAt,
  )

  return present(await store.replace(existing.id, updated))
}

/**
 * Lock the questionnaire after validation. Questions stay frozen.
 */
export async function submitQuestionnaireResponses(token) {
  await boot()
  const existing = requireByShareToken(token)

  if (!existing.questionnaire) {
    throw new NotFoundError('This proposal has no questionnaire.')
  }

  if (isProposalLocked(existing)) {
    throw new ForbiddenError('This proposal is locked.')
  }

  if (isQuestionnaireSubmitted(existing.questionnaire)) {
    return present(existing)
  }

  const errors = validateQuestionnaire(existing.questionnaire)
  if (errors.length > 0) {
    throw new ValidationError('Please complete the required questions.', errors)
  }

  const now = new Date().toISOString()
  const questionnaire = makeQuestionnaire({
    ...existing.questionnaire,
    questions: existing.questionnaire.questions,
    status: QUESTIONNAIRE_STATUS.SUBMITTED,
    submittedAt: now,
    frozen: true,
    proposalId: existing.id,
  })

  let activity = existing.activity
  if (!hasActivityType(existing, CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED)) {
    activity = recordActivity(
      { ...existing, activity },
      {
        type: CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_STARTED,
        actor: PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'Discovery questionnaire started.',
        },
      },
    )
  }
  activity = recordActivity(
    { ...existing, activity },
    {
      type: CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED,
      actor: PORTAL_ACTOR.CLIENT,
      metadata: {
        visibility: COMMENT_VISIBILITY.CLIENT,
        detail: 'Discovery questionnaire submitted.',
      },
    },
  )

  const updated = persistIdentity(
    existing,
    { questionnaire, activity },
    now,
  )

  return present(await store.replace(existing.id, updated))
}

/**
 * Client comment. Always client-visible. Never writes internal notes.
 *
 * @param {string} token
 * @param {{ message: string, parentId?: string | null }} input
 */
export async function addClientComment(token, input = {}) {
  await boot()
  const existing = requireByShareToken(token)

  if (!canClientRespond(existing)) {
    throw new ForbiddenError('Comments are closed on this proposal.')
  }

  const updated = addCommentRecord(existing, {
    message: input.message,
    parentId: input.parentId ?? null,
    authorType: COMMENT_AUTHOR.CLIENT,
    authorName: existing.clientName || 'Client',
    visibility: COMMENT_VISIBILITY.CLIENT,
  })

  return present(await store.replace(existing.id, updated))
}

/**
 * Studio comment. May be client-visible or an internal note.
 *
 * @param {string} id
 * @param {{ message: string, parentId?: string | null, visibility?: string, authorName?: string }} input
 */
export async function addStudioComment(id, input = {}) {
  await boot()
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const visibility =
    input.visibility === COMMENT_VISIBILITY.INTERNAL
      ? COMMENT_VISIBILITY.INTERNAL
      : COMMENT_VISIBILITY.CLIENT

  const updated = addCommentRecord(existing, {
    message: input.message,
    parentId: input.parentId ?? null,
    authorType: COMMENT_AUTHOR.INTERNAL,
    authorName: input.authorName || STUDIO_AUTHOR_NAME,
    visibility,
  })

  return present(await store.replace(existing.id, updated))
}

/**
 * Client edit of a recent comment they authored.
 *
 * @param {string} token
 * @param {string} commentId
 * @param {string} message
 */
export async function editClientComment(token, commentId, message) {
  await boot()
  const existing = requireByShareToken(token)
  const comment = findComment(existing.comments, commentId)

  if (
    !comment ||
    comment.authorType !== COMMENT_AUTHOR.CLIENT ||
    !isClientVisibleComment(comment)
  ) {
    throw new NotFoundError('Comment not found.')
  }

  if (!canEditComment(comment, { authorType: COMMENT_AUTHOR.CLIENT })) {
    throw new ForbiddenError('That comment can no longer be edited.')
  }

  const messageError = commentMessageError(message)
  if (messageError) {
    throw new ValidationError(messageError, [
      { field: 'message', message: messageError },
    ])
  }

  const now = new Date().toISOString()
  const comments = (existing.comments ?? []).map((item) =>
    item.id === commentId
      ? makeComment({
          ...item,
          message,
          editedAt: now,
        })
      : item,
  )

  const updated = persistIdentity(existing, { comments }, now)
  return present(await store.replace(existing.id, updated))
}

/**
 * Resolve or reopen a conversation. Clients may only resolve client-visible
 * threads. Studio may resolve and reopen any thread.
 *
 * @param {string} id
 * @param {string} commentId
 * @param {boolean} resolved
 */
export async function setProposalThreadResolved(id, commentId, resolved) {
  await boot()
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const root = findThreadRoot(existing.comments, commentId)
  if (!root) {
    throw new NotFoundError('That conversation is no longer available.')
  }

  const comments = (existing.comments ?? []).map((item) =>
    item.id === root.id ? makeComment({ ...item, resolved: Boolean(resolved) }) : item,
  )
  const updated = persistIdentity(
    existing,
    { comments },
    new Date().toISOString(),
  )
  return present(await store.replace(existing.id, updated))
}

/**
 * Client resolve. Cannot reopen.
 *
 * @param {string} token
 * @param {string} commentId
 */
export async function resolveClientThread(token, commentId) {
  await boot()
  const existing = requireByShareToken(token)
  const root = findThreadRoot(existing.comments, commentId)

  if (!root || !isClientVisibleComment(root)) {
    throw new NotFoundError('That conversation is no longer available.')
  }

  if (root.resolved) {
    return present(existing)
  }

  const comments = (existing.comments ?? []).map((item) =>
    item.id === root.id ? makeComment({ ...item, resolved: true }) : item,
  )
  const updated = persistIdentity(
    existing,
    { comments },
    new Date().toISOString(),
  )
  return present(await store.replace(existing.id, updated))
}

/**
 * Decline a proposal from the client portal. Records a timeline event.
 *
 * @param {string} token
 */
export async function declineProposal(token, input = {}) {
  await boot()
  const existing = requireByShareToken(token)

  if (existing.status === PROPOSAL_STATUS.DECLINED) {
    return present(existing)
  }

  if (existing.status === PROPOSAL_STATUS.ACCEPTED) {
    throw new ValidationError('This proposal has already been accepted.', [
      { field: 'status', message: 'Accepted proposals cannot be declined.' },
    ])
  }

  requireOpenProposal(existing, 'be declined')

  const now = new Date().toISOString()
  const reason = typeof input === 'string' ? input.trim() : String(input?.message ?? '').trim()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.DECLINED,
      lastViewedAt: existing.lastViewedAt ?? now,
      clientFeedback: reason || existing.clientFeedback,
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.DECLINED,
          decidedAt: now,
          actor: PORTAL_ACTOR.CLIENT,
          summary: reason || 'The client declined this proposal.',
          locked: true,
        },
        { ...existing, status: PROPOSAL_STATUS.DECLINED },
      ),
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.DECLINED,
        actor: PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: reason || 'The proposal was declined.',
        },
      }),
    },
    now,
  )

  const errors = validateProposal(updated)
  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  return present(await store.replace(existing.id, updated))
}

function requireMutableFiles(existing) {
  if (!canMutateClientFiles(existing)) {
    throw new ForbiddenError('Files cannot be changed after this proposal is locked.')
  }
}

/**
 * Attach a proposal-scoped file. Bytes go through the storage adapter;
 * metadata is stored on the proposal.
 */
export async function addProposalUpload(id, file, options = {}) {
  await boot()
  const existing = requireById(id)
  requireMutableFiles(existing)

  const uploadId = createRecordId('upl')
  const stored = await storeUploadBytes(existing, file, uploadId)
  const now = new Date().toISOString()
  const studio = options.actor === UPLOAD_ACTOR.STUDIO
  const upload = makeProposalUpload({
    id: uploadId,
    proposalId: existing.id,
    name: file.name,
    mimeType: stored.mimeType || file.type || '',
    sizeBytes: stored.sizeBytes ?? file.size ?? 0,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
    url: stored.url,
    uploadedBy: studio ? UPLOAD_ACTOR.STUDIO : UPLOAD_ACTOR.CLIENT,
    uploadedByName:
      options.actorName ||
      (studio ? 'Studio' : existing.clientName || 'Client'),
    createdAt: now,
    updatedAt: now,
  })
  const updated = persistIdentity(
    existing,
    {
      uploads: [...(existing.uploads ?? []), upload],
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.FILE_UPLOADED,
        actor: studio ? PORTAL_ACTOR.STUDIO : PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: upload.name,
          uploadId: upload.id,
        },
      }),
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

export async function addClientUpload(token, file) {
  await boot()
  const existing = requireByShareToken(token)
  return addProposalUpload(existing.id, file, {
    actor: UPLOAD_ACTOR.CLIENT,
    actorName: existing.clientName || 'Client',
  })
}

export async function replaceProposalUpload(id, uploadId, file, options = {}) {
  await boot()
  const existing = requireById(id)
  requireMutableFiles(existing)

  const current = (existing.uploads ?? []).find((item) => item.id === uploadId)
  if (!current) {
    throw new NotFoundError('That file is no longer available.')
  }

  const stored = await storeUploadBytes(existing, file, uploadId)
  const now = new Date().toISOString()
  const nextVersion = makeUploadVersion({
    number: Number(current.currentVersion ?? current.versions?.length ?? 1) + 1,
    storageKey: stored.storageKey,
    url: stored.url,
    sizeBytes: stored.sizeBytes ?? file.size ?? 0,
    createdAt: now,
  })
  const upload = makeProposalUpload({
    ...current,
    name: file.name,
    mimeType: stored.mimeType || file.type || current.mimeType,
    sizeBytes: stored.sizeBytes ?? file.size ?? 0,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
    url: stored.url,
    currentVersion: nextVersion.number,
    versions: [...(current.versions ?? []), nextVersion],
    replacedAt: now,
    updatedAt: now,
  })
  const studio = options.actor === UPLOAD_ACTOR.STUDIO
  const updated = persistIdentity(
    existing,
    {
      uploads: (existing.uploads ?? []).map((item) =>
        item.id === uploadId ? upload : item,
      ),
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.FILE_UPLOADED,
        actor: studio ? PORTAL_ACTOR.STUDIO : PORTAL_ACTOR.CLIENT,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: `${upload.name} replaced.`,
          uploadId: upload.id,
        },
      }),
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

export async function replaceClientUpload(token, uploadId, file) {
  await boot()
  const existing = requireByShareToken(token)
  return replaceProposalUpload(existing.id, uploadId, file, {
    actor: UPLOAD_ACTOR.CLIENT,
    actorName: existing.clientName || 'Client',
  })
}

export async function deleteProposalUpload(id, uploadId) {
  await boot()
  const existing = requireById(id)
  requireMutableFiles(existing)

  const current = (existing.uploads ?? []).find((item) => item.id === uploadId)
  if (!current) {
    throw new NotFoundError('That file is no longer available.')
  }

  const adapter = getStorageAdapter()
  await adapter.remove({ proposalId: existing.id, uploadId })
  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      uploads: (existing.uploads ?? []).filter((item) => item.id !== uploadId),
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

export async function deleteClientUpload(token, uploadId) {
  await boot()
  const existing = requireByShareToken(token)
  return deleteProposalUpload(existing.id, uploadId)
}

export async function cancelProposal(id) {
  await boot()
  const existing = requireById(id)
  requireOpenProposal(existing, 'be cancelled')

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.CANCELLED,
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.CANCELLED,
          decidedAt: now,
          actor: PORTAL_ACTOR.STUDIO,
          summary: 'The studio cancelled this proposal.',
          locked: true,
        },
        { ...existing, status: PROPOSAL_STATUS.CANCELLED },
      ),
    },
    now,
  )
  const errors = validateProposal(updated)
  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }
  return present(await store.replace(existing.id, updated))
}

export async function requestProposalSignature(id) {
  await boot()
  const existing = requireById(id)
  if (existing.signature?.status === SIGNATURE_STATUS.SIGNED) {
    return present(existing)
  }

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      signature: makeProposalSignature({
        ...existing.signature,
        proposalId: existing.id,
        status: SIGNATURE_STATUS.WAITING,
        signer: existing.signature?.signer || existing.clientName || '',
      }),
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

export async function updateProposalPayment(id, patch = {}) {
  await boot()
  const existing = requireById(id)
  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      payment: makeProposalPayment({
        ...existing.payment,
        ...patch,
        proposalId: existing.id,
        currency: patch.currency ?? existing.payment?.currency ?? existing.currency,
        subtotal: patch.subtotal ?? existing.payment?.subtotal ?? existing.amount,
      }),
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

/** Restore seed data. Intended for tests and development tooling. */
export async function resetProposals() {
  await store.reset()
}
