/**
 * H16.1 Integration Foundation verification.
 *
 * Never writes data/proposals.json.
 * No vendor SDKs, OAuth, network I/O, delivery, or live webhooks.
 * H16.2 may enable eventIntake; H16.3 may enable automationRules.
 * Delivery/vendor/worker flags stay false.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { COMMERCIAL_CLOSE_CAPABILITIES } from '../src/commercialClose/types.js'
import {
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  INTEGRATION_REJECTION_REASON,
  INTEGRATION_STATUS,
  NULL_INTEGRATION_ADAPTER_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  assertIntegrationCompanyScope,
  assertNoSecretValues,
  evaluateIntegrationCompanyScope,
  getIntegrationAdapter,
  getIntegrationConfigForCompany,
  integrationConfigHasSecretMaterial,
  listIntegrationAdapters,
  listIntegrationConfigsForCompany,
  makeIntegrationConfig,
  makeSecretRefs,
  normalizeSecretRef,
  presentClientIntegrationConfig,
  presentStudioIntegrationConfig,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
  rejectIntegrationBoundary,
  resetIntegrationAdapterRegistry,
  resetIntegrationConfigStore,
  resolveEnabledIntegrationAdapter,
  serializeIntegrationConfig,
  upsertIntegrationConfigForCompany,
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

function collectIntegrationSources() {
  const base = join(root, 'src', 'integrations')
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) files.push(full)
    }
  }
  walk(base)
  return files
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
    status: result.status,
  }
}

const proposalsBefore = proposalsSnapshot()
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID

resetIntegrationConfigStore()
resetIntegrationAdapterRegistry()

console.log('— H16.1 capabilities —')
assert(
  '1. foundation capability is true',
  INTEGRATION_CAPABILITIES.integrationFoundation === true,
)

assert(
  '2. delivery/vendor/worker capabilities remain false (outboundWebhooks true in H16.5)',
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

assert(
  'kinds cover delivery/crm/calendar/messaging/outboundWebhook only',
  INTEGRATION_KINDS.length === 5 &&
    INTEGRATION_KINDS.includes(INTEGRATION_KIND.DELIVERY) &&
    INTEGRATION_KINDS.includes(INTEGRATION_KIND.CRM) &&
    INTEGRATION_KINDS.includes(INTEGRATION_KIND.CALENDAR) &&
    INTEGRATION_KINDS.includes(INTEGRATION_KIND.MESSAGING) &&
    INTEGRATION_KINDS.includes(INTEGRATION_KIND.OUTBOUND_WEBHOOK),
)

console.log('— Company isolation —')
let missingCompany = null
try {
  makeIntegrationConfig({ kind: INTEGRATION_KIND.CRM })
} catch (error) {
  missingCompany = error
}
assert(
  '3. config requires companyId',
  missingCompany instanceof ValidationError &&
    /companyId/i.test(missingCompany.message),
)

let crossCompany = null
try {
  assertIntegrationCompanyScope(studio, otherCompany)
} catch (error) {
  crossCompany = error
}
assert(
  '4. cross-company access is rejected',
  crossCompany instanceof ForbiddenError &&
    evaluateIntegrationCompanyScope(studio, otherCompany).reason ===
      INTEGRATION_REJECTION_REASON.COMPANY_MISMATCH,
)

const created = upsertIntegrationConfigForCompany(studio, {
  kind: INTEGRATION_KIND.DELIVERY,
  providerId: NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.DELIVERY],
  apiKeyRef: 'env:DELIVERY_API_KEY',
  webhookSecretRef: 'vault:companies/studio/delivery/webhook',
  accountId: 'acct-demo',
})

assert(
  'upsert scopes config to company',
  created.companyId === studio &&
    created.status === INTEGRATION_STATUS.CONFIGURED &&
    created.secretRefs.apiKeyRef === 'env:DELIVERY_API_KEY',
)

let foreignRead = null
try {
  getIntegrationConfigForCompany(otherCompany, created.id)
} catch (error) {
  foreignRead = error
}
assert(
  'cross-company get is rejected',
  foreignRead instanceof ForbiddenError,
)

assert(
  'list is company-filtered',
  listIntegrationConfigsForCompany(studio).length === 1 &&
    listIntegrationConfigsForCompany(otherCompany).length === 0,
)

console.log('— Secret refs / projections —')
const clientProjection = presentClientIntegrationConfig(created)
const studioProjection = presentStudioIntegrationConfig(created)
const serialized = serializeIntegrationConfig(created)

assert(
  '5. secret values cannot appear in client projections',
  !('secretRefs' in clientProjection) &&
    !('apiKeyRef' in clientProjection) &&
    !('webhookSecretRef' in clientProjection) &&
    !('accountId' in clientProjection) &&
    clientProjection.enabled === false &&
    !integrationConfigHasSecretMaterial(clientProjection),
)

assert(
  '6. secret references are allowed (studio + serialize)',
  studioProjection.secretRefs.apiKeyRef === 'env:DELIVERY_API_KEY' &&
    studioProjection.secretRefs.webhookSecretRef ===
      'vault:companies/studio/delivery/webhook' &&
    serialized.secretRefs.apiKeyRef === 'env:DELIVERY_API_KEY' &&
    normalizeSecretRef('secretref:delivery-key') === 'secretref:delivery-key',
)

let rawSecret = null
try {
  assertNoSecretValues({ apiKey: 'sk-live-forbidden' })
} catch (error) {
  rawSecret = error
}
let badRef = null
try {
  makeSecretRefs({ apiKeyRef: 'sk-live-forbidden' })
} catch (error) {
  badRef = error
}
assert(
  'raw secret values rejected',
  rawSecret instanceof ValidationError && badRef instanceof ValidationError,
)

console.log('— Null adapters / registry —')
const adapters = listIntegrationAdapters()
const nullAdapters = adapters.filter((adapter) => String(adapter.id).startsWith('null_'))
const httpWebhookAdapter = adapters.find(
  (adapter) => adapter.id === 'http_outbound_webhook',
)
assert(
  '7. null/disabled adapters remain safe defaults',
  NULL_INTEGRATION_ADAPTER_IDS.length === 5 &&
    nullAdapters.length === 5 &&
    nullAdapters.every((adapter) => adapter.isEnabled({}) === false) &&
    nullAdapters.every((adapter) => adapter.describe().enabled === false) &&
    nullAdapters.every((adapter) => adapter.describe().network === false) &&
    nullAdapters.every((adapter) => adapter.describe().oauth === false) &&
    httpWebhookAdapter != null &&
    adapters.length === 6,
)

assert(
  '8. adapter registry is vendor-neutral',
  adapters.every(
    (adapter) =>
      String(adapter.id).startsWith('null_') ||
      adapter.id === 'http_outbound_webhook',
  ) &&
    !adapters.some((adapter) =>
      /salesforce|hubspot|slack|stripe|docusign|twilio|whatsapp|google|outlook/i.test(
        adapter.id,
      ),
    ) &&
    httpWebhookAdapter.describe().vendorNeutral === true &&
    httpWebhookAdapter.describe().oauth === false,
)

const resolved = resolveEnabledIntegrationAdapter(
  INTEGRATION_KIND.CRM,
  NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CRM],
  { enabled: true, companyId: studio },
)
assert(
  'enabled config still resolves disabled null adapter',
  resolved.ok === false &&
    resolved.reason === INTEGRATION_REJECTION_REASON.DISABLED_ADAPTER &&
    getIntegrationAdapter(
      INTEGRATION_KIND.MESSAGING,
      NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.MESSAGING],
    ) != null,
)

console.log('— Source / boundary honesty —')
const integrationSourceFiles = collectIntegrationSources()
const nonWebhookSources = integrationSourceFiles
  .filter((file) => !file.replace(/\\/g, '/').includes('/webhooks/'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const integrationSources = integrationSourceFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const webhookSources = integrationSourceFiles
  .filter((file) => file.replace(/\\/g, '/').includes('/webhooks/'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

const vendorSdkPattern =
  /from\s+['"](?:@?stripe|@hubspot|hubspot|jsforce|@salesforce|@slack\/web-api|twilio|googleapis|@microsoft\/microsoft-graph-client|docusign|@docusign)/i
const networkCallPattern =
  /\bfetch\s*\(|\baxios\b|\bhttp\.request\b|\bhttps\.request\b|\bXMLHttpRequest\b|\bnode:https\b|\bnode:http\b/
const oauthImplPattern =
  /\boauth(2)?(Client|Token|Flow|Authorize|Provider)\b|\bexchangeCodeForToken\b|\brefreshAccessToken\b/i
const webhookIngressPattern =
  /fastify\.(post|put|route)|app\.(post|put)|createServer\(|\.listen\s*\(/i
const commercialCloseProviderImport =
  /commercialClose\/providers|from\s+['"].*commercialClose\/providers/i

assert(
  '9. no vendor SDK imports',
  !vendorSdkPattern.test(integrationSources),
)

assert(
  '10. no OAuth implementation',
  !oauthImplPattern.test(integrationSources) &&
    INTEGRATION_CAPABILITIES.oauth === false,
)

assert(
  '11. network I/O confined to H16.5 webhooks transport',
  !networkCallPattern.test(nonWebhookSources) &&
    (webhookSources.length === 0 || networkCallPattern.test(webhookSources)),
)

assert(
  '12. no live webhook HTTP ingress',
  !webhookIngressPattern.test(integrationSources) &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

assert(
  'H16 adapters do not import H15.6 commercialClose/providers',
  !commercialCloseProviderImport.test(integrationSources),
)

function pathExists(relativePath) {
  try {
    readdirSync(join(root, relativePath))
    return true
  } catch {
    try {
      readFileSync(join(root, relativePath))
      return true
    } catch {
      return false
    }
  }
}

assert(
  'foundation file layout stays minimal (no outbox/delivery/crm/calendar/messaging)',
  !integrationSources.includes('processOutbox') &&
    !pathExists('src/integrations/outbox') &&
    !pathExists('src/integrations/delivery') &&
    !pathExists('src/integrations/crm') &&
    !pathExists('src/integrations/calendar') &&
    !pathExists('src/integrations/messaging'),
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
  'boundary: cannot transition CommercialClose',
  closeRefuse instanceof ForbiddenError &&
    rejectIntegrationBoundary('commercial_close').reason ===
      INTEGRATION_REJECTION_REASON.BOUNDARY_VIOLATION,
)
assert(
  'boundary: cannot mutate decision snapshots',
  decisionRefuse instanceof ForbiddenError,
)
assert(
  'boundary: cannot mutate proposal authored content',
  proposalRefuse instanceof ForbiddenError,
)

assert(
  '14. Forge remains read/project-only (no integration execution caps)',
  FORGE_CAPABILITIES.thirdPartyIntegrations === false &&
    FORGE_CAPABILITIES.crm === false &&
    FORGE_CAPABILITIES.emailDelivery === false &&
    FORGE_CAPABILITIES.whatsapp === false &&
    !sourceOf('src', 'forge', 'index.js').includes('integrations') &&
    !sourceOf('src', 'forge', 'repository.js').includes('integrations'),
)

assert(
  'H15 commercial-close vendor flags remain false',
  COMMERCIAL_CLOSE_CAPABILITIES.externalWebhooks === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.crm === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.thirdPartyIntegrations === false,
)

assert(
  '15. data/proposals.json byte-identical so far',
  proposalsSnapshot() === proposalsBefore,
)

console.log('')
console.log('— H15.1–H15.7 regression suites —')
// Tip of the H15 verify chain: completion → providers → contract-invoice → …
// Running every suite separately would exponentially re-run nested children.
const h15Tip = 'verify-commercial-close-completion.mjs'
const h15Result = runSuite(h15Tip)
assert(
  `13. nested ${h15Tip}`,
  h15Result.ok,
  h15Result.ok ? '' : h15Result.output.slice(-1200),
)
assert('13. H15.1–H15.7 verification remains green', h15Result.ok)

assert(
  '15 final. data/proposals.json unchanged',
  proposalsSnapshot() === proposalsBefore,
)

console.log('')
console.log(`H16.1 integration foundation checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
