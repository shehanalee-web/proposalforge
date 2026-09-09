/**
 * H16.2 Event Intake / Normalization verification.
 *
 * Never writes data/proposals.json.
 * Persisted receipt ledger is for idempotency only — not an outbox/worker.
 */
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { COMMERCIAL_CLOSE_CAPABILITIES } from '../src/commercialClose/types.js'
import {
  insertLivingEngagementEvent,
  makeLivingEngagementEvent,
  resetLivingEventStore,
  resetLivingEventListeners,
  emitLivingEvent,
  LIVING_EVENT,
} from '../src/living/index.js'
import { emitFollowupEvent, FOLLOWUP_EVENT } from '../src/followup/index.js'
import { emitWorkflowEvent, WORKFLOW_EVENT } from '../src/workflow/index.js'
import { emitPortalEvent, PORTAL_EVENT } from '../src/portal/index.js'
import { emitInteractionEvent, INTERACTION_EVENT } from '../src/interactions/index.js'
import {
  INTEGRATION_CAPABILITIES,
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_SOURCE_DOMAIN,
  configureAutomationIntakeStore,
  ingestAutomationEvent,
  listAcceptedAutomationEventsForCompany,
  getAutomationEventById,
  normalizeDomainEvent,
  resetAutomationIntakeStore,
  replaceAutomationIntakeLedger,
  serializeAutomationIntakeLedger,
  startAutomationEventIntake,
  stopAutomationEventIntake,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
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

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI || '1' },
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  }
}

const proposalsBefore = proposalsSnapshot()
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const tempDir = mkdtempSync(join(tmpdir(), 'pf-h162-'))
const ledgerFile = join(tempDir, 'automation-intake.json')

function persistLedger(ledger) {
  writeFileSync(
    ledgerFile,
    `${JSON.stringify(
      {
        receipts: ledger?.receipts ?? [],
        events: ledger?.events ?? [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

function reloadLedgerFromDisk() {
  const raw = JSON.parse(readFileSync(ledgerFile, 'utf8'))
  resetAutomationIntakeStore({ receipts: [], events: [] })
  replaceAutomationIntakeLedger(raw)
}

resetLivingEventListeners()
resetLivingEventStore()
resetAutomationIntakeStore({ receipts: [], events: [] })
configureAutomationIntakeStore({ persist: persistLedger })
persistLedger(serializeAutomationIntakeLedger())
startAutomationEventIntake()

console.log('— Capabilities —')
assert('eventIntake === true', INTEGRATION_CAPABILITIES.eventIntake === true)
assert(
  'delivery/vendor/worker capabilities remain false (outboundWebhooks true in H16.5)',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.crm === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.outboundWebhooks === true &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

console.log('— Living normalization + subscription —')
const livingRecord = insertLivingEngagementEvent(
  makeLivingEngagementEvent({
    companyId: studio,
    proposalId: 'prop-h162',
    shareToken: 'share-h162',
    type: LIVING_EVENT.PROPOSAL_OPENED,
    sessionId: 'sess-h162',
  }),
)
emitLivingEvent(LIVING_EVENT.PROPOSAL_OPENED, {
  proposalId: livingRecord.proposalId,
  shareToken: livingRecord.shareToken,
  sessionId: livingRecord.sessionId,
  eventId: livingRecord.id,
})

const livingAccepted = listAcceptedAutomationEventsForCompany(studio)
assert(
  'living event normalizes via subscription',
  livingAccepted.some(
    (event) =>
      event.type === 'living.proposal_opened' &&
      event.source.domain === AUTOMATION_SOURCE_DOMAIN.LIVING &&
      event.source.eventId === livingRecord.id &&
      event.correlation.proposalId === 'prop-h162' &&
      event.idempotencyKey === `${studio}|living|${livingRecord.id}`,
  ),
)

const livingDirect = ingestAutomationEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.LIVING,
  busEvent: {
    type: LIVING_EVENT.PROPOSAL_OPENED,
    at: livingRecord.at,
    proposalId: livingRecord.proposalId,
    shareToken: livingRecord.shareToken,
    payload: { eventId: livingRecord.id, companyId: studio },
  },
})
assert(
  'duplicate living intake returns existing event',
  livingDirect.duplicate === true &&
    livingDirect.status === AUTOMATION_INTAKE_STATUS.DUPLICATE &&
    livingDirect.event?.id ===
      livingAccepted.find((e) => e.source.eventId === livingRecord.id)?.id &&
    listAcceptedAutomationEventsForCompany(studio).filter(
      (e) => e.source.eventId === livingRecord.id,
    ).length === 1,
)

console.log('— Follow-up / workflow / portal / interaction fan-out —')
emitFollowupEvent({
  type: FOLLOWUP_EVENT.CREATED,
  companyId: studio,
  followupId: 'fu-h162',
  id: 'fu-h162',
  proposalId: 'prop-h162',
  title: 'Follow up',
  reason: 'manual',
})
assert(
  'follow-up event normalizes correctly',
  listAcceptedAutomationEventsForCompany(studio).some(
    (event) =>
      event.type === 'followup.created' &&
      event.correlation.followupId === 'fu-h162' &&
      event.idempotencyKey === `${studio}|followup|followup.created:fu-h162`,
  ),
)

emitWorkflowEvent({
  id: 'wfev-h162',
  companyId: studio,
  proposalId: 'prop-h162',
  type: WORKFLOW_EVENT.STATUS_CHANGED,
  from: 'draft',
  to: 'in_review',
  actorId: 'user-1',
  createdAt: new Date().toISOString(),
})
assert(
  'workflow stub fans out',
  listAcceptedAutomationEventsForCompany(studio).some(
    (event) =>
      event.type === 'workflow.status_changed' &&
      event.source.eventId === 'wfev-h162' &&
      event.payload.from === 'draft' &&
      event.payload.to === 'in_review',
  ),
)

emitPortalEvent({
  id: 'pev-h162',
  companyId: studio,
  proposalId: 'prop-h162',
  portalId: 'portal-h162',
  type: PORTAL_EVENT.PUBLISHED,
  createdAt: new Date().toISOString(),
})
assert(
  'portal stub fans out',
  listAcceptedAutomationEventsForCompany(studio).some(
    (event) =>
      event.type === 'portal.published' && event.source.eventId === 'pev-h162',
  ),
)

emitInteractionEvent({
  id: 'iact-h162',
  companyId: studio,
  proposalId: 'prop-h162',
  interactionId: 'intr-h162',
  type: INTERACTION_EVENT.CREATED,
  createdAt: new Date().toISOString(),
})
assert(
  'interaction stub fans out',
  listAcceptedAutomationEventsForCompany(studio).some(
    (event) =>
      event.type === 'interaction.created' &&
      event.source.entityId === 'intr-h162',
  ),
)

const engagementMirrorIgnored = normalizeDomainEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.INTERACTION,
  companyId: studio,
  rawEvent: {
    type: 'comment_added',
    id: 'intr-mirror',
    companyId: studio,
  },
})
assert(
  'canonical-source duplicate behavior works',
  engagementMirrorIgnored.status === AUTOMATION_INTAKE_STATUS.IGNORED &&
    engagementMirrorIgnored.reason ===
      AUTOMATION_INTAKE_REASON.CANONICAL_SOURCE_ELSEWHERE,
)

console.log('— Isolation / validation —')
const missingCompany = normalizeDomainEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.FOLLOWUP,
  rawEvent: { type: FOLLOWUP_EVENT.CREATED, followupId: 'x' },
})
assert(
  'companyId required',
  missingCompany.status === AUTOMATION_INTAKE_STATUS.REJECTED &&
    missingCompany.reason === AUTOMATION_INTAKE_REASON.COMPANY_REQUIRED,
)

let crossCompany = null
try {
  getAutomationEventById(
    otherCompany,
    listAcceptedAutomationEventsForCompany(studio)[0].id,
  )
} catch (error) {
  crossCompany = error
}
assert(
  'cross-company access rejected',
  crossCompany instanceof ForbiddenError &&
    listAcceptedAutomationEventsForCompany(otherCompany).length === 0,
)

const malformed = normalizeDomainEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.WORKFLOW,
  companyId: studio,
  rawEvent: { companyId: studio },
})
assert(
  'malformed event rejected',
  malformed.status === AUTOMATION_INTAKE_STATUS.REJECTED &&
    malformed.reason === AUTOMATION_INTAKE_REASON.MALFORMED_EVENT,
)

const unsupported = normalizeDomainEvent({
  sourceDomain: 'unknown_domain',
  companyId: studio,
  rawEvent: { type: 'x', id: '1', companyId: studio },
})
assert(
  'unsupported event gets stable rejected result',
  unsupported.status === AUTOMATION_INTAKE_STATUS.REJECTED &&
    unsupported.reason === AUTOMATION_INTAKE_REASON.UNSUPPORTED_DOMAIN,
)

const providerForbidden = normalizeDomainEvent({
  sourceDomain: 'provider_webhook',
  companyId: studio,
  providerEventId: 'pev',
  rawBody: '{}',
  rawVerified: true,
})
assert(
  'H15.6 provider ownership remains intact (raw provider rejected)',
  providerForbidden.reason ===
    AUTOMATION_INTAKE_REASON.PROVIDER_WEBHOOK_FORBIDDEN,
)

console.log('— Sanitization / namespace —')
const dirty = normalizeDomainEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.FOLLOWUP,
  companyId: studio,
  rawEvent: {
    type: FOLLOWUP_EVENT.CREATED,
    followupId: 'fu-clean',
    companyId: studio,
    title: 'ok',
    apiKey: 'sk-secret',
    secretRefs: { apiKeyRef: 'env:X' },
    proposal: { blocks: [] },
  },
})
assert(
  'stable normalized type namespace + sanitized payload',
  dirty.ok &&
    dirty.event.type === 'followup.created' &&
    dirty.event.payload.title === 'ok' &&
    dirty.event.payload.apiKey == null &&
    dirty.event.payload.secretRefs == null &&
    dirty.event.payload.proposal == null &&
    dirty.event.schemaVersion === 1,
)

console.log('— Persisted receipt idempotency —')
const beforeReloadCount = listAcceptedAutomationEventsForCompany(studio).length
const snapshot = serializeAutomationIntakeLedger()
persistLedger(snapshot)
reloadLedgerFromDisk()
configureAutomationIntakeStore({ persist: persistLedger })

const afterReload = listAcceptedAutomationEventsForCompany(studio)
assert(
  'ledger survives process-style reload',
  afterReload.length === beforeReloadCount && afterReload.length > 0,
)

const dupAfterReload = ingestAutomationEvent({
  sourceDomain: AUTOMATION_SOURCE_DOMAIN.LIVING,
  busEvent: {
    type: LIVING_EVENT.PROPOSAL_OPENED,
    proposalId: livingRecord.proposalId,
    payload: { eventId: livingRecord.id },
  },
})
assert(
  'duplicate remains detected after persisted receipt reload',
  dupAfterReload.duplicate === true &&
    dupAfterReload.status === AUTOMATION_INTAKE_STATUS.DUPLICATE &&
    listAcceptedAutomationEventsForCompany(studio).filter(
      (e) => e.source.eventId === livingRecord.id,
    ).length === 1,
)

console.log('— Hard boundaries —')
let closeRefuse = null
try {
  refuseCommercialCloseMutation('transition CommercialClose')
} catch (error) {
  closeRefuse = error
}
let decisionRefuse = null
try {
  refuseDecisionSnapshotMutation()
} catch (error) {
  decisionRefuse = error
}
let proposalRefuse = null
try {
  refuseProposalContentMutation()
} catch (error) {
  proposalRefuse = error
}
assert(
  'H15 CommercialClose is never mutated by intake boundaries',
  closeRefuse instanceof ForbiddenError &&
    decisionRefuse instanceof ForbiddenError &&
    proposalRefuse instanceof ForbiddenError,
)

assert(
  'Forge remains read/project-only',
  FORGE_CAPABILITIES.thirdPartyIntegrations === false &&
    FORGE_CAPABILITIES.crm === false &&
    FORGE_CAPABILITIES.emailDelivery === false &&
    !sourceOf('src', 'forge', 'repository.js').includes('ingestAutomationEvent') &&
    !sourceOf('src', 'forge', 'repository.js').includes('integrations/events'),
)

assert(
  'H15 vendor flags remain false',
  COMMERCIAL_CLOSE_CAPABILITIES.externalWebhooks === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === false,
)

const eventsSrc = sourceOf('src', 'integrations', 'events', 'intake.js')
  + sourceOf('src', 'integrations', 'events', 'normalize.js')
  + sourceOf('src', 'integrations', 'events', 'store.js')
  + sourceOf('src', 'integrations', 'events', 'subscribe.js')
  + sourceOf('src', 'integrations', 'events', 'fanout.js')

assert(
  'no outbox / workers / delivery / vendor SDKs / OAuth / network / live webhook ingress in intake',
  !eventsSrc.includes('processOutbox') &&
    !eventsSrc.includes('Bull') &&
    !/from\s+['"](?:@?stripe|hubspot|jsforce|@slack|twilio|docusign)/i.test(
      eventsSrc,
    ) &&
    !/\bfetch\s*\(|\baxios\b/.test(eventsSrc) &&
    !sourceOf('server', 'integrationsIntakePlugin.js').includes('fastify.post') &&
    !sourceOf('src', 'integrations', 'events', 'normalize.js').includes(
      'commercialClose/providers',
    ) &&
    !sourceOf('src', 'commercialClose', 'providers', 'webhook.js').includes(
      'ingestAutomationEvent',
    ) &&
    !eventsSrc.includes('createManualFollowup') &&
    !eventsSrc.includes('commercialClose'),
)

assert(
  'living does not import integrations',
  !sourceOf('src', 'living', 'events.js').includes('integrations') &&
    !sourceOf('src', 'living', 'eventRepository.js').includes('integrations'),
)

assert(
  'data/proposals.json byte-identical so far',
  proposalsSnapshot() === proposalsBefore,
)

stopAutomationEventIntake()

console.log('')
console.log('— Nested H16.1 + H15 regressions —')
const h161 = runSuite('verify-integrations-foundation.mjs')
assert(
  'H16.1 verification remains green',
  h161.ok,
  h161.ok ? '' : h161.output.slice(-1200),
)

const h15 = runSuite('verify-commercial-close-completion.mjs')
assert(
  'H15.1–H15.7 verification remains green',
  h15.ok,
  h15.ok ? '' : h15.output.slice(-1200),
)

assert(
  'final. data/proposals.json unchanged',
  proposalsSnapshot() === proposalsBefore,
)

try {
  rmSync(tempDir, { recursive: true, force: true })
} catch {
  /* ignore */
}

console.log('')
console.log(`H16.2 event intake checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
