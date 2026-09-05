import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeProposal } from '../src/models/proposal.js'
import { analyzeProposalHealth } from '../src/insights/index.js'
import { analyzeProposal } from '../src/intelligence/index.js'
import { analyzeConsistency } from '../src/consistency/index.js'
import { analyzeProposalCoaching } from '../src/coach/index.js'
import { applyImprovement } from '../src/improve/apply.js'
import { generateMockImprovement } from '../src/improve/providers/mock.js'
import { ValidationError } from '../src/services/errors.js'
import { ImproveError, IMPROVE_ERROR_CODE } from '../src/improve/errors.js'
import {
  DEFAULT_COMPANY_ID,
  DEMO_ISOLATION_COMPANY_ID,
  KNOWLEDGE_STATUS,
  resetKnowledgeStore,
} from '../src/knowledge/index.js'
import {
  assertRequiredInputs,
  buildFactLedger,
  buildProposalGenerationContext,
  generateProposal,
  GENERATOR_CAPABILITIES,
  parseGeneratedProposal,
  planProposalSections,
  proposalFromGeneratedDraft,
  requiredInputErrors,
  retrieveGenerationKnowledge,
  UNRESOLVED_FACT,
  validateGeneratedFacts,
} from '../src/generate/index.js'
import { FACT_SOURCE } from '../src/generate/types.js'

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

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const env = { AI_PROVIDER: 'mock' }
const studio = DEFAULT_COMPANY_ID
const other = DEMO_ISOLATION_COMPANY_ID

resetKnowledgeStore()

const baseInputs = {
  companyId: studio,
  proposalType: 'Architectural Model',
  clientName: 'Marcus Reyes',
  industry: 'Architecture',
  primaryObjective: 'Present a presentation model for a waterfront pavilion.',
}

assert(
  'Test 1 — Required inputs',
  requiredInputErrors({}).length >= 3 &&
    (() => {
      try {
        assertRequiredInputs({})
        return false
      } catch (error) {
        return error instanceof ValidationError
      }
    })(),
)

const ledger = buildFactLedger({
  proposalInputs: { ...baseInputs, pricing: '$12,000' },
  knowledgeItems: [
    {
      id: 'know-user-test',
      title: 'Company Profile',
      content: 'Independent studio.',
      type: 'company_profile',
    },
  ],
})
assert(
  'Test 2 — Fact ledger distinguishes sources',
  ledger.userFacts.every((entry) => entry.source === FACT_SOURCE.USER) &&
    ledger.knowledgeFacts.every((entry) => entry.source === FACT_SOURCE.KNOWLEDGE) &&
    ledger.knowledgeFacts[0].knowledgeId === 'know-user-test',
)

const knowledge = retrieveGenerationKnowledge({
  companyId: studio,
  proposalInputs: baseInputs,
})
const knowledgeIds = new Set(knowledge.items.map((item) => item.id))
assert(
  'Test 3 — Draft knowledge never enters generation context',
  !knowledgeIds.has('know-demo-studio-draft-faq'),
)
assert(
  'Test 3b — Archived knowledge never enters generation context',
  !knowledgeIds.has('know-demo-studio-archived-assumption'),
)
assert(
  'Test 3c — Approved knowledge can enter generation context',
  knowledge.items.length > 0 &&
    knowledge.items.every((item) => item.status === KNOWLEDGE_STATUS.APPROVED),
)

const sneaky = buildProposalGenerationContext({
  companyId: studio,
  proposalInputs: baseInputs,
  knowledgeContext: {
    companyId: studio,
    items: [
      {
        id: 'know-demo-studio-draft-faq',
        title: 'Draft FAQ',
        content: 'Should never appear',
        status: KNOWLEDGE_STATUS.DRAFT,
        companyId: studio,
      },
    ],
  },
})
assert(
  'Test 3d — Injected draft knowledge is rejected',
  !sneaky.knowledgeIds.includes('know-demo-studio-draft-faq'),
)

const studioCtx = buildProposalGenerationContext({
  companyId: studio,
  proposalInputs: baseInputs,
})
const otherCtx = buildProposalGenerationContext({
  companyId: other,
  proposalInputs: { ...baseInputs, companyId: other, clientName: 'Harborline' },
})
assert(
  'Test 4 — Company isolation',
  !studioCtx.knowledge.items.some((item) => /Harborline/i.test(item.title + item.content)) &&
    otherCtx.knowledge.items.every((item) => !item.companyId || item.companyId === other),
)

const generated = await generateProposal(baseInputs, env)
const blob = JSON.stringify(generated.draft)
assert(
  'Test 5 — Missing price stays unresolved',
  blob.includes(UNRESOLVED_FACT) && !/\$45,000/.test(blob) && !generated.created,
)
assert(
  'Test 5b — Missing timeline stays unresolved',
  /To be confirmed/i.test(blob) && generated.warnings.some((row) => row.code === 'missing_timeline'),
)

const parsed = parseGeneratedProposal({
  title: 'Architectural Model proposal for Marcus Reyes',
  metadata: { proposalType: 'Architectural Model', clientName: 'Marcus Reyes', industry: 'Architecture' },
  sections: [
    { type: 'executive_summary', title: 'Executive summary', blocks: [{ body: 'Known facts only.' }] },
  ],
  assumptions: [],
  exclusions: [],
  sources: [{ id: 'know-demo-studio-profile', title: 'Company Profile' }],
})
assert('Test 6 — Structured output', parsed.title.includes('Marcus Reyes') && parsed.sections.length === 1)

let malformed = false
try {
  parseGeneratedProposal('not-json')
} catch (error) {
  malformed = error instanceof ImproveError && error.code === IMPROVE_ERROR_CODE.MALFORMED
}
assert('Test 7 — Invalid output fails safely', malformed)

const generateSrc = read('src/generate/ai.js')
const pluginSrc = read('server/aiPlugin.js')
assert(
  'Test 8 — Provider reuse',
  generateSrc.includes("from '../improve/engine.js'") &&
    generateSrc.includes('loadAiProvider') &&
    pluginSrc.includes('/api/ai/generate-proposal') &&
    !read('src/generate/ai.js').includes('api.openai.com') &&
    !read('src/generate/client.js').includes('OPENAI_API_KEY'),
)

const abort = new AbortController()
abort.abort()
let cancelled = false
try {
  await generateProposal(baseInputs, env, { signal: abort.signal })
} catch (error) {
  cancelled = error.code === IMPROVE_ERROR_CODE.CANCELLED
}
assert('Test 9 — Cancellation creates no proposal', cancelled && generated.created === false)

assert(
  'Test 10 — Retry reuses inputs without creating',
  generated.created === false &&
    (await generateProposal(baseInputs, env)).created === false,
)

assert(
  'Test 11 — Source tracking',
  Array.isArray(generated.knowledgeIds) &&
    generated.knowledgeIds.length > 0 &&
    generated.activity.knowledgeIds.length > 0 &&
    generated.draft.knowledgeUsed.some((item) => item.title),
)

const proposal = makeProposal(proposalFromGeneratedDraft({
  draft: generated.draft,
  context: studioCtx,
  generation: generated.proposalPayload.generation,
}))
assert(
  'Test 12 — Proposal creation uses normal model',
  proposal.title &&
    proposal.clientName === 'Marcus Reyes' &&
    Array.isArray(proposal.blocks) &&
    proposal.blocks.length > 0 &&
    proposal.status === 'draft' &&
    proposal.generation?.knowledgeIdsUsed?.length > 0,
)

const health = analyzeProposalHealth({ proposal, blocks: proposal.blocks })
const diagnostics = [...(health.warnings ?? []), ...(health.suggestions ?? [])]
const intelligence = analyzeProposal({ proposal, diagnostics, health })
const consistency = analyzeConsistency({ proposal, blocks: proposal.blocks, health })
const coach = analyzeProposalCoaching({
  proposal,
  health,
  diagnostics,
  intelligence,
  consistency,
})
const mockImprove = generateMockImprovement({
  proposal,
  finding: diagnostics[0] ?? { code: 'weak_summary', title: 'Summary' },
})
assert(
  'Test 13 — Existing analysis works on generated proposals',
  Number.isFinite(health.overallScore) &&
    Array.isArray(intelligence.findings) &&
    Number.isFinite(consistency.score) &&
    Array.isArray(coach.items) &&
    typeof applyImprovement === 'function' &&
    Boolean(mockImprove?.previewBody),
)

const review = validateGeneratedFacts(
  {
    title: 'Test',
    sections: [
      {
        type: 'pricing',
        title: 'Pricing',
        blocks: [{ body: 'This engagement is $45,000 with a 24 month warranty and ISO 9001 certification guaranteed.' }],
      },
    ],
  },
  buildFactLedger({ proposalInputs: baseInputs }),
)
assert(
  'Test 14 — Unsupported facts trigger review warnings',
  review.reviewRequired &&
    review.issues.some((issue) => issue.code === 'currency_amount') &&
    review.issues.some((issue) => issue.code === 'certification'),
)

const css = read('src/pages/ProposalAi/ProposalAi.module.css')
assert(
  'Test 15 — Mobile overflow guards',
  css.includes('min-width: 0') &&
    css.includes('overflow-x: hidden') &&
    css.includes('max-width: 390px') &&
    css.includes('overflow-wrap: anywhere'),
)

const clientSrc = read('src/generate/client.js')
const resultJson = JSON.stringify(generated)
assert(
  'Test 16 — No secrets in browser-facing result',
  !clientSrc.includes('API_KEY') &&
    !clientSrc.includes('sk-') &&
    !resultJson.includes('OPENAI_API_KEY') &&
    !resultJson.includes('systemPrompt') &&
    !Object.prototype.hasOwnProperty.call(generated, 'prompts'),
)

const plan = planProposalSections({
  proposalType: 'Brand Identity',
  availableFacts: buildFactLedger({ proposalInputs: { ...baseInputs, proposalType: 'Brand Identity' } }),
  availableKnowledge: [],
})
assert(
  'Section planner is type-aware',
  plan.sections.some((section) => section.id === 'client_objectives') &&
    plan.sections.some((section) => section.id === 'next_steps'),
)

assert('Forge remains unimplemented', GENERATOR_CAPABILITIES.forge === false)
assert('RAG remains unimplemented', GENERATOR_CAPABILITIES.rag === false)

console.log('')
console.log(`Generator verify: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
