import { BLOCK_TYPE } from '../../blocks/ids.js'
import { isBlockDataEmpty } from '../../blocks/schemas.js'
import {
  FINDING_CATEGORY,
  FINDING_CODE,
  FINDING_SEVERITY,
} from '../ids.js'
import { makeFinding } from '../finding.js'
import { wordCount } from '../document.js'
import { SIGNAL, blockCopy, hasSignal } from './signals.js'

function finding(input) {
  return makeFinding(input)
}

function isFilled(block, type) {
  if (!block) return false
  if (type === BLOCK_TYPE.SIGNATURE) return true
  return !isBlockDataEmpty(type, block.data)
}

function firstFilledIndex(blocks, types) {
  const list = blocks ?? []
  let found = -1
  for (const type of types) {
    const index = list.findIndex((block) => block.type === type && isFilled(block, type))
    if (index >= 0 && (found < 0 || index < found)) found = index
  }
  return found
}

function openingCopy(ctx) {
  const cover = ctx.blocks.find((block) => block.type === BLOCK_TYPE.COVER)
  return [blockCopy(cover), ctx.summaryBlock?.data?.body ?? ''].filter(Boolean).join(' ')
}

/**
 * Horizon 2 diagnostics. Improves detection (document-wide signals, not only
 * dedicated blocks) and writes the reason a sales director would give.
 *
 * @param {import('./rules.js').HealthRuleContext} ctx
 * @returns {{ findings: import('../finding.js').InsightFinding[], suppress: string[] }}
 */
export function runDiagnostics(ctx) {
  const findings = []
  const suppress = []
  const text = ctx.text ?? ''
  const opening = openingCopy(ctx)

  const hasTimelineCopy =
    Boolean(ctx.timelineBlock) || hasSignal(text, SIGNAL.TIMELINE)
  if (hasTimelineCopy) {
    suppress.push(FINDING_CODE.MISSING_TIMELINE)
  } else {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_TIMELINE,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'No implementation timeline found.',
        message:
          'Without phases or dates, the client cannot judge interruption, duration, or when they get value — so the decision slips.',
        suggestion:
          'Add dated milestones, even a three-line sequence: kickoff, review, handover.',
        blockType: BLOCK_TYPE.TIMELINE,
        impact: 8,
      }),
    )
  }

  const hasDeliverableCopy =
    Boolean(ctx.deliverablesBlock) || hasSignal(text, SIGNAL.DELIVERABLE)
  if (hasDeliverableCopy) {
    suppress.push(FINDING_CODE.MISSING_DELIVERABLES)
  } else {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_DELIVERABLES,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'The client cannot see what they actually receive.',
        message:
          'Without named outputs, the proposal is a promise of effort rather than a package they can approve.',
        suggestion: 'List concrete deliverables — files, artefacts, sessions — not activities.',
        blockType: BLOCK_TYPE.DELIVERABLES,
        impact: 7,
      }),
    )
  }

  if (hasSignal(text, SIGNAL.EXCLUSION)) {
    suppress.push(FINDING_CODE.MISSING_EXCLUSIONS)
  } else if (text) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_EXCLUSIONS,
        severity: FINDING_SEVERITY.INFO,
        category: FINDING_CATEGORY.COMMERCIAL,
        title: 'No exclusions section detected.',
        message:
          'If scope never names what is out, every extra request looks included — and margin disappears in delivery.',
        suggestion:
          'Add a short “Not included” list next to deliverables or in terms.',
        blockType: BLOCK_TYPE.TERMS,
        impact: 5,
      }),
    )
  }

  if (hasSignal(text, SIGNAL.WARRANTY)) {
    suppress.push(FINDING_CODE.MISSING_WARRANTY)
  } else if (text) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_WARRANTY,
        severity: FINDING_SEVERITY.INFO,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'Warranty language is missing.',
        message:
          'A buyer who cannot see what happens after handover assumes risk — or stalls for legal review.',
        suggestion:
          'State the defects window and what it covers, even if the cover is limited.',
        impact: 4,
      }),
    )
  }

  const pricingIndex = (ctx.blocks ?? []).findIndex(
    (block) => block.type === BLOCK_TYPE.PRICING && isFilled(block, BLOCK_TYPE.PRICING),
  )
  const understandingIndex = firstFilledIndex(ctx.blocks, [
    BLOCK_TYPE.EXECUTIVE_SUMMARY,
    BLOCK_TYPE.DELIVERABLES,
    BLOCK_TYPE.RICH_TEXT,
  ])
  const pricingBeforeUnderstanding =
    ctx.hasPricing &&
    pricingIndex >= 0 &&
    (understandingIndex < 0 || pricingIndex < understandingIndex)

  if (pricingBeforeUnderstanding) {
    findings.push(
      finding({
        code: FINDING_CODE.PRICING_TOO_EARLY,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.PRICING,
        title: 'Pricing appears before project understanding.',
        message:
          'The investment lands before the client has a reason to value the work, so they negotiate the number instead of the outcome.',
        suggestion:
          'Lead with the problem, approach, and proof. Move commercials after that story.',
        blockType: BLOCK_TYPE.PRICING,
        blockId: ctx.pricingBlock?.id ?? null,
        impact: 7,
      }),
    )
  } else if (ctx.placement !== 'early') {
    suppress.push(FINDING_CODE.PRICING_TOO_EARLY)
  }

  const openingWords = wordCount(opening)
  const hasValue = hasSignal(opening, SIGNAL.VALUE)
  if (openingWords > 0 && openingWords < 12 && !hasValue) {
    findings.push(
      finding({
        code: FINDING_CODE.WEAK_VALUE_PROPOSITION,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COPY,
        title: 'Proposal opens without a clear value proposition.',
        message:
          'The first screen never says what changes for the client. A buyer who cannot see the win will not fight for the budget.',
        suggestion:
          'Open with the outcome — what they get, why it matters — then describe the work.',
        blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
        blockId: ctx.summaryBlock?.id ?? null,
        impact: 8,
      }),
    )
  } else if (!opening.trim()) {
    findings.push(
      finding({
        code: FINDING_CODE.WEAK_VALUE_PROPOSITION,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COPY,
        title: 'Proposal opens without a clear value proposition.',
        message:
          'Cover and summary are empty, so the document starts on logistics instead of a reason to buy.',
        suggestion:
          'Write a short opening that names the client problem and the result of this engagement.',
        blockType: BLOCK_TYPE.COVER,
        impact: 9,
      }),
    )
  }

  if (text && !hasSignal(text, SIGNAL.OBJECTIVES)) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_OBJECTIVES,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COPY,
        title: 'No client objectives identified.',
        message:
          'The proposal never restates what the client is trying to achieve, so it reads as a catalogue rather than a response to their brief.',
        suggestion:
          'Name the goal in the summary — the problem, the constraint, or the decision they need to make.',
        blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
        blockId: ctx.summaryBlock?.id ?? null,
        impact: 6,
      }),
    )
  }

  if (ctx.hasTerms && !hasSignal(ctx.termsBlock?.data?.body ?? '', SIGNAL.PAYMENT) && !ctx.hasMilestoneSchedule) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_PAYMENT_TERMS,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMMERCIAL,
        title: 'Payment terms never say how you get paid.',
        message:
          'Terms exist, but they skip deposit, schedule, and due dates — finance will bounce the proposal or invent their own.',
        suggestion: 'State the deposit, when the balance is invoiced, and the payment window.',
        blockType: BLOCK_TYPE.TERMS,
        blockId: ctx.termsBlock?.id ?? null,
        impact: 10,
      }),
    )
  }

  return { findings, suppress }
}
