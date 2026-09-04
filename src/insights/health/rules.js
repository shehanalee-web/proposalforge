import { BLOCK_TYPE } from '../../blocks/ids.js'
import {
  FINDING_CATEGORY,
  FINDING_CODE,
  FINDING_SEVERITY,
} from '../ids.js'
import { makeFinding } from '../finding.js'
import { wordCount } from '../document.js'

const PAYMENT_RE =
  /\b(payment terms|deposit|invoice|net\s*\d+|due on|due within|payable|payment schedule)\b/i
const EXCLUSION_RE =
  /\b(exclusion|exclusions|not included|out of scope|does not include|excluded|outside the scope)\b/i
const WARRANTY_RE =
  /\b(warranty|warranties|guarantee|guaranteed|defects liability)\b/i

const WEAK_SUMMARY_WORDS = 30
const LONG_SUMMARY_WORDS = 160
const LONG_PROPOSAL_WORDS = 1200
const LONG_PROPOSAL_BLOCKS = 14

function finding(input) {
  return makeFinding(input)
}

/**
 * Sales-director heuristics. Completeness checks live in the engine so this
 * file only emits warnings and suggestions.
 *
 * @typedef {object} HealthRuleContext
 * @property {object[]} blocks
 * @property {object} proposal
 * @property {string} text
 * @property {object | null} summaryBlock
 * @property {object | null} termsBlock
 * @property {object | null} timelineBlock
 * @property {object | null} deliverablesBlock
 * @property {object | null} signatureBlock
 * @property {object | null} pricingBlock
 * @property {boolean} hasPricing
 * @property {boolean} hasTerms
 * @property {boolean} hasSummary
 * @property {string} placement
 * @property {boolean} hasMilestoneSchedule
 */

/**
 * @param {HealthRuleContext} ctx
 * @returns {import('../finding.js').InsightFinding[]}
 */
export function runHealthRules(ctx) {
  const findings = []
  const summaryWords = wordCount(ctx.summaryBlock?.data?.body)

  if (!ctx.timelineBlock) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_TIMELINE,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'Missing timeline',
        message: 'The client cannot see when work starts, lands, or finishes.',
        suggestion: 'Add a timeline with named milestones and dates.',
        blockType: BLOCK_TYPE.TIMELINE,
        impact: 8,
      }),
    )
  }

  if (ctx.hasTerms && !PAYMENT_RE.test(ctx.termsBlock?.data?.body ?? '') && !ctx.hasMilestoneSchedule) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_PAYMENT_TERMS,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMMERCIAL,
        title: 'Missing payment terms',
        message: 'Terms are present, but they never say how or when you get paid.',
        suggestion: 'State deposit, schedule, and when the balance is due.',
        blockType: BLOCK_TYPE.TERMS,
        blockId: ctx.termsBlock?.id ?? null,
        impact: 10,
      }),
    )
  }

  if (!ctx.signatureBlock) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_CTA,
        severity: FINDING_SEVERITY.CRITICAL,
        category: FINDING_CATEGORY.STRUCTURE,
        title: 'Missing call to action',
        message: 'There is no signature block, so the client has no clear next step.',
        suggestion: 'Add a signature block so acceptance is obvious.',
        blockType: BLOCK_TYPE.SIGNATURE,
        impact: 10,
      }),
    )
  }

  if (ctx.text && !EXCLUSION_RE.test(ctx.text)) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_EXCLUSIONS,
        severity: FINDING_SEVERITY.INFO,
        category: FINDING_CATEGORY.COMMERCIAL,
        title: 'Missing exclusions',
        message: 'Scope never says what is out of bounds, which invites extras for free.',
        suggestion: 'List what is not included so change requests stay commercial.',
        blockType: BLOCK_TYPE.TERMS,
        impact: 5,
      }),
    )
  }

  if (ctx.text && !WARRANTY_RE.test(ctx.text)) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_WARRANTY,
        severity: FINDING_SEVERITY.INFO,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'Missing warranty',
        message: 'No warranty or guarantee language appears in the document.',
        suggestion: 'State what is covered after handover, even if the answer is limited.',
        impact: 4,
      }),
    )
  }

  if (!ctx.deliverablesBlock) {
    findings.push(
      finding({
        code: FINDING_CODE.MISSING_DELIVERABLES,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COMPLETENESS,
        title: 'Missing deliverables',
        message: 'The proposal never lists what the client actually receives.',
        suggestion: 'Add a deliverables block with concrete outputs.',
        blockType: BLOCK_TYPE.DELIVERABLES,
        impact: 7,
      }),
    )
  }

  if (ctx.hasSummary && summaryWords > 0 && summaryWords < WEAK_SUMMARY_WORDS) {
    findings.push(
      finding({
        code: FINDING_CODE.WEAK_SUMMARY,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.COPY,
        title: 'Weak executive summary',
        message: 'The summary is too short to carry the value of the work.',
        suggestion: 'Write a few sentences on the problem, the approach, and the outcome.',
        blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
        blockId: ctx.summaryBlock?.id ?? null,
        impact: 8,
      }),
    )
  }

  if (ctx.hasSummary && summaryWords > LONG_SUMMARY_WORDS) {
    findings.push(
      finding({
        code: FINDING_CODE.LONG_SUMMARY,
        severity: FINDING_SEVERITY.INFO,
        category: FINDING_CATEGORY.COPY,
        title: 'Executive summary is long',
        message: 'A long opening slows the first thirty seconds of a client read.',
        suggestion: 'Keep the summary to a short pitch and move detail lower.',
        blockType: BLOCK_TYPE.EXECUTIVE_SUMMARY,
        blockId: ctx.summaryBlock?.id ?? null,
        impact: 4,
      }),
    )
  }

  const words = wordCount(ctx.text)
  if (words >= LONG_PROPOSAL_WORDS || ctx.blocks.length >= LONG_PROPOSAL_BLOCKS) {
    findings.push(
      finding({
        code: FINDING_CODE.LONG_PROPOSAL,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.STRUCTURE,
        title: 'Proposal may be too long',
        message: 'Long documents lose decision-makers before pricing and next steps.',
        suggestion: 'Cut supporting detail or move it into appendices and attachments.',
        impact: 6,
      }),
    )
  }

  if (ctx.hasPricing && ctx.placement === 'early') {
    findings.push(
      finding({
        code: FINDING_CODE.PRICING_TOO_EARLY,
        severity: FINDING_SEVERITY.WARNING,
        category: FINDING_CATEGORY.PRICING,
        title: 'Pricing appears too early',
        message: 'The investment lands before the client has a reason to value it.',
        suggestion: 'Lead with the problem, approach, and proof, then show commercials.',
        blockType: BLOCK_TYPE.PRICING,
        blockId: ctx.pricingBlock?.id ?? null,
        impact: 6,
      }),
    )
  }

  return findings
}
