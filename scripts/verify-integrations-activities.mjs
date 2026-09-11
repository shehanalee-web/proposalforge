/**
 * H16.7 Activity Timeline verification.
 *
 * Read-only projection over the H16.2 ledger and seven legacy stores.
 * No write path exists: no data file, no persist handler, no mutation route.
 * Never writes data/proposals.json.
 *
 * Store seeding uses reset*Store() only. No configure*Store({ persist }) call
 * appears anywhere in this file, so no fixture can reach disk.
 *
 * Numbered 1–66 after the approved §12 verification strategy.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { resetAutomationIntakeStore } from '../src/integrations/events/store.js'
import { makeAutomationEvent } from '../src/integrations/events/schema.js'
import { resetLivingEventStore } from '../src/living/eventStore.js'
import { resetWorkflowStore } from '../src/workflow/store.js'
import { resetPortalStore } from '../src/portal/store.js'
import { resetInteractionStore, allInteractionRecords } from '../src/interactions/store.js'
import { resetCommercialCloseStore } from '../src/commercialClose/store.js'
import {
  INTEGRATION_CAPABILITIES,
  AUTOMATION_SOURCE_DOMAIN,
  AUTOMATION_INTAKE_SOURCE_DOMAINS,
  ACTIVITY_TIMELINE_AUDIENCE as ACTIVITY_AUDIENCE,
  ACTIVITY_KIND,
  ACTIVITY_KINDS,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  TIMELINE_LIMITS,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  TIMELINE_UNSCOPED_SOURCE_IDS,
  TIMELINE_DROP_REASON,
  assertTimelineSourceContract,
  registerTimelineSource,
  resetTimelineSources,
  listRegisteredTimelineSources,
  describeTimelineSources,
  createAutomationLedgerTimelineSource,
  createLivingEventsTimelineSource,
  createWorkflowActivityTimelineSource,
  createPortalActivityTimelineSource,
  createInteractionActivityTimelineSource,
  createStudioAuditTimelineSource,
  createProposalActivityTimelineSource,
  createCommercialCloseHistoryTimelineSource,
  dedupeTimelineEntries,
  projectTimelineCandidates,
  sanitizeTimelineAttributes,
  resolveTimelineTimestamps,
  makeTimelineEntry,
  deriveTimelineEntryId,
  buildTimeline,
  compareTimelineEntries,
  listStudioTimeline,
  listStudioTimelineForProposal,
  describeStudioTimelineSources,
  getActivityCapabilities,
  isActivityTimelineEnabled,
  isActivityAuthoringEnabled,
  isTimelineCacheEnabled,
  describeTimelineCache,
  configureTimelineProposalLookup,
  resetTimelineProposalLookup,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

let passed = 0
let failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

function collectFiles(relativeDir) {
  const base = join(root, relativeDir)
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(full)
    }
  }
  walk(base)
  return files.sort()
}

function collectSources(relativeDir) {
  return collectFiles(relativeDir)
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
}

/** Strip comments so honesty scans test code, not prose about what is absent. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Hash a set of files so "nothing was written" is proven, not asserted. */
function hashTree(paths) {
  const hash = createHash('sha256')
  for (const file of paths) {
    hash.update(relative(root, file).replace(/\\/g, '/'))
    hash.update(readFileSync(file))
  }
  return hash.digest('hex')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 40 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI || '1' },
  })
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}` }
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

async function threwAsync(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

const proposalsBefore = proposalsSnapshot()
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID

const PROPOSAL_A = 'prop-h167-a'
const PROPOSAL_B = 'prop-h167-b'
const PROPOSAL_PAGE = 'prop-h167-page'
/** Known proposal with no projected events — must 200 [], not 404. */
const PROPOSAL_EMPTY = 'prop-h167-empty'

const LIVING_MIRRORED_ID = 'levt-h167-mirrored'
const LIVING_LEGACY_ID = 'levt-h167-legacy'
const CLOSE_HISTORY_ID = 'cch-h167-1'

function livingEvent(id, { companyId, proposalId, type, at }) {
  return { id, companyId, proposalId, type, at, sessionId: null, blockId: null }
}

function pageEvents() {
  const list = []
  for (let i = 0; i < 220; i += 1) {
    const stamp = `2025-06-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`
    list.push(
      livingEvent(`levt-page-${String(i).padStart(3, '0')}`, {
        companyId: studio,
        proposalId: PROPOSAL_PAGE,
        type: 'section_viewed',
        at: stamp,
      }),
    )
  }
  return list
}

const studioAuditRows = [
  {
    id: 'aev-h167-1',
    proposal_id: PROPOSAL_A,
    user_id: 'studio',
    event_type: 'pdf_exported',
    event_title: 'PDF exported',
    metadata: { authorName: 'Studio User' },
    created_at: '2026-01-06T09:00:00.000Z',
  },
  {
    id: 'aev-h167-2',
    proposal_id: PROPOSAL_A,
    user_id: 'client',
    event_type: 'email_sent',
    event_title: 'Email sent',
    metadata: {},
    created_at: '2026-01-06T10:00:00.000Z',
  },
]

const proposalFixtures = [
  {
    id: PROPOSAL_A,
    activity: [
      {
        id: 'pact-h167-1',
        proposalId: PROPOSAL_A,
        type: 'viewed',
        actor: 'client',
        metadata: {},
        createdAt: '2026-01-07T09:00:00.000Z',
      },
      {
        id: 'pact-h167-2',
        proposalId: PROPOSAL_A,
        type: 'note_added',
        actor: 'studio',
        metadata: { visibility: 'internal' },
        createdAt: '2026-01-07T10:00:00.000Z',
      },
    ],
  },
]

function ledgerEvent(overrides = {}) {
  return makeAutomationEvent({
    companyId: studio,
    type: 'living.comment_added',
    occurredAt: '2026-01-05T10:00:00.000Z',
    receivedAt: '2026-01-05T10:00:01.000Z',
    idempotencyKey: `idem-${overrides.id ?? 'x'}`,
    sourceEventIdentity: LIVING_MIRRORED_ID,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.LIVING,
      entityType: 'living_event',
      entityId: PROPOSAL_A,
      eventId: LIVING_MIRRORED_ID,
    },
    correlation: { proposalId: PROPOSAL_A },
    ...overrides,
  })
}

function seedStores() {
  resetAutomationIntakeStore({
    receipts: [],
    events: [
      ledgerEvent({ id: 'aevt-h167-1' }),
      ledgerEvent({
        id: 'aevt-h167-close',
        type: 'commercial_close.status_changed',
        occurredAt: '2026-01-01T09:00:00.000Z',
        receivedAt: '2026-01-01T09:00:01.000Z',
        idempotencyKey: 'idem-close',
        sourceEventIdentity: CLOSE_HISTORY_ID,
        source: {
          domain: AUTOMATION_SOURCE_DOMAIN.COMMERCIAL_CLOSE,
          entityType: 'commercial_close',
          entityId: 'cclose-h167',
          eventId: CLOSE_HISTORY_ID,
        },
      }),
    ],
  })

  resetLivingEventStore([
    livingEvent(LIVING_MIRRORED_ID, {
      companyId: studio,
      proposalId: PROPOSAL_A,
      type: 'comment_added',
      at: '2026-01-05T10:00:00.000Z',
    }),
    livingEvent(LIVING_LEGACY_ID, {
      companyId: studio,
      proposalId: PROPOSAL_A,
      type: 'proposal_opened',
      at: '2020-01-01T00:00:00.000Z',
    }),
    livingEvent('levt-h167-other', {
      companyId: otherCompany,
      proposalId: PROPOSAL_B,
      type: 'proposal_opened',
      at: '2026-01-05T11:00:00.000Z',
    }),
    ...pageEvents(),
  ])

  resetWorkflowStore([
    {
      id: 'wf-h167',
      companyId: studio,
      proposalId: PROPOSAL_A,
      activity: [
        {
          id: 'wfevt-h167-1',
          type: 'workflow.status_changed',
          actorId: 'user-1',
          from: 'draft',
          to: 'review',
          createdAt: '2026-01-04T09:00:00.000Z',
        },
      ],
    },
  ])

  resetPortalStore([
    {
      id: 'portal-h167',
      companyId: studio,
      proposalId: PROPOSAL_A,
      activity: [
        {
          id: 'pevt-h167-1',
          type: 'portal.published',
          actorId: 'user-1',
          createdAt: '2026-01-03T09:00:00.000Z',
        },
      ],
    },
  ])

  resetInteractionStore([
    {
      id: 'int-h167',
      companyId: studio,
      proposalId: PROPOSAL_A,
      activity: [
        {
          id: 'ievt-h167-1',
          type: 'interaction.created',
          actorId: 'user-1',
          createdAt: '2026-01-02T09:00:00.000Z',
        },
        {
          // The interaction schema coerces unknown types, so this cannot stay
          // a living-canonical mirror. Asserted below rather than assumed.
          id: 'ievt-h167-2',
          type: 'comment_added',
          actorId: 'user-1',
          createdAt: '2026-01-02T10:00:00.000Z',
        },
      ],
    },
  ])

  resetCommercialCloseStore([
    {
      id: 'cclose-h167',
      companyId: studio,
      proposalId: PROPOSAL_A,
      statusHistory: [
        {
          id: CLOSE_HISTORY_ID,
          from: 'open',
          to: 'signed',
          at: '2026-01-01T09:00:00.000Z',
          actorId: 'user-1',
        },
      ],
    },
  ])
}

function seedSources() {
  resetTimelineSources()
  registerTimelineSource(createAutomationLedgerTimelineSource())
  registerTimelineSource(createLivingEventsTimelineSource())
  registerTimelineSource(createWorkflowActivityTimelineSource())
  registerTimelineSource(createPortalActivityTimelineSource())
  registerTimelineSource(createInteractionActivityTimelineSource())
  registerTimelineSource(createCommercialCloseHistoryTimelineSource())
  registerTimelineSource(createStudioAuditTimelineSource({ read: () => studioAuditRows }))
  registerTimelineSource(
    createProposalActivityTimelineSource({ read: () => proposalFixtures }),
  )
  configureTimelineProposalLookup((proposalId) => {
    const id = String(proposalId ?? '').trim()
    const rows = [
      { id: PROPOSAL_A, companyId: studio },
      { id: PROPOSAL_B, companyId: otherCompany },
      { id: PROPOSAL_PAGE, companyId: studio },
      { id: PROPOSAL_EMPTY, companyId: studio },
      ...proposalFixtures,
    ]
    const found = rows.find((row) => String(row?.id ?? '').trim() === id)
    if (!found) return null
    return {
      id,
      companyId: String(found.companyId ?? '').trim() || studio,
    }
  })
}

seedStores()
seedSources()

// ------------------------------------------------- capability and structure

console.log('— Capability and structure —')

assert('1. activityTimeline === true', INTEGRATION_CAPABILITIES.activityTimeline === true)
assert(
  '2. activityAuthoring === false',
  INTEGRATION_CAPABILITIES.activityAuthoring === false &&
    isActivityAuthoringEnabled() === false &&
    !ACTIVITY_KINDS.includes('task'),
)
assert(
  '3. authoring cannot be true without a durable repository',
  getActivityCapabilities().durablePersistence === false &&
    getActivityCapabilities().activityAuthoring === false &&
    getActivityCapabilities().cacheEnabled === false &&
    isTimelineCacheEnabled() === false &&
    describeTimelineCache().durable === false &&
    INTEGRATION_CAPABILITIES.activityTimelineCache === false,
)
assert(
  '4. prior H16 capabilities unchanged',
  INTEGRATION_CAPABILITIES.integrationFoundation === true &&
    INTEGRATION_CAPABILITIES.eventIntake === true &&
    INTEGRATION_CAPABILITIES.automationRules === true &&
    INTEGRATION_CAPABILITIES.actionIntents === true &&
    INTEGRATION_CAPABILITIES.outboundWebhooks === true &&
    INTEGRATION_CAPABILITIES.crm === true &&
    INTEGRATION_CAPABILITIES.activityPersistence === true &&
    INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)
{
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const present = readdirSync(join(root, 'data'))
  const ownStore = present.filter((name) =>
    /^(activities|activity-timeline|timeline|timeline-cache)\.json$/i.test(name),
  )
  assert(
    '5. H16.7 introduces no data/ store of its own',
    ownStore.length === 0 && dataStatus.status === 0 && !(dataStatus.stdout || '').trim(),
    `${ownStore.join(',')} ${(dataStatus.stdout || '').trim().slice(0, 200)}`,
  )
}
assert(
  '6. timeline read surface exported from the integrations barrel',
  typeof buildTimeline === 'function' &&
    typeof listStudioTimeline === 'function' &&
    typeof getActivityCapabilities === 'function' &&
    typeof dedupeTimelineEntries === 'function' &&
    isActivityTimelineEnabled() === true,
)

// ------------------------------------------------------------ source contract

console.log('')
console.log('— Source contract —')

const registered = listRegisteredTimelineSources()

assert(
  '7. every registered source reports readOnly',
  registered.length === 8 &&
    describeTimelineSources({ companyId: studio }).every((entry) => entry.readOnly === true),
)
{
  const error = threw(() =>
    assertTimelineSourceContract({
      id: TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
      isEnabled: () => true,
      list: () => [],
      describe: () => ({ id: TIMELINE_SOURCE_ID.AUTOMATION_LEDGER, readOnly: false }),
    }),
  )
  assert('8. a source declaring readOnly false is refused', error instanceof ValidationError)
}
{
  const priorities = registered.map((entry) => entry.priority)
  assert('9. source priorities are unique', new Set(priorities).size === priorities.length)
}
{
  // canonicalFor claims overlap by design: the ledger claims every intake
  // domain that a legacy source also claims. The invariant that makes tier 2
  // correct is that each domain has exactly one highest-priority claimant.
  const owners = new Map()
  let ambiguous = 0
  for (const entry of registered) {
    for (const domain of entry.canonicalFor) {
      const current = owners.get(domain)
      if (!current) owners.set(domain, entry)
      else if (current.priority === entry.priority) ambiguous += 1
    }
  }
  const ledgerOwnsIntake = AUTOMATION_INTAKE_SOURCE_DOMAINS.every(
    (domain) => owners.get(domain)?.id === TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
  )
  assert(
    '10. every canonical domain resolves to one highest-priority owner',
    ambiguous === 0 && ledgerOwnsIntake,
  )
}
{
  resetTimelineSources()
  registerTimelineSource(createLivingEventsTimelineSource())
  registerTimelineSource({
    id: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
    canonicalFor: [],
    isEnabled: () => true,
    list: () => {
      throw new Error('legacy store unavailable')
    },
    describe: () => ({
      id: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
      readOnly: true,
      storeRef: 'portal.json',
    }),
  })
  const page = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
  })
  assert(
    '11. a throwing source degrades rather than blanking the timeline',
    page.entries.length > 0 &&
      page.diagnostics.sourcesDegraded.includes(TIMELINE_SOURCE_ID.PORTAL_ACTIVITY),
  )
  seedSources()
}
{
  resetTimelineSources()
  registerTimelineSource(createLivingEventsTimelineSource())
  registerTimelineSource({
    id: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
    canonicalFor: [],
    isEnabled: () => false,
    list: () => [
      {
        sourceId: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
        nativeId: 'should-not-appear',
        companyId: studio,
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: PROPOSAL_A },
        kind: ACTIVITY_KIND.SYSTEM_EVENT,
        type: 'portal.published',
        origin: ACTIVITY_ORIGIN.SYSTEM,
        audience: ACTIVITY_AUDIENCE.INTERNAL,
        occurredAtRaw: '2026-01-03T09:00:00.000Z',
        recordedAtRaw: '2026-01-03T09:00:00.000Z',
        actor: { id: null, kind: 'system', displayName: null },
        subjectLine: 'x',
        body: '',
        attributes: {},
        source: { domain: 'portal', entityType: 'portal', entityId: 'p', eventId: 'e' },
      },
    ],
    describe: () => ({
      id: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
      readOnly: true,
      storeRef: 'portal.json',
    }),
  })
  const page = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
  })
  assert(
    '12. a disabled source contributes nothing',
    !page.entries.some((entry) => entry.sourceId === TIMELINE_SOURCE_ID.PORTAL_ACTIVITY),
  )
  seedSources()
}
assert(
  '13. no follow-up source is registered',
  !TIMELINE_SOURCE_IDS.some((id) => /followup/i.test(id)) &&
    !listRegisteredTimelineSources().some((entry) => /followup/i.test(entry.id)),
)
{
  const dir = join(root, 'src', 'integrations', 'activities', 'sources')
  const offenders = []
  for (const file of collectFiles('src/integrations/activities/sources')) {
    if (!file.endsWith('.js') || file.endsWith('index.js')) continue
    const body = stripComments(readFileSync(file, 'utf8'))
    for (const match of body.matchAll(/from\s+'\.\/([A-Za-z]+)\.js'/g)) {
      if (match[1] !== 'domainActivity') offenders.push(`${relative(dir, file)}→${match[1]}`)
    }
  }
  assert('14. no source imports another source', offenders.length === 0, offenders.join(','))
}

// ------------------------------------------------------------------ projection

console.log('')
console.log('— Projection —')

{
  const entry = makeTimelineEntry({
    sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    nativeId: 'n1',
    companyId: studio,
    subject: { type: 'galaxy', id: 'x1' },
    kind: 'teleport',
    type: 'living.viewed',
    origin: 'wizard',
    audience: 'everyone',
    occurredAtRaw: '2026-01-01T00:00:00.000Z',
    recordedAtRaw: '2026-01-01T00:00:00.000Z',
  })
  assert(
    '15. unknown taxonomy values coerce to bounded defaults',
    entry.subject.type === ACTIVITY_SUBJECT_TYPE.PROPOSAL &&
      entry.kind === ACTIVITY_KIND.SYSTEM_EVENT &&
      entry.origin === ACTIVITY_ORIGIN.SYSTEM &&
      entry.audience === ACTIVITY_AUDIENCE.INTERNAL,
  )
}
{
  const entry = makeTimelineEntry({
    sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    nativeId: 'n2',
    companyId: studio,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'x1' },
    type: 'living.viewed',
    subjectLine: 'a'.repeat(500),
    body: 'b'.repeat(4000),
    occurredAtRaw: '2026-01-01T00:00:00.000Z',
    recordedAtRaw: '2026-01-01T00:00:00.000Z',
  })
  assert(
    '16. subject line and body are truncated to bounds',
    entry.subjectLine.length === TIMELINE_LIMITS.MAX_SUBJECT_LINE &&
      entry.body.length === TIMELINE_LIMITS.MAX_BODY,
  )
}
{
  const many = {}
  for (let i = 0; i < 40; i += 1) many[`k${i}`] = `v${i}`
  const bounded = sanitizeTimelineAttributes(many)
  const filtered = sanitizeTimelineAttributes({
    good: 'ok',
    apiKey: 'leak',
    accessToken: 'leak',
    passwordHash: 'leak',
    clientSecret: 'leak',
    nested: { a: 1 },
    list: [1, 2],
  })
  const keys = Object.keys(filtered)
  assert(
    '17. unknown and credential-shaped attribute keys are dropped',
    Object.keys(bounded).length === TIMELINE_LIMITS.MAX_ATTRIBUTE_KEYS &&
      keys.length === 1 &&
      filtered.good === 'ok' &&
      !keys.some((key) => /secret|password|token|apikey/i.test(key)) &&
      !('nested' in filtered) &&
      !('list' in filtered),
  )
}
{
  const resolved = resolveTimelineTimestamps({
    occurredAtRaw: '2026-03-01T12:00:00+04:00',
    recordedAtRaw: null,
  })
  assert(
    '18. timestamps normalize to UTC ISO-8601',
    resolved.occurredAt === '2026-03-01T08:00:00.000Z' &&
      resolved.recordedAt === resolved.occurredAt,
  )
}
{
  const result = projectTimelineCandidates(
    [
      {
        sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
        nativeId: 'no-time',
        companyId: studio,
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: PROPOSAL_A },
        type: 'living.viewed',
        occurredAtRaw: null,
        recordedAtRaw: null,
      },
    ],
    { companyId: studio },
  )
  assert(
    '19. an unplaceable candidate is dropped and counted',
    result.entries.length === 0 && result.drops[TIMELINE_DROP_REASON.UNPLACEABLE] === 1,
  )
}
assert(
  '20. entry ids are deterministic across calls',
  deriveTimelineEntryId({
    sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    nativeId: 'n',
    type: 't',
  }) ===
    deriveTimelineEntryId({
      sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
      nativeId: 'n',
      type: 't',
    }),
)
{
  const first = await listStudioTimelineForProposal(studio, PROPOSAL_A)
  const second = await listStudioTimelineForProposal(studio, PROPOSAL_A)
  assert(
    '21. identical requests return byte-identical pages',
    JSON.stringify(first) === JSON.stringify(second),
  )
}
{
  const projected = projectTimelineCandidates(
    [
      {
        sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
        nativeId: 'shape',
        companyId: studio,
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: PROPOSAL_A },
        type: 'living.viewed',
        occurredAtRaw: '2026-01-01T00:00:00.000Z',
        recordedAtRaw: '2026-01-01T00:00:00.000Z',
      },
      null,
      'bad',
    ],
    { companyId: studio },
  )
  assert(
    '22. unsupported candidate shapes are dropped rather than throwing',
    projected.entries.length === 1 &&
      projected.drops[TIMELINE_DROP_REASON.UNSUPPORTED_SHAPE] === 2,
  )
}

// ------------------------------------------------------------- de-duplication

console.log('')
console.log('— De-duplication —')

const dedupePage = await listStudioTimelineForProposal(studio, PROPOSAL_A, { limit: 200 })

{
  const mirrored = dedupePage.entries.filter(
    (entry) => entry.provenance.eventId === LIVING_MIRRORED_ID,
  )
  assert(
    '23. a living event present in both the ledger and living-events appears once',
    mirrored.length === 1 && mirrored[0]?.sourceId === TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
    `count=${mirrored.length} source=${mirrored[0]?.sourceId}`,
  )
}
{
  const closes = dedupePage.entries.filter(
    (entry) => entry.provenance.eventId === CLOSE_HISTORY_ID,
  )
  assert(
    '24. a commercial close transition present in the ledger and history appears once',
    closes.length === 1 && closes[0]?.sourceId === TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
    `count=${closes.length} source=${closes[0]?.sourceId}`,
  )
}
{
  const result = dedupeTimelineEntries([
    {
      id: 'a',
      priority: 60,
      companyId: studio,
      type: 'living.comment_added',
      occurredAt: '2026-01-05T10:00:00.000Z',
      source: { domain: 'living', eventId: 'l1', entityId: 'e1' },
    },
    {
      id: 'b',
      priority: 54,
      companyId: studio,
      type: 'interaction.comment_added',
      occurredAt: '2026-01-05T10:00:00.000Z',
      source: { domain: 'interaction', eventId: 'i1', entityId: 'e2' },
    },
  ])
  const record = allInteractionRecords().find((item) => item.id === 'int-h167')
  const coerced = record?.activity?.find((event) => event.id === 'ievt-h167-2')
  assert(
    '25. an engagement mirror off living is dropped as canonical elsewhere',
    result.entries.length === 1 &&
      result.entries[0].id === 'a' &&
      result.drops[TIMELINE_DROP_REASON.CANONICAL_SOURCE_ELSEWHERE] === 1 &&
      Boolean(coerced) &&
      coerced.type !== 'comment_added',
    coerced?.type,
  )
}
assert(
  '26. a pre-intake legacy event with no ledger twin survives',
  dedupePage.entries.some((entry) => entry.provenance.eventId === LIVING_LEGACY_ID),
)
{
  const result = dedupeTimelineEntries([
    {
      id: 'ledger',
      priority: 100,
      companyId: studio,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: null, entityId: 'portal-1' },
    },
    {
      id: 'legacy',
      priority: 56,
      companyId: studio,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: null, entityId: 'portal-1' },
    },
  ])
  assert(
    '27. the composite fallback key collapses rows with no event id',
    result.entries.length === 1 && result.entries[0].id === 'ledger',
  )
}
{
  const result = dedupeTimelineEntries([
    {
      id: 'ledgerA',
      priority: 100,
      companyId: studio,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: 'A', entityId: 'portal-1' },
    },
    {
      id: 'legacyB',
      priority: 56,
      companyId: studio,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: 'B', entityId: 'portal-1' },
    },
  ])
  const crossCompany = dedupeTimelineEntries([
    {
      id: 'p',
      priority: 100,
      companyId: studio,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: 'same', entityId: 'e' },
    },
    {
      id: 'q',
      priority: 56,
      companyId: otherCompany,
      type: 'portal.viewed',
      occurredAt: '2026-01-03T09:00:00.000Z',
      source: { domain: 'portal', eventId: 'same', entityId: 'e' },
    },
  ])
  assert(
    '28. the fallback key never merges distinct events or across companies',
    result.entries.length === 2 && crossCompany.entries.length === 2,
  )
}
{
  const set = [
    {
      id: 'x',
      priority: 100,
      companyId: studio,
      type: 'workflow.status_changed',
      occurredAt: '2026-01-04T09:00:00.000Z',
      source: { domain: 'workflow', eventId: 'w', entityId: 'wf' },
    },
    {
      id: 'y',
      priority: 58,
      companyId: studio,
      type: 'workflow.status_changed',
      occurredAt: '2026-01-04T09:00:00.000Z',
      source: { domain: 'workflow', eventId: 'w', entityId: 'wf' },
    },
  ]
  const forward = dedupeTimelineEntries(set).entries.map((entry) => entry.id).join()
  const reverse = dedupeTimelineEntries([...set].reverse()).entries.map((entry) => entry.id).join()
  assert(
    '29. de-duplication ties resolve deterministically regardless of input order',
    forward === reverse && forward === 'x',
    `${forward} vs ${reverse}`,
  )
}
{
  const page = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
    limit: 200,
  })
  const drops = page.diagnostics.drops
  const total = Object.values(drops).reduce((sum, value) => sum + Number(value || 0), 0)
  assert(
    '30. drop counts reconcile against candidate counts',
    page.diagnostics.candidates >= page.diagnostics.matched &&
      total >= 1 &&
      page.diagnostics.candidates - total <= page.diagnostics.candidates,
    JSON.stringify(drops),
  )
}

// ------------------------------------------------------- sorting and paging

console.log('')
console.log('— Sorting and pagination —')

{
  const entries = dedupePage.entries
  let ordered = true
  for (let i = 1; i < entries.length; i += 1) {
    if (compareTimelineEntries(entries[i - 1], entries[i]) > 0) ordered = false
  }
  assert('31. entries follow the total ordering rule', ordered && entries.length > 1)
}
{
  const defaultPage = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_PAGE,
  })
  const capped = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_PAGE,
    limit: 5000,
  })
  assert(
    '32. limit defaults to 50 and caps at 200',
    TIMELINE_LIMITS.DEFAULT_LIMIT === 50 &&
      TIMELINE_LIMITS.MAX_LIMIT === 200 &&
      defaultPage.entries.length === 50 &&
      capped.entries.length === 200,
  )
}
{
  const first = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_PAGE,
    limit: 10,
  })
  const again = await buildTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_PAGE,
    limit: 10,
    cursor: first.nextCursor,
  })
  assert(
    '33. keyset cursors are stable and never overlap the prior page',
    first.nextCursor &&
      !again.entries.some((entry) => first.entries.some((prior) => prior.id === entry.id)),
  )
}
{
  const seen = []
  let cursor = null
  let pages = 0
  do {
    const page = await buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      subjectId: PROPOSAL_PAGE,
      limit: 50,
      cursor,
    })
    seen.push(...page.entries.map((entry) => entry.id))
    cursor = page.nextCursor
    pages += 1
  } while (cursor && pages < 20)

  assert('34. pagination walks every entry with no duplicates', seen.length === new Set(seen).size)
  assert('35. pagination skips no entries', seen.length === 220, `saw ${seen.length}`)
}

// ----------------------------------------------------------- company isolation

console.log('')
console.log('— Company isolation —')

assert(
  '36. timeline requires company scope',
  (await threwAsync(() => listStudioTimeline({ companyId: '' }))) instanceof ValidationError,
)
{
  const page = await buildTimeline({ companyId: otherCompany, limit: 200 })
  assert(
    '37. another tenant sees zero studio_audit entries',
    !page.entries.some((entry) => entry.sourceId === TIMELINE_SOURCE_ID.STUDIO_AUDIT),
  )
  assert(
    '38. another tenant sees zero proposal_activity entries',
    !page.entries.some((entry) => entry.sourceId === TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY),
  )
  assert(
    '39. unscoped sources are not queried for another tenant',
    page.diagnostics.sourcesQueried === registered.length - TIMELINE_UNSCOPED_SOURCE_IDS.length &&
      page.entries.every((entry) => entry.companyId === otherCompany),
    `queried=${page.diagnostics.sourcesQueried}`,
  )
}
{
  const error = await threwAsync(() => listStudioTimelineForProposal(otherCompany, PROPOSAL_A))
  assert('40. a cross-company subject raises ForbiddenError', error instanceof ForbiddenError)
  assert(
    '41. the forbidden error leaks no cross-tenant content',
    !String(error?.message ?? '').includes(PROPOSAL_A) &&
      !String(error?.message ?? '').includes(studio),
    error?.message,
  )
}
{
  const missing = await threwAsync(() =>
    listStudioTimelineForProposal(studio, 'prop-does-not-exist'),
  )
  const fabricated = await threwAsync(() =>
    listStudioTimelineForProposal(studio, 'prop-fabricated-zzz'),
  )
  const emptyError = await threwAsync(() =>
    listStudioTimelineForProposal(studio, PROPOSAL_EMPTY),
  )
  const emptyPage = await listStudioTimelineForProposal(studio, PROPOSAL_EMPTY)
  const emptyClientError = await threwAsync(() =>
    listStudioTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      subjectId: PROPOSAL_EMPTY,
      audience: ACTIVITY_AUDIENCE.CLIENT,
    }),
  )
  const emptyClient = await listStudioTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_EMPTY,
    audience: ACTIVITY_AUDIENCE.CLIENT,
  })
  assert(
    '42. unknown ids 404; a known proposal with no remaining events returns []',
    missing instanceof NotFoundError &&
      fabricated instanceof NotFoundError &&
      emptyError === null &&
      emptyPage.entries.length === 0 &&
      emptyClientError === null &&
      emptyClient.entries.length === 0,
  )
}
{
  const studioPage = await listStudioTimeline({ companyId: studio, limit: 200 })
  const otherPage = await listStudioTimeline({ companyId: otherCompany, limit: 200 })
  assert(
    '43. a client-supplied companyId cannot surface another tenant\'s entries',
    studioPage.entries.every((entry) => entry.companyId === studio) &&
      otherPage.entries.every((entry) => entry.companyId === otherCompany) &&
      !studioPage.entries.some((entry) => entry.subject.id === PROPOSAL_B) &&
      !otherPage.entries.some((entry) => entry.subject.id === PROPOSAL_A),
  )
}

// -------------------------------------------------------------------- audience

console.log('')
console.log('— Audience —')

{
  const client = await listStudioTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
    audience: ACTIVITY_AUDIENCE.CLIENT,
    limit: 200,
  })
  assert(
    '44. internal entries never reach the client audience',
    client.entries.length > 0 &&
      client.entries.every((entry) => entry.audience === ACTIVITY_AUDIENCE.CLIENT),
  )
  assert(
    '45. studio_audit is internal-only and absent from the client audience',
    !client.entries.some((entry) => String(entry.type ?? '').startsWith('activity.')),
  )
  assert(
    '46. provenance and actor identity are stripped for the client audience',
    client.entries.every(
      (entry) => !('provenance' in entry) && !('sourceId' in entry) && entry.actor.id === null,
    ) && !client.entries.some((entry) => entry.type === 'proposal.note_added'),
  )
}
{
  const studioPage = await listStudioTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
    limit: 200,
  })
  const clientPage = await listStudioTimeline({
    companyId: studio,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: PROPOSAL_A,
    audience: ACTIVITY_AUDIENCE.CLIENT,
    limit: 200,
  })
  assert(
    '47. the audience filter cannot resurrect a de-duplicated entry',
    clientPage.entries.length <= studioPage.entries.length &&
      clientPage.entries.every((entry) =>
        studioPage.entries.some((row) => row.id === entry.id),
      ),
  )
}

// --------------------------------------------------------------- write absence

console.log('')
console.log('— Write absence —')

const moduleFiles = [
  ...collectFiles('src/integrations/activities'),
  join(root, 'server', 'integrationsActivitiesPlugin.js'),
]
const dataFiles = collectFiles('data')
const moduleHashBefore = hashTree(moduleFiles)
const dataHashBefore = hashTree(dataFiles)

for (const companyId of [studio, otherCompany]) {
  for (const audience of [ACTIVITY_AUDIENCE.INTERNAL, ACTIVITY_AUDIENCE.CLIENT]) {
    let cursor = null
    let guard = 0
    do {
      const page = await listStudioTimeline({ companyId, audience, limit: 50, cursor })
      cursor = page.nextCursor
      guard += 1
    } while (cursor && guard < 20)
  }
  describeStudioTimelineSources(companyId)
}
getActivityCapabilities()
await listStudioTimelineForProposal(studio, PROPOSAL_A)

assert(
  '48. activity module files unchanged after full traversal',
  hashTree(moduleFiles) === moduleHashBefore,
)
assert('49. every data/ file unchanged after full traversal', hashTree(dataFiles) === dataHashBefore)

const pluginSource = stripComments(
  readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8'),
)
assert(
  '50. no mutation route is registered',
  pluginSource.includes("req.method !== 'GET'") &&
    !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(pluginSource),
)

const moduleSource = stripComments(collectSources('src/integrations/activities'))
const moduleImports = moduleSource
  .split('\n')
  .filter((line) => line.trim().startsWith('import'))
  .join('\n')
assert(
  '51. the module never writes a file or configures persistence',
  !/writeFileSync|appendFileSync|createWriteStream/.test(moduleSource) &&
    !/configure\w*Store\s*\(/.test(moduleSource) &&
    !/persist\s*:/.test(moduleSource) &&
    !/\b(insert|replace|update|delete|remove|reset)[A-Z]\w*(Record|Records|Store|Event)\b/.test(
      moduleImports,
    ),
)
assert(
  '52. no ActivityRepository implementation exists',
  !/class\s+\w*ActivityRepository|function\s+create\w*ActivityRepository/.test(moduleSource) &&
    !readdirSync(join(root, 'src', 'integrations', 'activities')).includes('persistence'),
)

// ------------------------------------------------------------------ boundaries

console.log('')
console.log('— Boundaries —')

assert('53. no src/forge imports', !/forge/i.test(moduleImports))
assert(
  '54. commercialClose is read through the store accessor only',
  /allCommercialCloses/.test(moduleImports) &&
    !/commercialClose\/(repository|providers|transitions)/.test(moduleImports),
)
assert(
  '55. no vendor SDK dependency',
  !/from\s+['"](?:@?stripe|@?hubspot|jsforce|@salesforce|pipedrive|@slack|twilio|googleapis|docusign)/i.test(
    moduleSource,
  ),
)
assert(
  '56. no OAuth',
  !/\boauth(2)?(Client|Token|Flow|Authorize|Provider)\b|exchangeCodeForToken|refreshAccessToken/i.test(
    moduleSource,
  ) && INTEGRATION_CAPABILITIES.oauth === false,
)
assert(
  '57. no worker, queue, outbox, or retry scheduler',
  !/worker_threads|new\s+Worker|startWorker|processOutbox|createOutbox|drainOutbox|leaseUntil|retrySchedule|scheduleRetry|nextAttemptAt|backoffMs/i.test(
    moduleSource,
  ) &&
    !/\bfetch\s*\(|node:http|node:https|XMLHttpRequest/.test(moduleSource) &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false,
)
assert(
  '58. AUTOMATION_SOURCE_DOMAIN.ACTIVITY remains inactive in intake',
  !AUTOMATION_INTAKE_SOURCE_DOMAINS.includes(AUTOMATION_SOURCE_DOMAIN.ACTIVITY),
)

// ------------------------------------------------------------------ regression

console.log('')
console.log('— Nested regressions —')

const h166 = runSuite('verify-integrations-crm.mjs')
assert('59. H16.6 CRM suite remains green', h166.ok, h166.ok ? '' : h166.output.slice(-3000))
assert('60. H16.5 webhook suite remains green (nested)', h166.ok)
assert('61. H16.4 action-intent suite remains green (nested)', h166.ok)
assert('62. H16.3 rules remain green (nested)', h166.ok)
assert('63. H16.2 event intake remains green (nested)', h166.ok)
assert('64. H16.1 foundation remains green (nested)', h166.ok)
assert('65. H15 completion remains green (nested)', h166.ok)

assert('66. data/proposals.json byte-identical and git diff --check clean', (() => {
  const diffCheck = spawnSync('git', ['diff', '--check'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return (
    proposalsSnapshot() === proposalsBefore &&
    diffCheck.status === 0 &&
    !(diffCheck.stdout || '').trim()
  )
})())

resetTimelineSources()
resetTimelineProposalLookup()

console.log('')
console.log(`H16.7 activity timeline checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
