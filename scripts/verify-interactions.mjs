import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeProposal } from '../src/models/proposal.js'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { getWorkflow, resetWorkflowStore } from '../src/workflow/index.js'
import { WORKFLOW_STATUS } from '../src/workflow/types.js'
import { getWorkflowActor } from '../src/workflow/actors.js'
import {
  configurePortalResolvers,
  createPortal,
  DEFAULT_COMPANY_ID,
  PORTAL_ISOLATION_COMPANY_ID,
  PORTAL_STATUS,
  publishPortal,
  resetPortalResolvers,
  resetPortalStore,
  revokePortal,
} from '../src/portal/index.js'
import {
  acknowledgeInteraction,
  allInteractionRecords,
  assertClientSafeInteraction,
  assertInteractionTransition,
  configureInteractionResolvers,
  containsSecret,
  createClientInteraction,
  DEFAULT_COMPANY_ID as INTERACTION_COMPANY,
  findInteractionRecord,
  INTERACTION_CAPABILITIES,
  INTERACTION_EVENT,
  INTERACTION_ISOLATION_COMPANY_ID,
  INTERACTION_SOURCE,
  INTERACTION_STATUS,
  INTERACTION_TYPE,
  INTERNAL_INTERACTION_KEYS,
  listClientInteractions,
  listStudioInteractions,
  mutateClientInteraction,
  mutateClientInteractionStatus,
  presentClientInteraction,
  resetInteractionResolvers,
  resetInteractionStore,
  resolveInteraction,
} from '../src/interactions/index.js'

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

function throws(fn, Type) {
  try {
    fn()
    return false
  } catch (error) {
    return Type ? error instanceof Type : true
  }
}

function caught(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  }
}

const studio = DEFAULT_COMPANY_ID
const other = PORTAL_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')
const sam = getWorkflowActor('user-studio-sam')
const lee = getWorkflowActor('user-harborline-lee')

const proposals = new Map()
const workflowStatus = new Map()

function seedProposal(id, input = {}, companyId = studio) {
  const proposal = makeProposal({
    id,
    title: input.title ?? 'Harborline website',
    clientName: input.clientName ?? 'Jordan Lee',
    company: input.company ?? 'Harborline',
    summary: input.summary ?? 'A website rebuild for Harborline.',
    amount: input.amount ?? 24000,
    currency: 'USD',
    notes: 'INTERNAL ONLY — do not show',
    sections: input.sections ?? [{ id: 's1', heading: 'Approach', body: 'Discovery, design, and build.' }],
    items: input.items ?? [{ id: 'i1', description: 'Website', amount: 24000 }],
    blocks: input.blocks ?? [
      makeBlock({
        id: 'blk-approach',
        type: BLOCK_TYPE.RICH_TEXT,
        data: { heading: 'Approach', body: 'Discovery, design, and build.' },
      }),
    ],
    ...input,
  })
  proposal.companyId = companyId
  proposals.set(id, proposal)
  return proposal
}

function keyOf(companyId, proposalId) {
  return `${companyId}:${proposalId}`
}

configurePortalResolvers({
  getProposal(proposalId, companyId) {
    const found = proposals.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  getWorkflowStatus(companyId, proposalId) {
    return workflowStatus.get(keyOf(companyId, proposalId)) ?? WORKFLOW_STATUS.DRAFT
  },
})

configureInteractionResolvers({
  getProposal(proposalId, companyId) {
    const found = proposals.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
})

resetPortalStore()
resetWorkflowStore()
resetInteractionStore()

seedProposal('prop-ix-1')
workflowStatus.set(keyOf(studio, 'prop-ix-1'), WORKFLOW_STATUS.READY_TO_SEND)
getWorkflow({ companyId: studio, proposalId: 'prop-ix-1', actor: sarah })
createPortal({ companyId: studio, proposalId: 'prop-ix-1', actor: sarah })
const published = publishPortal({
  companyId: studio,
  proposalId: 'prop-ix-1',
  actor: sarah,
})
const portalId = published.portal.id

const comment = createClientInteraction({
  portalId,
  type: INTERACTION_TYPE.COMMENT,
  message: 'Please keep the cover photo.',
  blockId: 'blk-approach',
})
assert(
  'Test 1 — Interaction creation',
  comment.kind === 'client_interaction' &&
    comment.status === INTERACTION_STATUS.OPEN &&
    comment.portalId === portalId &&
    comment.proposalId === 'prop-ix-1',
)

const question = createClientInteraction({
  portalId,
  type: INTERACTION_TYPE.QUESTION,
  message: 'Does this include photography?',
})
const change = createClientInteraction({
  portalId,
  type: INTERACTION_TYPE.CHANGE_REQUEST,
  message: 'Please change the timeline to eight weeks.',
  blockId: 'blk-approach',
})
const ids = [comment.id, question.id, change.id]
assert(
  'Test 2 — Interaction ids are unique',
  ids.every((id) => String(id).startsWith('ixn-')) && new Set(ids).size === 3,
)

assert('Test 3 — Comment creation', comment.type === INTERACTION_TYPE.COMMENT)
assert('Test 4 — Question creation', question.type === INTERACTION_TYPE.QUESTION)
assert(
  'Test 5 — Change-request creation',
  change.type === INTERACTION_TYPE.CHANGE_REQUEST && change.blockId === 'blk-approach',
)

const beforeApproval = getWorkflow({ companyId: studio, proposalId: 'prop-ix-1', actor: sarah })
const approval = createClientInteraction({
  portalId,
  type: INTERACTION_TYPE.APPROVAL,
})
const afterApproval = getWorkflow({ companyId: studio, proposalId: 'prop-ix-1', actor: sarah })
assert(
  'Test 6 — Approval creation',
  approval.type === INTERACTION_TYPE.APPROVAL &&
    approval.source !== INTERACTION_SOURCE.STUDIO &&
    findInteractionRecord(approval.id)?.source === INTERACTION_SOURCE.CLIENT &&
    beforeApproval.status === afterApproval.status,
)

assert(
  'Test 7 — Portal scope enforcement',
  throws(
    () =>
      createClientInteraction({
        portalId,
        type: INTERACTION_TYPE.COMMENT,
        message: 'Wrong proposal',
        proposalId: 'someone-else',
      }),
    ValidationError,
  ) &&
    listClientInteractions({ portalId }).interactions.every((item) => item.portalId === portalId),
)

seedProposal('prop-ix-draft')
workflowStatus.set(keyOf(studio, 'prop-ix-draft'), WORKFLOW_STATUS.READY_TO_SEND)
const draftPortal = createPortal({
  companyId: studio,
  proposalId: 'prop-ix-draft',
  actor: sarah,
})
assert(
  'Test 8 — Unpublished portal rejection',
  draftPortal.status === PORTAL_STATUS.DRAFT &&
    throws(
      () =>
        createClientInteraction({
          portalId: draftPortal.id,
          type: INTERACTION_TYPE.COMMENT,
          message: 'Should fail',
        }),
      NotFoundError,
    ) &&
    throws(() => listClientInteractions({ portalId: draftPortal.id }), NotFoundError),
)

seedProposal('prop-ix-revoked')
workflowStatus.set(keyOf(studio, 'prop-ix-revoked'), WORKFLOW_STATUS.READY_TO_SEND)
createPortal({ companyId: studio, proposalId: 'prop-ix-revoked', actor: sarah })
const revoked = publishPortal({
  companyId: studio,
  proposalId: 'prop-ix-revoked',
  actor: sarah,
})
revokePortal({ companyId: studio, proposalId: 'prop-ix-revoked', actor: sarah })
assert(
  'Test 9 — Revoked portal rejection',
  throws(
    () =>
      createClientInteraction({
        portalId: revoked.portal.id,
        type: INTERACTION_TYPE.COMMENT,
        message: 'Should fail',
      }),
    ForbiddenError,
  ) && throws(() => listClientInteractions({ portalId: revoked.portal.id }), ForbiddenError),
)

seedProposal('prop-ix-expired')
workflowStatus.set(keyOf(studio, 'prop-ix-expired'), WORKFLOW_STATUS.READY_TO_SEND)
createPortal({ companyId: studio, proposalId: 'prop-ix-expired', actor: sarah })
const expired = publishPortal({
  companyId: studio,
  proposalId: 'prop-ix-expired',
  actor: sarah,
  expiresAt: '2020-01-01T00:00:00.000Z',
})
assert(
  'Test 10 — Expired portal rejection',
  expired.portal.status === PORTAL_STATUS.EXPIRED &&
    throws(
      () =>
        createClientInteraction({
          portalId: expired.portal.id,
          type: INTERACTION_TYPE.COMMENT,
          message: 'Should fail',
        }),
      ForbiddenError,
    ) &&
    throws(() => listClientInteractions({ portalId: expired.portal.id }), ForbiddenError),
)

assert(
  'Test 11 — ProposalId mismatch rejection',
  throws(
    () =>
      createClientInteraction({
        portalId,
        type: INTERACTION_TYPE.QUESTION,
        message: 'Mismatch',
        proposalId: 'prop-ix-draft',
      }),
    ValidationError,
  ),
)

seedProposal('prop-ix-other', { title: 'Other company' }, other)
workflowStatus.set(keyOf(other, 'prop-ix-other'), WORKFLOW_STATUS.READY_TO_SEND)
getWorkflow({ companyId: other, proposalId: 'prop-ix-other', actor: lee })
createPortal({ companyId: other, proposalId: 'prop-ix-other', actor: lee })
const otherPublished = publishPortal({
  companyId: other,
  proposalId: 'prop-ix-other',
  actor: lee,
})
createClientInteraction({
  portalId: otherPublished.portal.id,
  type: INTERACTION_TYPE.COMMENT,
  message: 'Harborline only',
})
const studioList = listStudioInteractions({
  companyId: studio,
  proposalId: 'prop-ix-1',
  actor: sarah,
})
const leeList = listStudioInteractions({
  companyId: other,
  proposalId: 'prop-ix-other',
  actor: lee,
})
assert(
  'Test 12 — Company isolation',
  studioList.every((item) => item.companyId === studio) &&
    leeList.every((item) => item.companyId === other) &&
    throws(
      () =>
        listStudioInteractions({
          companyId: studio,
          proposalId: 'prop-ix-1',
          actor: lee,
        }),
      ForbiddenError,
    ) &&
    throws(
      () =>
        createClientInteraction({
          portalId,
          type: INTERACTION_TYPE.COMMENT,
          message: 'Cross company',
          companyId: other,
        }),
      ForbiddenError,
    ),
)

assert(
  'Test 13 — Client cannot mutate status',
  throws(() => mutateClientInteractionStatus(), ForbiddenError) &&
    throws(() => mutateClientInteraction(), ForbiddenError),
)

assert(
  'Test 14 — Client cannot resolve',
  throws(
    () =>
      resolveInteraction({
        companyId: studio,
        interactionId: comment.id,
        actor: sam,
      }),
    ForbiddenError,
  ),
)

const acknowledged = acknowledgeInteraction({
  companyId: studio,
  interactionId: comment.id,
  actor: sarah,
})
assert(
  'Test 15 — Studio acknowledgement',
  acknowledged.status === INTERACTION_STATUS.ACKNOWLEDGED &&
    acknowledged.acknowledgedBy === sarah.id &&
    acknowledged.message === comment.message,
)

const resolved = resolveInteraction({
  companyId: studio,
  interactionId: comment.id,
  actor: sarah,
})
assert(
  'Test 16 — Studio resolution',
  resolved.status === INTERACTION_STATUS.RESOLVED && resolved.resolvedBy === sarah.id,
)

assert(
  'Test 17 — Invalid transition rejection',
  throws(() => assertInteractionTransition(INTERACTION_STATUS.RESOLVED, INTERACTION_STATUS.OPEN), ValidationError) &&
    throws(
      () =>
        acknowledgeInteraction({
          companyId: studio,
          interactionId: comment.id,
          actor: sarah,
        }),
      ValidationError,
    ),
)

const listed = listClientInteractions({ portalId })
const clientView = listed.interactions.find((item) => item.id === comment.id)
assert(
  'Test 18 — Client-safe projection',
  assertClientSafeInteraction(clientView) &&
    clientView.kind === 'client_interaction' &&
    !('companyId' in clientView) &&
    !('activity' in clientView),
)

assert(
  'Test 19 — Internal fields excluded from client projection',
  INTERNAL_INTERACTION_KEYS.every((key) => !(key in clientView)) &&
    !('acknowledgedBy' in clientView) &&
    !('resolvedBy' in clientView) &&
    !('actorId' in presentClientInteraction(findInteractionRecord(comment.id))),
)

const stored = findInteractionRecord(comment.id)
assert(
  'Test 20 — No proposal document duplication',
  !('blocks' in stored) &&
    !('sections' in stored) &&
    !('items' in stored) &&
    !('summary' in stored) &&
    !('proposal' in stored) &&
    stored.message === 'Please keep the cover photo.',
)

const missingBlock = createClientInteraction({
  portalId,
  type: INTERACTION_TYPE.COMMENT,
  message: 'About a removed section.',
  blockId: 'blk-missing',
})
assert(
  'Test 21 — Block reference survives missing block',
  missingBlock.blockId === 'blk-missing' &&
    missingBlock.blockUnavailable === true &&
    missingBlock.kind === 'client_interaction',
)

const originalMessage = stored.message
const originalCreated = stored.createdAt
const afterResolve = findInteractionRecord(comment.id)
assert(
  'Test 22 — Interaction immutability',
  afterResolve.message === originalMessage &&
    afterResolve.createdAt === originalCreated &&
    afterResolve.source === INTERACTION_SOURCE.CLIENT &&
    afterResolve.actorName === 'Client',
)

const activityTypes = (afterResolve.activity ?? []).map((event) => event.type)
assert(
  'Test 23 — Activity records',
  activityTypes.includes(INTERACTION_EVENT.CREATED) &&
    activityTypes.includes(INTERACTION_EVENT.ACKNOWLEDGED) &&
    activityTypes.includes(INTERACTION_EVENT.RESOLVED),
)

const secretError = caught(() =>
  createClientInteraction({
    portalId,
    type: INTERACTION_TYPE.COMMENT,
    message: 'Use sk-abcdefghijklmnopqrstuvwxyz123456',
  }),
)
const dumped = JSON.stringify(allInteractionRecords())
assert(
  'Test 24 — No secrets in interaction records',
  secretError instanceof ValidationError &&
    !String(secretError.message).includes('sk-abcdefghijklmnopqrstuvwxyz123456') &&
    !containsSecret(dumped) &&
    INTERACTION_CAPABILITIES.unguessableUrlIsAuth === false &&
    INTERACTION_CAPABILITIES.emailDelivery === false,
)

resetInteractionResolvers()
resetPortalResolvers()

const pluginSource = sourceOf('server', 'interactionsPlugin.js')
const repoSource = sourceOf('src', 'interactions', 'repository.js')
const domainSource = sourceOf('src', 'interactions', 'index.js')
assert(
  'Test 24b — Persistence and capability boundary',
  pluginSource.includes('Never writes `data/proposals.json`') &&
    pluginSource.includes("join(root, 'data', 'interactions.json')") &&
    !pluginSource.includes('whatsapp') &&
    !pluginSource.includes('nodemailer') &&
    !repoSource.includes('sendMail') &&
    !domainSource.includes("from '../intelligence") &&
    INTERACTION_COMPANY === studio &&
    INTERACTION_ISOLATION_COMPANY_ID === other,
)

const panelCss = sourceOf('src', 'components', 'Interactions', 'InteractionsPanel.module.css')
const pageCss = sourceOf('src', 'pages', 'ProposalPortal', 'ProposalPortal.module.css')
assert(
  'Test 24c — Mobile overflow guards',
  panelCss.includes('overflow-x: hidden') &&
    panelCss.includes('100vw') &&
    panelCss.includes('390px') &&
    pageCss.includes('overflow-x: hidden') &&
    pageCss.includes('390px'),
)

const portalSuite = runSuite('verify-portal.mjs')
assert(
  'Test 25 — Existing Portal verification still passes',
  portalSuite.ok,
  portalSuite.ok ? '' : portalSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const workflowSuite = runSuite('verify-workflow.mjs')
assert(
  'Test 26 — Existing Workflow verification still passes',
  workflowSuite.ok,
  workflowSuite.ok ? '' : workflowSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const knowledgeSuite = runSuite('verify-knowledge.mjs')
assert(
  'Test 27 — Existing Knowledge verification still passes',
  knowledgeSuite.ok,
  knowledgeSuite.ok ? '' : knowledgeSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const generatorSuite = runSuite('verify-generator.mjs')
assert(
  'Test 28 — Existing Generator verification still passes',
  generatorSuite.ok,
  generatorSuite.ok ? '' : generatorSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
