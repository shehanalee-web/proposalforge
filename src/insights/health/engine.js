import { BLOCK_TYPE } from '../../blocks/ids.js'
import { FINDING_SEVERITY, INSIGHTS_SOURCE, PRICING_PLACEMENT } from '../ids.js'
import { makeHealthCheck } from '../finding.js'
import { makeInsightsSnapshot, makePricingInsight } from '../snapshot.js'
import { blendScores, clampScore } from '../score.js'
import {
  blockPlacement,
  collectDocumentText,
  findBlock,
  hasFilledBlock,
  pricingFacts,
  readingScoreFromText,
  resolveBlocks,
} from '../document.js'
import { runHealthRules } from './rules.js'

const COMPLETENESS_WEIGHT = 70
const QUALITY_WEIGHT = 30

const COMPLETENESS_CHECKS = [
  {
    id: 'cover',
    label: 'Cover / Hero filled',
    type: BLOCK_TYPE.COVER,
    weight: 10,
  },
  {
    id: 'summary',
    label: 'Executive summary written',
    type: BLOCK_TYPE.EXECUTIVE_SUMMARY,
    weight: 14,
  },
  {
    id: 'pricing',
    label: 'Pricing added',
    type: BLOCK_TYPE.PRICING,
    weight: 14,
  },
  {
    id: 'team',
    label: 'Team introduced',
    type: BLOCK_TYPE.TEAM,
    weight: 8,
  },
  {
    id: 'terms',
    label: 'Terms & conditions set',
    type: BLOCK_TYPE.TERMS,
    weight: 12,
  },
  {
    id: 'signature',
    label: 'Signature block present',
    type: BLOCK_TYPE.SIGNATURE,
    weight: 10,
  },
]

function completenessScore(checks) {
  const total = checks.reduce((sum, check) => sum + check.weight, 0)
  const earned = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0)
  return total > 0 ? (earned / total) * 100 : 0
}

function qualityScore(findings) {
  const penalty = findings.reduce((sum, finding) => sum + finding.impact, 0)
  return clampScore(100 - penalty)
}

/**
 * Analyse a proposal the way a sales director would skim it: completeness,
 * commercial gaps, structure, and copy risk. Pure and synchronous — nothing
 * is written back onto the proposal.
 *
 * Accepts either a proposal record or `{ proposal, blocks }` so the editor
 * can pass live block state without waiting for a save.
 *
 * @param {object} [input]
 * @returns {import('../snapshot.js').InsightsSnapshot}
 */
export function analyzeProposalHealth(input = {}) {
  const source =
    input.proposal && typeof input.proposal === 'object' ? input.proposal : input
  const blocks = resolveBlocks({
    proposal: source,
    blocks: input.blocks ?? source.blocks,
  })

  const checks = COMPLETENESS_CHECKS.map((check) =>
    makeHealthCheck({
      id: check.id,
      label: check.label,
      weight: check.weight,
      pass: hasFilledBlock(blocks, check.type),
    }),
  )

  const summaryBlock = hasFilledBlock(blocks, BLOCK_TYPE.EXECUTIVE_SUMMARY)
    ? findBlock(blocks, BLOCK_TYPE.EXECUTIVE_SUMMARY)
    : null
  const termsBlock = hasFilledBlock(blocks, BLOCK_TYPE.TERMS)
    ? findBlock(blocks, BLOCK_TYPE.TERMS)
    : null
  const timelineBlock = hasFilledBlock(blocks, BLOCK_TYPE.TIMELINE)
    ? findBlock(blocks, BLOCK_TYPE.TIMELINE)
    : null
  const deliverablesBlock = hasFilledBlock(blocks, BLOCK_TYPE.DELIVERABLES)
    ? findBlock(blocks, BLOCK_TYPE.DELIVERABLES)
    : null
  const signatureBlock = findBlock(blocks, BLOCK_TYPE.SIGNATURE)
  const pricingBlock = hasFilledBlock(blocks, BLOCK_TYPE.PRICING)
    ? findBlock(blocks, BLOCK_TYPE.PRICING)
    : null
  const facts = pricingFacts(pricingBlock, source)
  const placement = blockPlacement(blocks, BLOCK_TYPE.PRICING)
  const text = collectDocumentText(blocks)
  const findings = runHealthRules({
    blocks,
    proposal: source,
    text,
    summaryBlock,
    termsBlock,
    timelineBlock,
    deliverablesBlock,
    signatureBlock,
    pricingBlock,
    hasPricing: Boolean(pricingBlock),
    hasTerms: Boolean(termsBlock),
    hasSummary: Boolean(summaryBlock),
    placement,
    hasMilestoneSchedule: facts.hasMilestones,
  })

  const passed = checks.filter((check) => check.pass).length
  const overallScore = blendScores([
    { score: completenessScore(checks), weight: COMPLETENESS_WEIGHT },
    { score: qualityScore(findings), weight: QUALITY_WEIGHT },
  ])
  const readingScore = readingScoreFromText(text)
  const warnings = findings.filter(
    (finding) =>
      finding.severity === FINDING_SEVERITY.WARNING ||
      finding.severity === FINDING_SEVERITY.CRITICAL,
  )
  const suggestions = findings.filter((finding) => finding.suggestion)

  return makeInsightsSnapshot({
    proposalId: source.id ?? null,
    source: INSIGHTS_SOURCE.HEALTH,
    overallScore,
    completionPercent:
      checks.length > 0 ? clampScore((passed / checks.length) * 100) : 0,
    readingScore,
    estimatedQuality: blendScores([
      { score: overallScore, weight: 3 },
      { score: readingScore, weight: 1 },
    ]),
    winProbability: null,
    warnings,
    suggestions,
    reviewHistory: [],
    pricing: makePricingInsight({
      ...facts,
      hasPricing: Boolean(pricingBlock),
      placement: pricingBlock ? placement : PRICING_PLACEMENT.MISSING,
    }),
    checks,
  })
}
