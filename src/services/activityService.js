import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_USER,
  activityFromClientEvent,
  diffProposalFields,
  groupActivityEvents,
  hydrateActivityFromProposal,
  makeActivityEventRow,
  matchesActivityFilter,
  matchesActivitySearch,
  shouldToastActivity,
  toastMessageForActivity,
  ACTIVITY_EVENT_TYPE,
  ACTIVITY_TITLES,
} from '../models/activityEvent.js'
import { CLIENT_ACTIVITY_TYPE } from '../models/clientActivity.js'
import { DEFAULT_UPDATED_BY } from '../models/proposalVersion.js'
import { PDF_AUDIENCE } from '../pdf/pdfFormat.js'
import * as store from './activityStore.js'

const SKIP_CLIENT_DUAL_WRITE = new Set([
  CLIENT_ACTIVITY_TYPE.PREPARED,
  CLIENT_ACTIVITY_TYPE.SENT,
  CLIENT_ACTIVITY_TYPE.EDITED,
  CLIENT_ACTIVITY_TYPE.DOWNLOADED,
  CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED,
  CLIENT_ACTIVITY_TYPE.EXPIRED,
  CLIENT_ACTIVITY_TYPE.CANCELLED,
  CLIENT_ACTIVITY_TYPE.ARCHIVED,
])

const viewedSession = new Set()
const clientOpenSession = new Set()

/** @type {Set<(event: import('../models/activityEvent.js').ActivityEvent) => void>} */
const listeners = new Set()

async function boot() {
  await store.ready()
}

function emit(event) {
  listeners.forEach((handler) => {
    try {
      handler(event)
    } catch {
      /* subscribers must not break writes */
    }
  })
  return event
}

/**
 * Subscribe to newly recorded audit events.
 *
 * @param {(event: import('../models/activityEvent.js').ActivityEvent) => void} handler
 */
export function onActivityEvent(handler) {
  if (typeof handler !== 'function') return () => {}
  listeners.add(handler)
  return () => listeners.delete(handler)
}

async function seedMissing(proposal) {
  if (!proposal?.id) return
  const existingIds = new Set(store.listByProposal(proposal.id).map((row) => row.id))
  const seeded = hydrateActivityFromProposal(proposal).filter((row) => !existingIds.has(row.id))
  if (!seeded.length) return
  await store.insertMany(seeded)
}

/**
 * Append one row to `activity_events`. Failures never throw to callers.
 *
 * @param {Partial<import('../models/activityEvent.js').ActivityEvent> & object} input
 * @param {{ proposal?: import('../models/proposal.js').Proposal | null }} [options]
 */
export async function recordActivityEvent(input, options = {}) {
  try {
    await boot()
    if (options.seed !== false && options.proposal) await seedMissing(options.proposal)

    const event = makeActivityEventRow({
      ...input,
      proposal_id: input.proposal_id ?? input.proposalId ?? options.proposal?.id,
      user_id: input.user_id ?? input.userId ?? ACTIVITY_USER.STUDIO,
      event_title:
        input.event_title ??
        input.eventTitle ??
        ACTIVITY_TITLES[input.event_type ?? input.eventType],
      metadata: {
        authorName:
          input.metadata?.authorName ??
          (input.user_id === ACTIVITY_USER.CLIENT || input.userId === ACTIVITY_USER.CLIENT
            ? options.proposal?.clientName || 'Client'
            : DEFAULT_UPDATED_BY),
        ...(input.metadata ?? {}),
      },
    })

    const saved = await store.insert(event)
    emit(saved)
    return saved
  } catch {
    return null
  }
}

export function queueActivityEvent(input, options = {}) {
  void recordActivityEvent(input, options)
}

export function recordFromClientActivity(proposal, clientEvent) {
  if (SKIP_CLIENT_DUAL_WRITE.has(clientEvent?.type)) return
  const mapped = activityFromClientEvent(clientEvent, proposal)
  if (!mapped) return
  queueActivityEvent(
    {
      ...mapped,
      id: undefined,
      metadata: {
        ...mapped.metadata,
        sourceActivityId: clientEvent.id,
      },
    },
    { proposal },
  )
}

export function recordProposalCreated(proposal, options = {}) {
  const duplicatedFromId = options.duplicatedFromId ?? null
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: duplicatedFromId
        ? ACTIVITY_EVENT_TYPE.DUPLICATED
        : ACTIVITY_EVENT_TYPE.CREATED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        duplicatedFromId,
        description: duplicatedFromId
          ? `Duplicated from another proposal`
          : proposal.title
            ? `Created “${proposal.title}”`
            : 'Proposal created',
      },
    },
    { proposal, seed: false },
  )
}

export function recordProposalEdited(before, after) {
  const changes = diffProposalFields(before, after)
  if (!changes.length) return
  queueActivityEvent(
    {
      proposal_id: after.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.EDITED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        changes,
        description:
          changes.length === 1
            ? `Changed ${changes[0].label}`
            : `Changed ${changes.map((item) => item.label).join(', ')}`,
      },
    },
    { proposal: after },
  )
}

export function recordStudioView(proposal) {
  if (!proposal?.id || viewedSession.has(proposal.id)) return
  viewedSession.add(proposal.id)
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.VIEWED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        description: 'Opened in the studio',
      },
    },
    { proposal },
  )
}

export function recordClientOpened(proposal) {
  if (!proposal?.id || clientOpenSession.has(proposal.id)) return
  clientOpenSession.add(proposal.id)
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.CLIENT,
      event_type: ACTIVITY_EVENT_TYPE.CLIENT_OPENED,
      metadata: {
        authorName: proposal.clientName || 'Client',
        timezone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : '',
        description: (() => {
          const zone =
            typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : ''
          return zone ? `Viewed from ${zone.replace(/_/g, ' ')}` : 'Opened from the client link'
        })(),
      },
    },
    { proposal },
  )
}

export function recordPdfDownloaded(proposal, options = {}) {
  if (!proposal?.id) return
  const audience = options.audience ?? PDF_AUDIENCE.STUDIO
  const isClient = audience === PDF_AUDIENCE.CLIENT
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: isClient ? ACTIVITY_USER.CLIENT : ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED,
      metadata: {
        authorName: isClient ? proposal.clientName || 'Client' : DEFAULT_UPDATED_BY,
        audience,
        versionNumber: options.version?.versionNumber ?? proposal.currentVersion,
        description: isClient ? 'Client downloaded the PDF' : 'Studio generated a PDF',
      },
    },
    { proposal },
  )
}

export async function recordEmailSent(proposal, { resent = false, message } = {}) {
  return recordActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.EMAIL_SENT,
      event_title: resent ? 'Proposal resent' : ACTIVITY_TITLES[ACTIVITY_EVENT_TYPE.EMAIL_SENT],
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        clientName: proposal.clientName,
        emailMessageId: message?.id,
        to: message?.to?.[0] || proposal.clientEmail,
        subject: message?.subject,
        resent,
        description: message?.to?.[0]
          ? `Studio emailed proposal to ${message.to[0]}`
          : proposal.clientName
            ? `Studio emailed proposal to ${proposal.clientName}`
            : 'Studio emailed the proposal',
      },
    },
    { proposal },
  )
}

export async function recordEmailFailed(proposal, { message, error } = {}) {
  return recordActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.EMAIL_FAILED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        emailMessageId: message?.id,
        to: message?.to?.[0],
        description: error?.message || 'The proposal email could not be sent',
      },
    },
    { proposal },
  )
}

export async function recordEmailDeliveryEvent(proposal, { type, messageId, to, description }) {
  if (!proposal?.id || !type) return null
  try {
    await boot()
    const existing = store.listByProposal(proposal.id)
    if (
      messageId &&
      existing.some(
        (row) => row.event_type === type && row.metadata?.emailMessageId === messageId,
      )
    ) {
      return null
    }
    return recordActivityEvent(
      {
        proposal_id: proposal.id,
        user_id:
          type === ACTIVITY_EVENT_TYPE.EMAIL_FAILED
            ? ACTIVITY_USER.STUDIO
            : ACTIVITY_USER.CLIENT,
        event_type: type,
        metadata: {
          emailMessageId: messageId,
          clientName: to,
          description,
        },
      },
      { proposal },
    )
  } catch {
    return null
  }
}

export function recordVersionSaved(proposal, versionNumber) {
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.VERSION_SAVED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        versionNumber,
        description: versionNumber ? `Saved version ${versionNumber}` : 'Saved a version',
      },
    },
    { proposal },
  )
}

export function recordVersionRestored(proposal, restoredFrom) {
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.VERSION_RESTORED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        restoredFrom,
        description: restoredFrom
          ? `Restored version ${restoredFrom}`
          : 'Restored a previous version',
      },
    },
    { proposal },
  )
}

export function recordProposalArchived(proposal) {
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.ARCHIVED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        description: 'Studio archived this proposal',
      },
    },
    { proposal },
  )
}

export function recordProposalDeleted(proposal) {
  queueActivityEvent(
    {
      proposal_id: proposal.id,
      user_id: ACTIVITY_USER.STUDIO,
      event_type: ACTIVITY_EVENT_TYPE.DELETED,
      metadata: {
        authorName: DEFAULT_UPDATED_BY,
        title: proposal.title,
        description: proposal.title
          ? `Deleted “${proposal.title}”`
          : 'Proposal deleted',
      },
    },
    { proposal },
  )
}

/**
 * @param {string} proposalId
 * @param {import('../models/proposal.js').Proposal | null} [proposal]
 * @returns {Promise<import('../models/activityEvent.js').ActivityEvent[]>}
 */
export async function listProposalActivity(proposalId, proposal = null) {
  await boot()
  await store.refresh()
  if (proposal) await seedMissing(proposal)
  return store.listByProposal(proposalId)
}

export function filterActivityEvents(events, { filter, search } = {}) {
  return events.filter(
    (event) =>
      matchesActivityFilter(event, filter) && matchesActivitySearch(event, search),
  )
}

export function pageActivityRows(rows, pageSize = ACTIVITY_PAGE_SIZE, visibleCount = ACTIVITY_PAGE_SIZE) {
  return rows.slice(0, Math.max(pageSize, visibleCount))
}

export { groupActivityEvents, ACTIVITY_PAGE_SIZE }

export function downloadTextFile(filename, mime, contents) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function eventsToCsv(events) {
  const header = ['id', 'proposal_id', 'user_id', 'event_type', 'event_title', 'description', 'author', 'created_at', 'metadata']
  const lines = [header.join(',')]
  for (const event of events) {
    lines.push(
      [
        event.id,
        event.proposal_id,
        event.user_id,
        event.event_type,
        event.event_title,
        event.metadata?.description ?? '',
        event.metadata?.authorName ?? '',
        event.created_at,
        JSON.stringify(event.metadata ?? {}),
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export async function exportActivity(events, format, proposal) {
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = String(proposal?.title ?? proposal?.id ?? 'proposal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = `${slug || 'proposal'}-activity-${stamp}`

  if (format === 'json') {
    downloadTextFile(`${base}.json`, 'application/json', `${JSON.stringify(events, null, 2)}\n`)
    return
  }

  if (format === 'csv') {
    downloadTextFile(`${base}.csv`, 'text/csv', eventsToCsv(events))
    return
  }

  const { default: ActivityLogDocument } = await import('../pdf/ActivityLogDocument.jsx')
  const blob = await pdf(
    createElement(ActivityLogDocument, { events, proposal }),
  ).toBlob()
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `${base}.pdf`
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}

export { shouldToastActivity, toastMessageForActivity }
