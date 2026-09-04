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
  DEFAULT_UPDATED_BY,
  findVersion,
  proposalFieldsFromSnapshot,
  recordMilestoneVersion,
  recordRestoreVersion,
  recordSaveVersion,
  VERSION_SOURCE,
} from '../models/proposalVersion.js'
import {
  canCreateProposalVersion,
  canDeleteDraftVersion,
  canRestoreProposalVersion,
} from '../models/versionAccess.js'
import { NotFoundError, ValidationError, ForbiddenError, MailError } from './errors.js'
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
  recordEmailSent,
  recordEmailFailed,
  recordFromClientActivity,
  recordProposalArchived,
  recordProposalCreated,
  recordProposalDeleted,
  recordProposalEdited,
  recordVersionRestored,
  recordVersionSaved,
  recordStudioView,
} from './activityService.js'
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
import { getClientPortalUrl } from '../utils/clientProposal.js'
import { fetchBrandKit } from './brandKitService.js'
import { sendProposalEmail } from './email/sendProposalEmail.js'
import {
  EMAIL_DELIVERY_STATUS,
  MAIL_ERROR_CODE,
  makeEmailDeliverySummary,
  makeEmailMessage,
} from '../models/emailDelivery.js'
import { createRecordId } from '../models/ids.js'
import { getStorageAdapter } from '../storage/adapter.js'
import { makeProposalSignature, makeSignatureAuditEvent, SIGNATURE_STATUS } from '../models/signature.js'
import { makeProposalPayment, PAYMENT_STATUS } from '../models/payment.js'
import { recordAnalyticsSent, recordViewSession } from '../models/viewAnalytics.js'
import {
  buildCommercialQueues,
  buildOperationalStats,
} from '../models/commercialQueues.js'
import * as activityStore from './activityStore.js'

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

  const presented = present(await persistExpired(proposal))
  recordStudioView(presented)
  return presented
}

/**
 * Create a proposal from partial input.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} input
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {ValidationError}
 */
export async function createProposal(input) {
  const duplicatedFromId = input.duplicatedFromId ?? null
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

  const saved = present(await store.insert(prepared))
  recordProposalCreated(saved, { duplicatedFromId })
  return saved
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

  const source =
    existing.status === PROPOSAL_STATUS.DRAFT
      ? VERSION_SOURCE.MANUAL
      : VERSION_SOURCE.CONTENT_EDIT
  const recorded = recordSaveVersion(updated, {
    source,
    createdBy: DEFAULT_UPDATED_BY,
  })

  await boot()

  const saved = present(await store.replace(id, recorded))
  recordProposalEdited(existing, recorded)
  return saved
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
  if (!canRestoreProposalVersion()) {
    throw new ForbiddenError('You cannot restore proposal versions.')
  }

  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const source = findVersion(existing.versions, versionId)

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
    createdBy: DEFAULT_UPDATED_BY,
  })

  await boot()

  const saved = present(await store.replace(id, recorded))
  recordVersionRestored(saved, source.versionNumber)
  return saved
}

/**
 * Force-append a checkpoint of the current stored proposal. Used by
 * Manual Save Version. Identical snapshots still get a new row.
 *
 * @param {string} id
 */
export async function saveProposalVersion(id) {
  if (!canCreateProposalVersion()) {
    throw new ForbiddenError('You cannot create proposal versions.')
  }

  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const recorded = recordSaveVersion(existing, {
    force: true,
    source: VERSION_SOURCE.MANUAL,
    createdBy: DEFAULT_UPDATED_BY,
  })

  await boot()

  const saved = present(await store.replace(id, recorded))
  recordVersionSaved(saved, saved.currentVersion)
  return saved
}

/**
 * Admin-only. Draft versions may be removed. Approved versions cannot.
 * History of remaining versions is left intact.
 *
 * @param {string} id
 * @param {string} versionId
 */
export async function deleteProposalVersion(id, versionId) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const target = findVersion(existing.versions, versionId)

  if (!target) {
    throw new NotFoundError(`No version found with id "${versionId}".`)
  }

  if (!canDeleteDraftVersion(target)) {
    throw new ForbiddenError(
      'Only draft versions can be deleted, and only by an admin. Approved versions are immutable.',
    )
  }

  const remaining = (existing.versions ?? []).filter(
    (version) => version.versionId !== target.versionId && version.id !== target.id,
  )

  if (remaining.length === 0) {
    throw new ValidationError('The last version cannot be deleted.', [
      { field: 'versions', message: 'At least one version must remain.' },
    ])
  }

  const latest = remaining.reduce((lead, version) =>
    version.versionNumber > lead.versionNumber ? version : lead,
  )
  const currentStillExists = remaining.some(
    (version) => version.versionNumber === existing.currentVersion,
  )

  const updated = makeProposal({
    ...existing,
    id: existing.id,
    createdAt: existing.createdAt,
    shareToken: existing.shareToken,
    versions: remaining,
    currentVersion: currentStillExists ? existing.currentVersion : latest.versionNumber,
    updatedAt: new Date().toISOString(),
  })

  await boot()

  return present(await store.replace(id, updated))
}

/**
 * Send the proposal to the client through the mail provider.
 * Status becomes Sent only after the provider accepts the message.
 *
 * @param {string} id
 * @param {{
 *   to?: string | string[],
 *   cc?: string | string[],
 *   bcc?: string | string[],
 *   fromName?: string,
 *   fromEmail?: string,
 *   subject?: string,
 *   message?: string,
 *   expiresAt?: string | null,
 *   scheduledAt?: string | null,
 *   appUrl?: string,
 * }} [options]
 */
export async function sendProposal(id, options = {}) {
  if (!canCreateProposalVersion()) {
    throw new ForbiddenError('You cannot record send versions.')
  }

  await boot()

  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  requireOpenProposal(existing, 'be sent')

  const kit = await fetchBrandKit().catch(() => null)
  const appUrl =
    options.appUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const proposalUrl = getClientPortalUrl(existing.shareToken)
  const messageId = createRecordId('eml')
  const trackingUrl = appUrl ? `${appUrl}/api/email/click/${messageId}` : proposalUrl
  const openPixelUrl = appUrl ? `${appUrl}/api/email/open/${messageId}` : ''
  const to = options.to || existing.clientEmail
  const fromName =
    options.fromName || kit?.companyName || kit?.contact?.legalName || DEFAULT_UPDATED_BY
  const fromEmail = options.fromEmail || kit?.contact?.email || ''
  const logoUrl =
    kit?.logos?.primary?.url || kit?.logos?.light?.url || kit?.logos?.dark?.url || ''
  const expiresAt = options.expiresAt === undefined ? existing.validUntil : options.expiresAt
  const draftMessage = makeEmailMessage({
    id: messageId,
    proposalId: existing.id,
    fromName,
    fromEmail,
    to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    message: options.message,
    proposalUrl,
    trackingUrl,
    expiresAt,
    scheduledAt: options.scheduledAt,
    status: EMAIL_DELIVERY_STATUS.SENDING,
  })

  let delivered
  try {
    delivered = await sendProposalEmail({
      id: messageId,
      proposalId: existing.id,
      to,
      cc: options.cc,
      bcc: options.bcc,
      fromName,
      fromEmail,
      subject: options.subject,
      message: options.message,
      proposalTitle: existing.title,
      studioName: kit?.companyName || kit?.contact?.legalName || 'Studio',
      supportEmail: kit?.contact?.email || fromEmail,
      logoUrl,
      accentColor: kit?.colors?.accent || kit?.colors?.primary,
      proposalUrl,
      trackingUrl,
      openPixelUrl,
      appUrl,
      expiresAt,
      scheduledAt: options.scheduledAt,
    })
  } catch (error) {
    const failed = makeEmailMessage({
      ...draftMessage,
      status: EMAIL_DELIVERY_STATUS.FAILED,
      error: error.message,
      errorCode: error.code || MAIL_ERROR_CODE.REJECTED,
      updatedAt: new Date().toISOString(),
    })
    const stamped = persistIdentity(
      existing,
      { lastEmail: makeEmailDeliverySummary(failed) },
      existing.updatedAt,
    )
    await store.replace(id, stamped)
    await recordEmailFailed(stamped, { message: failed, error })
    throw error instanceof MailError
      ? error
      : new MailError(error.message || 'The proposal email could not be sent.', {
          code: MAIL_ERROR_CODE.REJECTED,
          retryable: true,
        })
  }

  const alreadySent = existing.status !== PROPOSAL_STATUS.DRAFT
  const now = new Date().toISOString()
  const queued = delivered.status === EMAIL_DELIVERY_STATUS.QUEUED
  const nextStatus = queued ? existing.status : PROPOSAL_STATUS.SENT
  const sentMessage = makeEmailMessage({
    ...draftMessage,
    ...delivered,
    id: messageId,
    proposalUrl,
    trackingUrl,
    status: delivered.status,
    sentAt: delivered.sentAt || now,
  })

  const updated = persistIdentity(
    existing,
    {
      status: nextStatus,
      clientEmail: sentMessage.to[0] || existing.clientEmail,
      validUntil: expiresAt || existing.validUntil,
      lastEmail: makeEmailDeliverySummary(sentMessage),
      analytics: recordAnalyticsSent(existing.analytics),
      activity: queued
        ? existing.activity
        : recordActivity(existing, {
            type: CLIENT_ACTIVITY_TYPE.SENT,
            actor: PORTAL_ACTOR.STUDIO,
            metadata: {
              visibility: COMMENT_VISIBILITY.CLIENT,
              detail: alreadySent
                ? `Resent to ${sentMessage.to[0] || existing.clientName || 'the client'}.`
                : `Sent to ${sentMessage.to[0] || existing.clientName || 'the client'}.`,
            },
          }),
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: nextStatus,
          locked: false,
        },
        { ...existing, status: nextStatus },
      ),
    },
    now,
  )

  const recorded = queued
    ? updated
    : recordMilestoneVersion(updated, {
        source: alreadySent ? VERSION_SOURCE.RESENT : VERSION_SOURCE.SENT,
        createdBy: DEFAULT_UPDATED_BY,
      })

  const saved = present(await store.replace(id, recorded))
  if (!queued) {
    await recordEmailSent(saved, { resent: alreadySent, message: sentMessage })
  }
  return saved
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

  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const deleted = await store.remove(id)

  if (!deleted) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  recordProposalDeleted(existing)
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

/**
 * Operational dashboard queues. Reads every proposal because follow-up and
 * expiry windows are derived, the same way a summary endpoint would.
 */
export async function fetchCommercialOverview() {
  await boot()
  await activityStore.ready()

  const records = store.all()
  const recentActivity = activityStore
    .all()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 8)

  return {
    queues: buildCommercialQueues(records),
    recentActivity,
    stats: buildOperationalStats(records),
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
    lastActivityAt: changes.lastActivityAt ?? timestamp,
  })
}

function recordActivity(existing, input) {
  const event = makeActivityEvent({
    ...input,
    proposalId: existing.id,
    derived: false,
  })
  scheduleCollaborationNotice(event)
  recordFromClientActivity(existing, event)
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
    existing.status === PROPOSAL_STATUS.ARCHIVED ||
    existing.status === PROPOSAL_STATUS.CANCELLED ||
    existing.status !== PROPOSAL_STATUS.SENT ||
    !isPastValidUntil(existing.validUntil)
  ) {
    return existing
  }

  const now = new Date().toISOString()
  const activity = hasActivityType(existing, CLIENT_ACTIVITY_TYPE.EXPIRED)
    ? existing.activity
    : recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.EXPIRED,
        actor: PORTAL_ACTOR.STUDIO,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'The proposal expired.',
        },
      })
  return persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.EXPIRED,
      activity,
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
  const changes = {
    lastViewedAt: now,
    lastActivityAt: now,
    analytics: recordViewSession(current.analytics, { at: now }),
  }
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

  const alreadyViewed = hasActivityType({ ...current, activity }, CLIENT_ACTIVITY_TYPE.VIEWED)
  activity = recordActivity(
    { ...current, activity },
    {
      type: CLIENT_ACTIVITY_TYPE.VIEWED,
      actor: PORTAL_ACTOR.CLIENT,
      metadata: {
        visibility: COMMENT_VISIBILITY.CLIENT,
        detail: alreadyViewed
          ? 'Viewed again from the client link.'
          : 'Viewed from the client link.',
      },
    },
  )

  changes.activity = activity

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

  const recorded = recordMilestoneVersion(updated, {
    source: VERSION_SOURCE.APPROVED,
    createdBy: existing.clientName?.trim() || 'Client',
  })

  return present(await store.replace(existing.id, recorded))
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

  const recorded = recordMilestoneVersion(updated, {
    source: VERSION_SOURCE.REQUEST_CHANGES,
    createdBy: existing.clientName?.trim() || 'Client',
  })

  return present(await store.replace(existing.id, recorded))
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
 * Pin or unpin a conversation. Studio only.
 *
 * @param {string} id
 * @param {string} commentId
 * @param {boolean} pinned
 */
export async function setProposalThreadPinned(id, commentId, pinned) {
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
    item.id === root.id ? makeComment({ ...item, pinned: Boolean(pinned) }) : item,
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

  const recorded = recordMilestoneVersion(updated, {
    source: VERSION_SOURCE.DECLINED,
    createdBy: existing.clientName?.trim() || 'Client',
  })

  return present(await store.replace(existing.id, recorded))
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
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.CANCELLED,
        actor: PORTAL_ACTOR.STUDIO,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'The studio cancelled this proposal.',
        },
      }),
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
  const saved = present(await store.replace(existing.id, updated))
  recordProposalArchived(saved)
  return saved
}

export async function archiveProposal(id) {
  await boot()
  const existing = requireById(id)

  if (existing.status === PROPOSAL_STATUS.ARCHIVED) {
    return present(existing)
  }

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.ARCHIVED,
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.ARCHIVED,
        actor: PORTAL_ACTOR.STUDIO,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'The proposal was archived.',
        },
      }),
      approval: makeProposalApproval(
        {
          ...existing.approval,
          status: PROPOSAL_STATUS.ARCHIVED,
          decidedAt: now,
          actor: PORTAL_ACTOR.STUDIO,
          summary: 'The studio archived this proposal.',
          locked: true,
        },
        { ...existing, status: PROPOSAL_STATUS.ARCHIVED },
      ),
    },
    now,
  )
  const errors = validateProposal(updated)
  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }
  const saved = present(await store.replace(existing.id, updated))
  recordProposalArchived(saved)
  return saved
}

export async function recordProposalDownload(id) {
  await boot()
  const existing = requireById(id)
  const updated = persistIdentity(
    existing,
    {
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.DOWNLOADED,
        actor: PORTAL_ACTOR.STUDIO,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: 'Proposal PDF downloaded.',
        },
      }),
    },
    new Date().toISOString(),
  )
  return present(await store.replace(existing.id, updated))
}

export async function requestProposalSignature(id) {
  await boot()
  const existing = requireById(id)
  if (existing.signature?.status === SIGNATURE_STATUS.SIGNED) {
    return present(existing)
  }

  const now = new Date().toISOString()
  const signature = makeProposalSignature({
    ...existing.signature,
    proposalId: existing.id,
    status: SIGNATURE_STATUS.WAITING,
    signer: existing.signature?.signer || existing.clientName || '',
    signerEmail: existing.signature?.signerEmail || existing.clientEmail || '',
    requestedAt: existing.signature?.requestedAt || now,
    auditTrail: [
      ...(existing.signature?.auditTrail ?? []),
      makeSignatureAuditEvent({
        at: now,
        actor: PORTAL_ACTOR.STUDIO,
        action: 'requested',
        detail: 'Signature requested. No e-sign vendor is connected.',
      }),
    ],
  })
  const updated = persistIdentity(
    existing,
    {
      signature,
      activity: recordActivity(existing, {
        type: CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED,
        actor: PORTAL_ACTOR.STUDIO,
        metadata: {
          visibility: COMMENT_VISIBILITY.CLIENT,
          detail: signature.signer
            ? `Signature requested from ${signature.signer}.`
            : 'Signature requested.',
        },
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
  const payment = makeProposalPayment({
    ...existing.payment,
    ...patch,
    proposalId: existing.id,
    currency: patch.currency ?? existing.payment?.currency ?? existing.currency,
    subtotal: patch.subtotal ?? existing.payment?.subtotal ?? existing.amount,
  })
  const becamePaid =
    payment.status === PAYMENT_STATUS.PAID &&
    existing.payment?.status !== PAYMENT_STATUS.PAID
  const updated = persistIdentity(
    existing,
    {
      payment,
      activity: becamePaid
        ? recordActivity(existing, {
            type: CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED,
            actor: PORTAL_ACTOR.CLIENT,
            metadata: {
              visibility: COMMENT_VISIBILITY.CLIENT,
              detail: 'Payment was recorded. No gateway is connected.',
            },
          })
        : existing.activity,
    },
    now,
  )
  return present(await store.replace(existing.id, updated))
}

/** Restore seed data. Intended for tests and development tooling. */
export async function resetProposals() {
  await store.reset()
}
