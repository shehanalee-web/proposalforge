/**
 * Heuristic repair effort from intelligence findings. Not a timer.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 */
export function estimateReviewTime(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  if (findings.length === 0) {
    return {
      id: 'quick',
      label: 'Quick Fix',
      detail: '<5 min',
      effort: 0,
    }
  }

  const effort = findings.reduce((sum, item) => sum + Math.max(1, Number(item.effort) || 1), 0)

  if (effort <= 3 && findings.length <= 2) {
    return { id: 'quick', label: 'Quick Fix', detail: '<5 min', effort }
  }
  if (effort <= 10 || findings.length <= 4) {
    return { id: 'medium', label: 'Medium', detail: '10–20 min', effort }
  }
  return { id: 'large', label: 'Large Rewrite', detail: '30–60 min', effort }
}
