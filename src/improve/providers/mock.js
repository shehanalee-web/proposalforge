import { BLOCK_TYPE } from '../../blocks/ids.js'
import { FINDING_CODE } from '../../insights/ids.js'
import { IMPROVE_PATCH, IMPROVE_PROVIDER } from '../ids.js'
import { makeImprovementDraft } from '../draft.js'
import { registerImproveProvider } from '../registry.js'

function ctx(proposal = {}) {
  const client = String(proposal.clientName ?? '').trim() || 'the client'
  const company = String(proposal.company ?? '').trim() || client
  const title = String(proposal.title ?? '').trim() || 'this engagement'
  const type = String(proposal.projectType ?? '').trim() || 'the work'

  return { client, company, title, type }
}

function summaryDraft(proposal, body) {
  return {
    previewTitle: 'Executive summary',
    previewBody: body,
    patch: {
      kind: IMPROVE_PATCH.FILL_BLOCK,
      blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
      data: { body },
      summary: body,
    },
  }
}

function timeline(proposal) {
  const { client, type } = ctx(proposal)
  const items = [
    {
      title: 'Kickoff and discovery',
      date: 'Week 1',
      body: `Align with ${client} on constraints, access and the success criteria for ${type}.`,
    },
    {
      title: 'Production',
      date: 'Weeks 2–4',
      body: `Build and review the core delivery in stages so ${client} can course-correct before handover.`,
    },
    {
      title: 'Install and close',
      date: 'Week 5–6',
      body: 'Final checks, handover pack and a named owner for questions after go-live.',
    },
  ]

  return {
    previewTitle: 'Implementation timeline',
    previewBody: items.map((item) => `${item.date} — ${item.title}. ${item.body}`).join('\n\n'),
    patch: {
      kind: IMPROVE_PATCH.FILL_BLOCK,
      blockType: BLOCK_TYPE.TIMELINE,
      data: { items },
    },
  }
}

function deliverables(proposal) {
  const { client, type } = ctx(proposal)
  const items = [
    {
      title: 'Approved plan',
      body: `A written sequence ${client} can sign against before ${type} begins.`,
    },
    {
      title: 'Core delivery',
      body: `The primary output named in this proposal, ready for use rather than further interpretation.`,
    },
    {
      title: 'Handover pack',
      body: 'Source files, a short care / usage note, and the named studio contact after close.',
    },
  ]

  return {
    previewTitle: 'Deliverables',
    previewBody: items.map((item) => `${item.title}: ${item.body}`).join('\n\n'),
    patch: {
      kind: IMPROVE_PATCH.FILL_BLOCK,
      blockType: BLOCK_TYPE.DELIVERABLES,
      data: { items },
    },
  }
}

function exclusions(proposal) {
  const { type } = ctx(proposal)
  const append = `Exclusions\nThis proposal does not include third-party licences, out-of-hours access, or work outside the named ${type} scope. Items not listed under deliverables are out of scope and quoted separately.`

  return {
    previewTitle: 'Exclusions',
    previewBody: append,
    patch: {
      kind: IMPROVE_PATCH.APPEND_BODY,
      blockType: BLOCK_TYPE.TERMS,
      append,
    },
  }
}

function warranty(proposal) {
  const { type } = ctx(proposal)
  const append = `Warranty\nStudio warrants workmanship on the named ${type} delivery for 12 months from handover. The warranty covers defects in our work, not wear, misuse, or changes made by others.`

  return {
    previewTitle: 'Warranty',
    previewBody: append,
    patch: {
      kind: IMPROVE_PATCH.APPEND_BODY,
      blockType: BLOCK_TYPE.TERMS,
      append,
    },
  }
}

function paymentTerms() {
  const append =
    'Payment terms\nA 40% deposit is due on acceptance. The balance is invoiced on handover and payable within 14 days. Work pauses if an invoice is overdue.'

  return {
    previewTitle: 'Payment terms',
    previewBody: append,
    patch: {
      kind: IMPROVE_PATCH.APPEND_BODY,
      blockType: BLOCK_TYPE.TERMS,
      append,
    },
  }
}

function signature() {
  return {
    previewTitle: 'Signature',
    previewBody:
      'A signature block so the client has a clear next step: accept, date, and return.',
    patch: {
      kind: IMPROVE_PATCH.FILL_BLOCK,
      blockType: BLOCK_TYPE.SIGNATURE,
      data: {},
    },
  }
}

function valueProposition(proposal) {
  const { client, company, type } = ctx(proposal)
  const body = `${company} needs ${type} that holds up in use, not just in a deck. This engagement gives ${client} a defined outcome, a named sequence of work, and a handover they can run without us in the room.`

  return {
    ...summaryDraft(proposal, body),
    previewTitle: 'Value proposition',
  }
}

function objectives(proposal) {
  const { client, type, title } = ctx(proposal)
  const body = `Objective: give ${client} a clear path through “${title}” so ${type} is decided on outcomes, not on a rate card. Success is an approved plan, a finished delivery, and no surprise extras at handover.`

  return {
    ...summaryDraft(proposal, body),
    previewTitle: 'Client objectives',
  }
}

function strongerSummary(proposal) {
  const { client, company, type } = ctx(proposal)
  const body = `${company} has asked for ${type} that can be approved without a second round of translation. We will run discovery with ${client}, produce the named delivery in reviewed stages, and close with a handover pack so the work survives contact with the real site or channel.`

  return summaryDraft(proposal, body)
}

function shorterSummary(proposal) {
  const { client, type } = ctx(proposal)
  const body = `${client} gets a defined ${type} delivery, reviewed in stages, with a named handover and no work outside the listed scope.`

  return {
    ...summaryDraft(proposal, body),
    previewTitle: 'Shorter opening',
  }
}

function movePricing() {
  return {
    previewTitle: 'Pricing placement',
    previewBody:
      'Commercials move below the summary, deliverables and supporting copy so the client sees the work before the number.',
    patch: {
      kind: IMPROVE_PATCH.MOVE_AFTER,
      blockType: BLOCK_TYPE.PRICING,
      afterTypes: [
        BLOCK_TYPE.COVER,
        BLOCK_TYPE.EXECUTIVE_SUMMARY,
        BLOCK_TYPE.DELIVERABLES,
        BLOCK_TYPE.RICH_TEXT,
      ],
    },
  }
}

const GENERATORS = {
  [FINDING_CODE.MISSING_TIMELINE]: timeline,
  [FINDING_CODE.MISSING_DELIVERABLES]: deliverables,
  [FINDING_CODE.MISSING_EXCLUSIONS]: exclusions,
  [FINDING_CODE.MISSING_WARRANTY]: warranty,
  [FINDING_CODE.MISSING_PAYMENT_TERMS]: paymentTerms,
  [FINDING_CODE.MISSING_CTA]: signature,
  [FINDING_CODE.WEAK_VALUE_PROPOSITION]: valueProposition,
  [FINDING_CODE.MISSING_OBJECTIVES]: objectives,
  [FINDING_CODE.WEAK_SUMMARY]: strongerSummary,
  [FINDING_CODE.LONG_SUMMARY]: shorterSummary,
  [FINDING_CODE.LONG_PROPOSAL]: shorterSummary,
  [FINDING_CODE.PRICING_TOO_EARLY]: movePricing,
}

function fallback(proposal, finding) {
  const { client, type } = ctx(proposal)
  const body = `${finding.suggestion || 'Tighten this section so'} ${client} can approve ${type} without a follow-up call.`
  return summaryDraft(proposal, body)
}

/**
 * Offline mock. Same drafts Horizon 3 used — kept for local development
 * when no API key is configured.
 */
export function generateMockImprovement({ finding, proposal } = {}) {
  const issue = finding ?? {}
  const run = GENERATORS[issue.code] ?? fallback
  const generated = run(proposal ?? {}, issue)

  return {
    findingId: issue.id ?? '',
    findingCode: issue.code ?? '',
    title: issue.title ?? 'Improvement',
    severity: issue.severity,
    reason: issue.message ?? '',
    suggestion: issue.suggestion ?? '',
    ...generated,
  }
}

export const generateDeterministicImprovement = generateMockImprovement

export function createMockProvider() {
  return {
    id: IMPROVE_PROVIDER.MOCK,
    label: 'Mock',
    model: 'mock',
    supportsStreaming: false,
    supportsJSON: true,
    supportsVision: false,
    supportsTools: false,
    maxTokens: 2048,
    async generateImprovement(request = {}) {
      return makeImprovementDraft({
        ...generateMockImprovement(request),
        provider: IMPROVE_PROVIDER.MOCK,
      })
    },
    async complete({ request } = {}) {
      const draft = await this.generateImprovement(request)
      return {
        text: draft.previewBody,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        draft,
      }
    },
  }
}

const mock = createMockProvider()

registerImproveProvider({
  ...mock,
  generate: generateMockImprovement,
})

registerImproveProvider({
  ...mock,
  id: IMPROVE_PROVIDER.DETERMINISTIC,
  label: 'Mock',
  generate: generateMockImprovement,
})
