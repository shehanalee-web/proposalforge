import { interpretFinding } from './businessImpact.js'
import { rankFindings } from './rank.js'
import { summarizeRisks } from './risk.js'
import { pickQuickWins } from './quickWins.js'
import { sectionConfidence } from './confidence.js'
import { buildRepairOrder, buildTimeline } from './repairOrder.js'
import { proposalReadiness } from './readiness.js'
import { executiveSummary, attachInsightSummary } from './summary.js'
import { buildForecast } from './forecast.js'
import {
  buildExecutiveInsights,
  executivePriority,
} from './executiveInsights.js'
import { identifyStrengths } from './strengths.js'
import { clusterWeaknesses } from './clusters.js'
import { estimateReviewTime } from './reviewTime.js'

/**
 * Reserved slots for later plug-ins. Values stay null until a future
 * horizon fills them — this engine never computes them.
 */
export const INTELLIGENCE_EXTENSIONS = Object.freeze({
  winProbability: null,
  historicalSuccessRates: null,
  industryBenchmarking: null,
  proposalAnalytics: null,
  pricingIntelligence: null,
  crmContext: null,
  clientBehavior: null,
  proposalMemory: null,
  brandKnowledge: null,
  rag: null,
  executiveSummaries: null,
  aiFollowUp: null,
  aiEmail: null,
  aiMeetingPrep: null,
  winProbabilityPrediction: null,
  historicalComparisons: null,
  crmInsights: null,
  buyerBehaviour: null,
  scoringTrends: null,
  proposalCoaching: null,
  aiReasoning: null,
})

/**
 * Apply optional intelligence plug-ins. Unused today; kept so later
 * horizons can attach Win Probability, CRM, RAG, and similar without
 * touching the deterministic core.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 * @param {((current: import('./types.js').ProposalIntelligence) => import('./types.js').ProposalIntelligence | null | undefined)[]} [plugins]
 * @returns {import('./types.js').ProposalIntelligence}
 */
export function withIntelligenceExtensions(report, plugins = []) {
  if (!Array.isArray(plugins) || plugins.length === 0) return report
  return plugins.reduce((current, plugin) => {
    if (typeof plugin !== 'function') return current
    const next = plugin(current)
    return next && typeof next === 'object' ? next : current
  }, report)
}

function resolveDiagnostics(diagnostics, health) {
  if (Array.isArray(diagnostics)) return diagnostics
  if (Array.isArray(health?.suggestions)) return health.suggestions
  return []
}

/**
 * Interpret Health diagnostics into business intelligence.
 *
 * Does not rescan proposal text, does not recalculate Health Score, and
 * does not call an LLM. `proposal` is accepted for future metadata-aware
 * plug-ins; this horizon does not read document body from it.
 *
 * @param {{
 *   proposal?: object,
 *   diagnostics?: object[],
 *   health?: object,
 * }} [input]
 * @returns {import('./types.js').ProposalIntelligence}
 */
export function analyzeProposal({ proposal, diagnostics, health } = {}) {
  void proposal
  const snapshot = health && typeof health === 'object' ? health : {}
  const list = resolveDiagnostics(diagnostics, snapshot)
  const findings = rankFindings(list.map(interpretFinding))
  const risks = summarizeRisks(findings)
  const quickWins = pickQuickWins(findings)
  const repairOrder = buildRepairOrder(findings, list)
  const timeline = buildTimeline(repairOrder.steps)
  const sections = sectionConfidence(findings, snapshot, list)
  const readiness = proposalReadiness({
    health: snapshot,
    findings,
    risks,
    sections,
  })
  const summary = executiveSummary({
    health: snapshot,
    findings,
    risks,
    quickWins,
    readiness,
    sections,
  })

  const report = {
    findings,
    risks,
    quickWins,
    repairOrder,
    timeline,
    sections,
    readiness,
    summary,
    healthScore: summary.healthScore,
  }

  const insights = {
    observations: buildExecutiveInsights(report),
    executivePriority: executivePriority(report),
    strengths: identifyStrengths(report),
    clusters: clusterWeaknesses(report),
    forecast: buildForecast(report),
    reviewTime: estimateReviewTime(report),
  }

  return withIntelligenceExtensions({
    ...report,
    summary: attachInsightSummary(summary, insights),
    insights,
    healthScore: summary.healthScore,
    extensions: { ...INTELLIGENCE_EXTENSIONS },
  })
}
