import { resolveBlocks } from '../insights/document.js'
import { buildRelationships } from './relationships.js'
import { collectSectionClaims, findReferenceIssues } from './references.js'
import { findContradictions } from './contradictions.js'
import { collectRepairs, toImprovementFindings } from './repair.js'
import { consistencyScore } from './integrity.js'
import { integritySummary } from './summary.js'

export const CONSISTENCY_EXTENSIONS = Object.freeze({
  versionComparison: null,
  changeImpact: null,
  contractValidation: null,
  legalVerification: null,
  compliance: null,
  bimComparison: null,
  externalDocuments: null,
})

/**
 * Reserved plug-in hook. Unused until a later horizon.
 *
 * @param {object} report
 * @param {Function[]} [plugins]
 */
export function withConsistencyExtensions(report, plugins = []) {
  if (!Array.isArray(plugins) || plugins.length === 0) return report
  return plugins.reduce((current, plugin) => {
    if (typeof plugin !== 'function') return current
    const next = plugin(current)
    return next && typeof next === 'object' ? next : current
  }, report)
}

/**
 * Cross-section consistency. Consumes proposal blocks (and optional
 * diagnostics for future filters) without changing Health or Intelligence.
 *
 * @param {{
 *   proposal?: object,
 *   blocks?: object[],
 *   diagnostics?: object[],
 *   health?: object,
 * }} [input]
 */
export function analyzeConsistency({ proposal, blocks, diagnostics, health } = {}) {
  void diagnostics
  void health
  const source = proposal && typeof proposal === 'object' ? proposal : {}
  const list = resolveBlocks({ proposal: source, blocks: blocks ?? source.blocks })
  const claims = collectSectionClaims({ proposal: source, blocks: list })
  const referenceIssues = findReferenceIssues(claims)
  const contradictions = findContradictions(claims, referenceIssues, source)
  const score = consistencyScore(contradictions)
  const repairs = collectRepairs(contradictions)
  const summary = integritySummary({ score, contradictions, repairs })

  return withConsistencyExtensions({
    score,
    contradictions,
    relationships: buildRelationships(),
    repairs,
    improvementFindings: toImprovementFindings(contradictions),
    summary,
    extensions: { ...CONSISTENCY_EXTENSIONS },
  })
}
