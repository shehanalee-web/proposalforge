import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  approveKnowledgeItem,
  archiveKnowledgeItem,
  createKnowledgeItem,
  DEFAULT_COMPANY_ID,
  DEMO_ISOLATION_COMPANY_ID,
  findPossibleDuplicates,
  getCompanyKnowledge,
  getKnowledgeContext,
  KNOWLEDGE_CAPABILITIES,
  KNOWLEDGE_STATUS,
  resetKnowledgeStore,
  saveProposalContentAsKnowledge,
  searchCompanyKnowledge,
} from '../src/knowledge/index.js'
import { ValidationError } from '../src/services/errors.js'
import { resolveCompanyVoice } from '../src/coach/context.js'

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

resetKnowledgeStore()

const studio = DEFAULT_COMPANY_ID
const other = DEMO_ISOLATION_COMPANY_ID

const studioHits = searchCompanyKnowledge({ companyId: studio, query: 'Harborline' })
const otherHits = searchCompanyKnowledge({ companyId: other, query: 'Harborline' })
assert(
  'Test 1 — Company isolation',
  studioHits.length === 0 && otherHits.some((item) => item.companyId === other),
  `studio=${studioHits.length} other=${otherHits.length}`,
)

const leaked = getCompanyKnowledge({ companyId: studio, includeArchived: true }).some(
  (item) => item.companyId !== studio || item.title.includes('Harborline'),
)
assert('Test 1b — List never leaks Company B', !leaked)

const context = getKnowledgeContext({ companyId: studio, query: 'shipping FAQ warranty' })
const contextIds = new Set(context.items.map((item) => item.id))
assert(
  'Test 2 — Draft excluded from approved context',
  !contextIds.has('know-demo-studio-draft-faq'),
)
assert(
  'Test 2b — Archived excluded from approved context',
  !contextIds.has('know-demo-studio-archived-assumption'),
)
assert(
  'Test 2c — Approved included in context',
  contextIds.has('know-demo-studio-warranty') ||
    context.items.some((item) => item.status === KNOWLEDGE_STATUS.APPROVED),
)
assert(
  'Test 2d — Context items are approved only',
  context.items.every((item) => item.status === KNOWLEDGE_STATUS.APPROVED),
)

const titleHit = searchCompanyKnowledge({ companyId: studio, query: 'Company Profile' })
const contentHit = searchCompanyKnowledge({ companyId: studio, query: 'waterfront pavilion' })
const tagHit = searchCompanyKnowledge({ companyId: studio, query: 'terminology' })
const categoryHit = searchCompanyKnowledge({
  companyId: studio,
  query: 'legal',
  categories: ['legal'],
})
assert('Test 3 — Search title', titleHit[0]?.id === 'know-demo-studio-profile' && titleHit[0].relevance.match === 'title')
assert('Test 3b — Search content', contentHit.some((item) => item.id === 'know-demo-studio-case-study'))
assert('Test 3c — Search tags', tagHit.some((item) => item.id === 'know-demo-studio-terms'))
assert('Test 3d — Search category', categoryHit.length > 0)
assert(
  'Test 3e — Ranking is deterministic',
  JSON.stringify(titleHit.map((item) => item.id)) ===
    JSON.stringify(searchCompanyKnowledge({ companyId: studio, query: 'Company Profile' }).map((item) => item.id)),
)

const first = createKnowledgeItem({
  companyId: studio,
  title: 'Unique warranty clone',
  content: 'Workmanship is warranted for exactly 18 months against manufacture defects only.',
  type: 'warranty',
  category: 'legal',
})
const dupesBefore = findPossibleDuplicates({
  companyId: studio,
  title: 'Unique warranty clone',
  content: 'Workmanship is warranted for exactly 18 months against manufacture defects only.',
  excludeId: 'not-the-first',
})
const second = createKnowledgeItem({
  companyId: studio,
  title: 'Unique warranty clone',
  content: 'Workmanship is warranted for exactly 18 months against manufacture defects only.',
  type: 'warranty',
  category: 'legal',
})
const afterCount = getCompanyKnowledge({
  companyId: studio,
  query: 'Unique warranty clone',
  includeArchived: true,
}).length
assert('Test 4 — Duplicate warning', second.metadata.possibleDuplicate === true && dupesBefore.length >= 1)
assert('Test 4b — No automatic merge', first.id !== second.id && afterCount >= 2)

const saved = saveProposalContentAsKnowledge({
  companyId: studio,
  proposalId: 'prop-demo-1',
  block: {
    id: 'blk-1',
    type: 'executive-summary',
    data: { body: 'We will deliver the agreed model package in one revision round.' },
  },
  title: 'Proposal summary wording',
})
assert('Test 5 — Proposal save creates draft', saved.status === KNOWLEDGE_STATUS.DRAFT)
assert(
  'Test 5b — Proposal save is not auto-approved',
  saved.approvedAt == null && saved.source === 'extracted_from_proposal',
)
const savedInContext = getKnowledgeContext({
  companyId: studio,
  query: 'agreed model package',
}).items.some((item) => item.id === saved.id)
assert('Test 5c — Draft proposal knowledge excluded from context', !savedInContext)

const approved = approveKnowledgeItem({
  companyId: studio,
  id: saved.id,
  approvedBy: 'reviewer',
})
assert('Test 6 — Approve makes eligible', approved.status === KNOWLEDGE_STATUS.APPROVED)
const afterApprove = getKnowledgeContext({
  companyId: studio,
  query: 'agreed model package',
})
assert(
  'Test 6b — Approved item appears in context',
  afterApprove.items.some((item) => item.id === saved.id),
)

const archived = archiveKnowledgeItem({ companyId: studio, id: saved.id })
assert('Test 7 — Archive status', archived.status === 'archived')
const afterArchive = getKnowledgeContext({
  companyId: studio,
  query: 'agreed model package',
})
assert(
  'Test 7b — Archived disappears from approved context',
  !afterArchive.items.some((item) => item.id === saved.id),
)

const voice = resolveCompanyVoice({
  companyTone: 'calm and specific',
  brandVoice: 'studio voice',
})
assert(
  'Test 8 — Company voice still owned by existing system',
  voice.companyTone === 'calm and specific' && voice.brandVoice === 'studio voice',
)
assert('Test 8b — Knowledge does not replace voice', !Object.hasOwn(KNOWLEDGE_CAPABILITIES, 'brandVoice'))

const knowledgeDir = join(root, 'src', 'knowledge')
const files = [
  'index.js',
  'types.js',
  'schema.js',
  'store.js',
  'repository.js',
  'search.js',
  'ranking.js',
  'approvals.js',
  'sources.js',
  'normalize.js',
  'context.js',
  'summary.js',
  'demo.js',
]
let llmMentions = 0
for (const file of files) {
  const text = readFileSync(join(knowledgeDir, file), 'utf8')
  if (/(from ['"]openai|@anthropic|@google\/generative|loadAiProvider\(|new OpenAI|createAnthropic)/i.test(text)) llmMentions += 1
}
assert('Test 9 — Knowledge layer does not call an LLM', llmMentions === 0)
assert('Test 9b — RAG flags are explicit and off', KNOWLEDGE_CAPABILITIES.rag === false && KNOWLEDGE_CAPABILITIES.embeddings === false)

resetKnowledgeStore()
const started = process.hrtime.bigint()
for (let i = 0; i < 50; i += 1) {
  searchCompanyKnowledge({ companyId: studio, query: 'warranty exclusions model' })
}
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
assert('Test 10 — Search is fast', elapsedMs < 250, `${elapsedMs.toFixed(1)}ms for 50 searches`)

assert('Test 12 — Capabilities keep Forge unimplemented', KNOWLEDGE_CAPABILITIES.forge === false)

const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz123456'
const SECRET_MESSAGE = 'Secrets and API keys cannot be stored in company knowledge.'

function secretAttempt(fn) {
  try {
    fn()
    return { threw: false, leaked: false, fields: [], messages: [] }
  } catch (error) {
    const blob = `${error.message}\n${JSON.stringify(error.errors ?? [])}`
    return {
      threw: error instanceof ValidationError,
      leaked: blob.includes(SECRET),
      fields: (error.errors ?? []).map((entry) => entry.field),
      messages: (error.errors ?? []).map((entry) => entry.message),
    }
  }
}

function assertSecretRejected(name, fn, field) {
  const result = secretAttempt(fn)
  assert(
    name,
    result.threw &&
      result.fields.includes(field) &&
      result.messages.every((message) => message === SECRET_MESSAGE) &&
      !result.leaked,
    result.threw ? `fields=${result.fields.join(',')} leaked=${result.leaked}` : 'did not throw',
  )
}

assertSecretRejected('Security — secret in title rejected', () => {
  createKnowledgeItem({
    companyId: studio,
    title: `Profile ${SECRET}`,
    content: 'Independent studio producing proposals.',
  })
}, 'title')

assertSecretRejected('Security — secret in content rejected', () => {
  createKnowledgeItem({
    companyId: studio,
    title: 'Keys',
    content: `Use ${SECRET} in production.`,
  })
}, 'content')

assertSecretRejected('Security — secret in tags rejected', () => {
  createKnowledgeItem({
    companyId: studio,
    title: 'Tagged record',
    content: 'Standard exclusions for courier fees.',
    tags: ['legal', SECRET],
  })
}, 'tags')

assertSecretRejected('Security — secret in metadata rejected', () => {
  createKnowledgeItem({
    companyId: studio,
    title: 'Meta record',
    content: 'Standard warranty language for models.',
    metadata: { note: SECRET },
  })
}, 'metadata')

assertSecretRejected('Security — secret in nested metadata rejected', () => {
  createKnowledgeItem({
    companyId: studio,
    title: 'Nested meta record',
    content: 'Standard assumption about site access.',
    metadata: { creds: { token: SECRET } },
  })
}, 'metadata')

const normalTags = createKnowledgeItem({
  companyId: studio,
  title: 'Normal tagged exclusions',
  content: 'Printing, courier fees and extra revision rounds are excluded.',
  tags: ['exclusions', 'legal'],
  metadata: { demo: false, trust: 'unverified', note: 'company-approved wording' },
})
assert(
  'Security — normal tags remain valid',
  normalTags.status === KNOWLEDGE_STATUS.DRAFT && normalTags.tags.includes('exclusions'),
)
assert(
  'Security — normal metadata remains valid',
  Boolean(normalTags.id) && normalTags.metadata?.trust === 'unverified' && normalTags.metadata?.demo === false,
)

const sneakyCreate = createKnowledgeItem({
  companyId: studio,
  title: 'Forced approved via create',
  content: 'This must remain a draft until an explicit approve action.',
  status: KNOWLEDGE_STATUS.APPROVED,
  approvedBy: 'attacker',
})
assert(
  'Approval — generic create with status=approved results in DRAFT',
  sneakyCreate.status === KNOWLEDGE_STATUS.DRAFT && !sneakyCreate.approvedAt,
)
assert(
  'Approval — new knowledge results in DRAFT',
  createKnowledgeItem({
    companyId: studio,
    title: 'Editor-style new knowledge',
    content: 'Saved from the knowledge editor as a new record.',
  }).status === KNOWLEDGE_STATUS.DRAFT,
)

resetKnowledgeStore()
const proposalDraft = saveProposalContentAsKnowledge({
  companyId: studio,
  proposalId: 'prop-demo-2',
  block: {
    id: 'blk-2',
    type: 'terms',
    data: { body: 'Payment is due fourteen days after invoice.' },
  },
  title: 'Proposal terms wording',
  status: KNOWLEDGE_STATUS.APPROVED,
})
assert('Approval — proposal save results in DRAFT', proposalDraft.status === KNOWLEDGE_STATUS.DRAFT)
assert(
  'Approval — draft knowledge cannot enter approved context',
  !getKnowledgeContext({ companyId: studio, query: 'fourteen days after invoice' }).items.some(
    (item) => item.id === proposalDraft.id,
  ),
)

const explicit = approveKnowledgeItem({
  companyId: studio,
  id: proposalDraft.id,
  approvedBy: 'reviewer',
})
assert('Approval — explicit approve transitions to APPROVED', explicit.status === KNOWLEDGE_STATUS.APPROVED)
assert(
  'Approval — approved item eligible for context',
  getKnowledgeContext({ companyId: studio, query: 'fourteen days after invoice' }).items.some(
    (item) => item.id === proposalDraft.id,
  ),
)

const archivedAgain = archiveKnowledgeItem({ companyId: studio, id: proposalDraft.id })
assert('Approval — archive status', archivedAgain.status === KNOWLEDGE_STATUS.ARCHIVED)
assert(
  'Approval — archived knowledge cannot enter approved context',
  !getKnowledgeContext({ companyId: studio, query: 'fourteen days after invoice' }).items.some(
    (item) => item.id === proposalDraft.id,
  ),
)

console.log('')
console.log(`Knowledge verify: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
