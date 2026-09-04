import { createRecordId } from './ids.js'
import { CLIENT_ACTIVITY_TYPE } from './clientActivity.js'
import { DEFAULT_UPDATED_BY, VERSION_SOURCE } from './proposalVersion.js'
import { PORTAL_ACTOR } from './portalPermissions.js'

/**
 * Studio audit log. Persisted as `activity_events` rows, separate from the
 * client-visible `proposal.activity` timeline.
 */

export const ACTIVITY_EVENT_TYPE = Object.freeze({
  CREATED: 'proposal_created',
  EDITED: 'proposal_edited',
  VIEWED: 'proposal_viewed',
  CLIENT_OPENED: 'client_opened',
  ACCEPTED: 'proposal_accepted',
  DECLINED: 'proposal_declined',
  PDF_DOWNLOADED: 'pdf_downloaded',
  DUPLICATED: 'proposal_duplicated',
  VERSION_SAVED: 'version_saved',
  VERSION_RESTORED: 'version_restored',
  ARCHIVED: 'proposal_archived',
  DELETED: 'proposal_deleted',
  EMAIL_SENT: 'email_sent',
  EMAIL_DELIVERED: 'email_delivered',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',
  EMAIL_FAILED: 'email_failed',
  EMAIL_BOUNCED: 'email_bounced',
  REMINDER_SENT: 'reminder_sent',
  COMMENTED: 'commented',
  REPLIED: 'replied',
  FILE_UPLOADED: 'file_uploaded',
  REVISION_REQUESTED: 'revision_requested',
})

export const ACTIVITY_EVENT_TYPES = Object.freeze(Object.values(ACTIVITY_EVENT_TYPE))

export const ACTIVITY_USER = Object.freeze({
  STUDIO: 'studio',
  CLIENT: 'client',
  SYSTEM: 'system',
})

export const ACTIVITY_FILTER = Object.freeze({
  ALL: 'all',
  EDITS: 'edits',
  CLIENT: 'client',
  DOWNLOADS: 'downloads',
  VERSIONS: 'versions',
  SYSTEM: 'system',
})

export const ACTIVITY_FILTERS = Object.freeze(Object.values(ACTIVITY_FILTER))

export const ACTIVITY_FILTER_LABELS = Object.freeze({
  [ACTIVITY_FILTER.ALL]: 'All',
  [ACTIVITY_FILTER.EDITS]: 'Edits',
  [ACTIVITY_FILTER.CLIENT]: 'Client',
  [ACTIVITY_FILTER.DOWNLOADS]: 'Downloads',
  [ACTIVITY_FILTER.VERSIONS]: 'Versions',
  [ACTIVITY_FILTER.SYSTEM]: 'System',
})

export const EDIT_GROUP_MS = 5 * 60 * 1000

export const ACTIVITY_PAGE_SIZE = 40

const FILTER_TYPES = Object.freeze({
  [ACTIVITY_FILTER.ALL]: null,
  [ACTIVITY_FILTER.EDITS]: [
    ACTIVITY_EVENT_TYPE.EDITED,
    ACTIVITY_EVENT_TYPE.VERSION_SAVED,
  ],
  [ACTIVITY_FILTER.CLIENT]: [
    ACTIVITY_EVENT_TYPE.CLIENT_OPENED,
    ACTIVITY_EVENT_TYPE.ACCEPTED,
    ACTIVITY_EVENT_TYPE.DECLINED,
    ACTIVITY_EVENT_TYPE.REVISION_REQUESTED,
    ACTIVITY_EVENT_TYPE.COMMENTED,
    ACTIVITY_EVENT_TYPE.REPLIED,
    ACTIVITY_EVENT_TYPE.FILE_UPLOADED,
    ACTIVITY_EVENT_TYPE.EMAIL_OPENED,
    ACTIVITY_EVENT_TYPE.EMAIL_CLICKED,
    ACTIVITY_EVENT_TYPE.EMAIL_DELIVERED,
    ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED,
  ],
  [ACTIVITY_FILTER.DOWNLOADS]: [ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED],
  [ACTIVITY_FILTER.VERSIONS]: [
    ACTIVITY_EVENT_TYPE.VERSION_SAVED,
    ACTIVITY_EVENT_TYPE.VERSION_RESTORED,
  ],
  [ACTIVITY_FILTER.SYSTEM]: [
    ACTIVITY_EVENT_TYPE.CREATED,
    ACTIVITY_EVENT_TYPE.DUPLICATED,
    ACTIVITY_EVENT_TYPE.ARCHIVED,
    ACTIVITY_EVENT_TYPE.DELETED,
    ACTIVITY_EVENT_TYPE.EMAIL_SENT,
    ACTIVITY_EVENT_TYPE.EMAIL_DELIVERED,
    ACTIVITY_EVENT_TYPE.EMAIL_OPENED,
    ACTIVITY_EVENT_TYPE.EMAIL_CLICKED,
    ACTIVITY_EVENT_TYPE.EMAIL_FAILED,
    ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED,
    ACTIVITY_EVENT_TYPE.REMINDER_SENT,
    ACTIVITY_EVENT_TYPE.VIEWED,
  ],
})

export const ACTIVITY_ICON = Object.freeze({
  [ACTIVITY_EVENT_TYPE.CREATED]: 'activityCreated',
  [ACTIVITY_EVENT_TYPE.EDITED]: 'activityEdited',
  [ACTIVITY_EVENT_TYPE.VIEWED]: 'activityViewed',
  [ACTIVITY_EVENT_TYPE.CLIENT_OPENED]: 'activityViewed',
  [ACTIVITY_EVENT_TYPE.ACCEPTED]: 'activityAccepted',
  [ACTIVITY_EVENT_TYPE.DECLINED]: 'activityDeclined',
  [ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED]: 'activityDownloaded',
  [ACTIVITY_EVENT_TYPE.DUPLICATED]: 'activityDuplicated',
  [ACTIVITY_EVENT_TYPE.VERSION_SAVED]: 'activitySaved',
  [ACTIVITY_EVENT_TYPE.VERSION_RESTORED]: 'activityRestored',
  [ACTIVITY_EVENT_TYPE.ARCHIVED]: 'activityArchived',
  [ACTIVITY_EVENT_TYPE.DELETED]: 'activityDeleted',
  [ACTIVITY_EVENT_TYPE.EMAIL_SENT]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.EMAIL_DELIVERED]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.EMAIL_OPENED]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.EMAIL_CLICKED]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.EMAIL_FAILED]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED]: 'activityEmail',
  [ACTIVITY_EVENT_TYPE.REMINDER_SENT]: 'activityReminder',
  [ACTIVITY_EVENT_TYPE.COMMENTED]: 'message',
  [ACTIVITY_EVENT_TYPE.REPLIED]: 'message',
  [ACTIVITY_EVENT_TYPE.FILE_UPLOADED]: 'upload',
  [ACTIVITY_EVENT_TYPE.REVISION_REQUESTED]: 'activityEdited',
})

export const ACTIVITY_TITLES = Object.freeze({
  [ACTIVITY_EVENT_TYPE.CREATED]: 'Proposal created',
  [ACTIVITY_EVENT_TYPE.EDITED]: 'Edited proposal',
  [ACTIVITY_EVENT_TYPE.VIEWED]: 'Proposal viewed',
  [ACTIVITY_EVENT_TYPE.CLIENT_OPENED]: 'Client viewed proposal',
  [ACTIVITY_EVENT_TYPE.ACCEPTED]: 'Proposal accepted',
  [ACTIVITY_EVENT_TYPE.DECLINED]: 'Proposal declined',
  [ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED]: 'PDF downloaded',
  [ACTIVITY_EVENT_TYPE.DUPLICATED]: 'Proposal duplicated',
  [ACTIVITY_EVENT_TYPE.VERSION_SAVED]: 'Version saved',
  [ACTIVITY_EVENT_TYPE.VERSION_RESTORED]: 'Version restored',
  [ACTIVITY_EVENT_TYPE.ARCHIVED]: 'Proposal archived',
  [ACTIVITY_EVENT_TYPE.DELETED]: 'Proposal deleted',
  [ACTIVITY_EVENT_TYPE.EMAIL_SENT]: 'Proposal sent',
  [ACTIVITY_EVENT_TYPE.EMAIL_DELIVERED]: 'Email delivered',
  [ACTIVITY_EVENT_TYPE.EMAIL_OPENED]: 'Client opened email',
  [ACTIVITY_EVENT_TYPE.EMAIL_CLICKED]: 'Client clicked proposal',
  [ACTIVITY_EVENT_TYPE.EMAIL_FAILED]: 'Email failed',
  [ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED]: 'Email bounced',
  [ACTIVITY_EVENT_TYPE.REMINDER_SENT]: 'Reminder sent',
  [ACTIVITY_EVENT_TYPE.COMMENTED]: 'Comment added',
  [ACTIVITY_EVENT_TYPE.REPLIED]: 'Reply added',
  [ACTIVITY_EVENT_TYPE.FILE_UPLOADED]: 'File uploaded',
  [ACTIVITY_EVENT_TYPE.REVISION_REQUESTED]: 'Changes requested',
})

export const ACTIVITY_TOAST_TYPES = Object.freeze([
  ACTIVITY_EVENT_TYPE.VERSION_RESTORED,
  ACTIVITY_EVENT_TYPE.ACCEPTED,
  ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED,
  ACTIVITY_EVENT_TYPE.DUPLICATED,
  ACTIVITY_EVENT_TYPE.ARCHIVED,
  ACTIVITY_EVENT_TYPE.EMAIL_SENT,
  ACTIVITY_EVENT_TYPE.EMAIL_FAILED,
  ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED,
])

const CLIENT_TYPE_MAP = Object.freeze({
  [CLIENT_ACTIVITY_TYPE.PREPARED]: ACTIVITY_EVENT_TYPE.CREATED,
  [CLIENT_ACTIVITY_TYPE.SENT]: ACTIVITY_EVENT_TYPE.EMAIL_SENT,
  [CLIENT_ACTIVITY_TYPE.VIEWED]: ACTIVITY_EVENT_TYPE.CLIENT_OPENED,
  [CLIENT_ACTIVITY_TYPE.ACCEPTED]: ACTIVITY_EVENT_TYPE.ACCEPTED,
  [CLIENT_ACTIVITY_TYPE.DECLINED]: ACTIVITY_EVENT_TYPE.DECLINED,
  [CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED]: ACTIVITY_EVENT_TYPE.REVISION_REQUESTED,
  [CLIENT_ACTIVITY_TYPE.COMMENTED]: ACTIVITY_EVENT_TYPE.COMMENTED,
  [CLIENT_ACTIVITY_TYPE.REPLIED]: ACTIVITY_EVENT_TYPE.REPLIED,
  [CLIENT_ACTIVITY_TYPE.FILE_UPLOADED]: ACTIVITY_EVENT_TYPE.FILE_UPLOADED,
})

const TRACKED_DIFF_FIELDS = Object.freeze([
  ['title', 'Title'],
  ['amount', 'Price'],
  ['clientName', 'Client name'],
  ['clientEmail', 'Client email'],
  ['company', 'Company'],
  ['validUntil', 'Expiry'],
  ['summary', 'Summary'],
  ['projectType', 'Project type'],
  ['layoutId', 'Layout'],
])

/**
 * @typedef {object} ActivityChange
 * @property {string} field
 * @property {string} label
 * @property {unknown} previous
 * @property {unknown} next
 */

/**
 * @typedef {object} ActivityEvent
 * @property {string} id
 * @property {string} proposal_id
 * @property {string} user_id
 * @property {string} event_type
 * @property {string} event_title
 * @property {object} metadata
 * @property {string} created_at
 */

function authorFromUserId(userId, metadata = {}) {
  if (metadata.authorName) return metadata.authorName
  if (userId === ACTIVITY_USER.CLIENT) return 'Client'
  if (userId === ACTIVITY_USER.SYSTEM) return 'System'
  return DEFAULT_UPDATED_BY
}

/**
 * @param {Partial<ActivityEvent> & { proposalId?: string, createdAt?: string, userId?: string, eventType?: string, eventTitle?: string }} [input]
 * @returns {ActivityEvent}
 */
export function makeActivityEventRow(input = {}) {
  const eventType = ACTIVITY_EVENT_TYPES.includes(input.event_type ?? input.eventType)
    ? (input.event_type ?? input.eventType)
    : ACTIVITY_EVENT_TYPE.EDITED
  const metadata = { ...(input.metadata ?? {}) }
  const createdAt = input.created_at ?? input.createdAt ?? new Date().toISOString()
  const userId = input.user_id ?? input.userId ?? ACTIVITY_USER.STUDIO

  return {
    id: input.id ?? createRecordId('aev'),
    proposal_id: input.proposal_id ?? input.proposalId ?? '',
    user_id: userId,
    event_type: eventType,
    event_title: input.event_title ?? input.eventTitle ?? ACTIVITY_TITLES[eventType] ?? 'Update',
    metadata,
    created_at: createdAt,
  }
}

export function activityIconName(event) {
  return ACTIVITY_ICON[event?.event_type] ?? 'clock'
}

export function activityAuthor(event) {
  return authorFromUserId(event?.user_id, event?.metadata)
}

export function activityChanges(event) {
  const list = event?.metadata?.changes
  return Array.isArray(list) ? list : []
}

export function activityDescription(event) {
  if (!event) return ''
  if (event.metadata?.description) return event.metadata.description
  const changes = activityChanges(event)
  if (changes.length === 1) return `Changed ${changes[0].label}`
  if (changes.length > 1) {
    return `Changed ${changes.map((item) => item.label).join(', ')}`
  }
  if (event.metadata?.detail) return event.metadata.detail
  if (event.metadata?.timezone) return `Viewed from ${event.metadata.timezone}`
  if (event.event_type === ACTIVITY_EVENT_TYPE.EMAIL_SENT && event.metadata?.clientName) {
    return `Studio emailed proposal to ${event.metadata.clientName}`
  }
  if (event.event_type === ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED) {
    return event.metadata?.audience === 'client'
      ? 'Client downloaded the PDF'
      : 'Studio generated a PDF'
  }
  if (event.event_type === ACTIVITY_EVENT_TYPE.VERSION_RESTORED && event.metadata?.restoredFrom) {
    return `Restored version ${event.metadata.restoredFrom}`
  }
  if (event.event_type === ACTIVITY_EVENT_TYPE.VERSION_SAVED && event.metadata?.versionNumber) {
    return `Saved version ${event.metadata.versionNumber}`
  }
  return activityAuthor(event)
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} before
 * @param {import('./proposal.js').Proposal | null | undefined} after
 * @returns {ActivityChange[]}
 */
export function diffProposalFields(before, after) {
  if (!before || !after) return []

  const changes = []

  for (const [field, label] of TRACKED_DIFF_FIELDS) {
    const previous = before[field]
    const next = after[field]
    const left = field === 'amount' ? Number(previous) : previous ?? ''
    const right = field === 'amount' ? Number(next) : next ?? ''
    if (String(left) === String(right)) continue
    changes.push({ field, label, previous, next })
  }

  try {
    const prevBlocks = JSON.stringify(before.blocks ?? [])
    const nextBlocks = JSON.stringify(after.blocks ?? [])
    if (prevBlocks !== nextBlocks) {
      changes.push({
        field: 'blocks',
        label: 'Scope of Work',
        previous: `${(before.blocks ?? []).length} blocks`,
        next: `${(after.blocks ?? []).length} blocks`,
      })
    }
  } catch {
    /* ignore serialisation failures */
  }

  return changes
}

export function mapClientActivityType(type) {
  return CLIENT_TYPE_MAP[type] ?? null
}

/**
 * @param {import('./clientActivity.js').ProposalActivity | import('./clientActivity.js').ClientActivityEvent} event
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {ActivityEvent | null}
 */
export function activityFromClientEvent(event, proposal) {
  const eventType = mapClientActivityType(event?.type)
  if (!eventType) return null

  const actor = event.actor ?? PORTAL_ACTOR.STUDIO
  const clientName = proposal?.clientName ?? event.metadata?.clientName ?? ''
  const detail = event.metadata?.detail ?? event.detail ?? ''
  const description =
    eventType === ACTIVITY_EVENT_TYPE.EMAIL_SENT && clientName
      ? `Studio emailed proposal to ${clientName}`
      : detail

  return makeActivityEventRow({
    id: event.id ? `legacy-${event.id}` : undefined,
    proposal_id: proposal?.id ?? event.proposalId ?? '',
    user_id: actor === PORTAL_ACTOR.CLIENT ? ACTIVITY_USER.CLIENT : ACTIVITY_USER.STUDIO,
    event_type: eventType,
    event_title: ACTIVITY_TITLES[eventType],
    created_at: event.createdAt ?? event.at,
    metadata: {
      description,
      detail,
      clientName,
      authorName:
        actor === PORTAL_ACTOR.CLIENT
          ? clientName || 'Client'
          : DEFAULT_UPDATED_BY,
      sourceActivityId: event.id,
      visibility: event.metadata?.visibility,
    },
  })
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {ActivityEvent[]}
 */
export function hydrateActivityFromProposal(proposal) {
  if (!proposal) return []

  const rows = []
  const seen = new Set()

  function push(row) {
    if (!row?.id || seen.has(row.id)) return
    seen.add(row.id)
    rows.push(row)
  }

  for (const event of proposal.activity ?? []) {
    if (event.type === CLIENT_ACTIVITY_TYPE.SENT) continue
    push(activityFromClientEvent(event, proposal))
  }

  for (const version of proposal.versions ?? []) {
    if (version.source === VERSION_SOURCE.RESTORED) {
      push(
        makeActivityEventRow({
          id: `legacy-ver-restore-${version.versionId ?? version.id}`,
          proposal_id: proposal.id,
          user_id: ACTIVITY_USER.STUDIO,
          event_type: ACTIVITY_EVENT_TYPE.VERSION_RESTORED,
          created_at: version.createdAt,
          metadata: {
            authorName: version.createdBy || DEFAULT_UPDATED_BY,
            restoredFrom: version.restoredFrom,
            versionNumber: version.versionNumber,
            description: version.restoredFrom
              ? `Restored version ${version.restoredFrom}`
              : 'Restored a previous version',
          },
        }),
      )
    } else if (version.source === VERSION_SOURCE.MANUAL) {
      push(
        makeActivityEventRow({
          id: `legacy-ver-save-${version.versionId ?? version.id}`,
          proposal_id: proposal.id,
          user_id: ACTIVITY_USER.STUDIO,
          event_type: ACTIVITY_EVENT_TYPE.VERSION_SAVED,
          created_at: version.createdAt,
          metadata: {
            authorName: version.createdBy || DEFAULT_UPDATED_BY,
            versionNumber: version.versionNumber,
            description: `Saved version ${version.versionNumber}`,
          },
        }),
      )
    }
  }

  if (!rows.some((row) => row.event_type === ACTIVITY_EVENT_TYPE.CREATED)) {
    push(
      makeActivityEventRow({
        id: `legacy-created-${proposal.id}`,
        proposal_id: proposal.id,
        user_id: ACTIVITY_USER.STUDIO,
        event_type: ACTIVITY_EVENT_TYPE.CREATED,
        created_at: proposal.createdAt,
        metadata: {
          authorName: DEFAULT_UPDATED_BY,
          description: proposal.title
            ? `Created “${proposal.title}”`
            : 'Proposal created',
        },
      }),
    )
  }

  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return rows
}

export function matchesActivityFilter(event, filter) {
  if (!filter || filter === ACTIVITY_FILTER.ALL) return true
  const types = FILTER_TYPES[filter]
  if (!types) return true
  return types.includes(event.event_type)
}

export function matchesActivitySearch(event, term) {
  const query = String(term ?? '').trim().toLowerCase()
  if (!query) return true

  const haystack = [
    event.event_title,
    event.event_type,
    activityDescription(event),
    activityAuthor(event),
    event.user_id,
    JSON.stringify(event.metadata ?? {}),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

/**
 * Collapse consecutive edits by the same author within five minutes.
 *
 * @param {ActivityEvent[]} events newest first
 */
export function groupActivityEvents(events) {
  const groups = []

  for (const event of events) {
    const lead = groups[groups.length - 1]
    const previous = lead?.events[lead.events.length - 1]
    const canGroup =
      event.event_type === ACTIVITY_EVENT_TYPE.EDITED &&
      lead &&
      lead.event_type === ACTIVITY_EVENT_TYPE.EDITED &&
      lead.user_id === event.user_id &&
      previous &&
      Math.abs(
        new Date(previous.created_at).getTime() - new Date(event.created_at).getTime(),
      ) <= EDIT_GROUP_MS

    if (canGroup) {
      lead.events.push(event)
      continue
    }

    groups.push({
      id: event.id,
      event_type: event.event_type,
      user_id: event.user_id,
      created_at: event.created_at,
      events: [event],
    })
  }

  return groups.map((group) => {
    const eventsInGroup = group.events
    const lead = eventsInGroup[0]
    const grouped = eventsInGroup.length > 1
    const changeCount = grouped
      ? eventsInGroup.reduce((sum, item) => sum + Math.max(activityChanges(item).length, 1), 0)
      : activityChanges(lead).length

    return {
      id: group.id,
      grouped,
      event_type: lead.event_type,
      user_id: lead.user_id,
      created_at: lead.created_at,
      events: eventsInGroup,
      event: lead,
      title: grouped
        ? `Edited proposal (${changeCount} changes)`
        : lead.event_title,
      description: grouped
        ? uniqueChangeLabels(eventsInGroup).join(', ') || activityDescription(lead)
        : activityDescription(lead),
      author: activityAuthor(lead),
      icon: activityIconName(lead),
    }
  })
}

function uniqueChangeLabels(events) {
  const labels = []
  for (const event of events) {
    for (const change of activityChanges(event)) {
      if (!labels.includes(change.label)) labels.push(change.label)
    }
  }
  return labels
}

export function flattenActivityGroups(groups, expandedIds) {
  const rows = []

  for (const group of groups) {
    rows.push({
      kind: group.grouped ? 'group' : 'event',
      id: group.id,
      group,
      event: group.event,
    })

    if (group.grouped && expandedIds.has(group.id)) {
      for (const event of group.events) {
        rows.push({
          kind: 'child',
          id: event.id,
          group,
          event,
        })
      }
    }
  }

  return rows
}

export function shouldToastActivity(event) {
  return ACTIVITY_TOAST_TYPES.includes(event?.event_type)
}

export function toastMessageForActivity(event) {
  if (event?.event_type === ACTIVITY_EVENT_TYPE.PDF_DOWNLOADED) {
    return 'PDF generated'
  }
  return event?.event_title ?? ACTIVITY_TITLES[event?.event_type] ?? 'Update'
}
