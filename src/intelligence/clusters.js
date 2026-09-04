import { FINDING_CODE } from '../insights/ids.js'

const CLUSTER_ORDER = Object.freeze(['communication', 'commercial', 'risk', 'implementation', 'formatting'])

const CLUSTER_LABELS = Object.freeze({
  communication: 'Communication',
  commercial: 'Commercial',
  risk: 'Risk',
  implementation: 'Implementation',
  formatting: 'Formatting',
})

const CLUSTER_FOR_CODE = Object.freeze({
  [FINDING_CODE.MISSING_OBJECTIVES]: 'communication',
  [FINDING_CODE.WEAK_SUMMARY]: 'communication',
  [FINDING_CODE.WEAK_VALUE_PROPOSITION]: 'communication',
  [FINDING_CODE.LONG_SUMMARY]: 'communication',
  [FINDING_CODE.MISSING_DELIVERABLES]: 'commercial',
  [FINDING_CODE.MISSING_EXCLUSIONS]: 'commercial',
  [FINDING_CODE.MISSING_PAYMENT_TERMS]: 'commercial',
  [FINDING_CODE.PRICING_TOO_EARLY]: 'commercial',
  [FINDING_CODE.MISSING_WARRANTY]: 'risk',
  [FINDING_CODE.MISSING_CTA]: 'risk',
  [FINDING_CODE.MISSING_TIMELINE]: 'implementation',
  [FINDING_CODE.LONG_PROPOSAL]: 'formatting',
})

/**
 * Group findings into a few business themes instead of a flat list.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 * @returns {{ id: string, label: string, items: { id: string, code: string, title: string }[] }[]}
 */
export function clusterWeaknesses(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  const buckets = new Map(CLUSTER_ORDER.map((id) => [id, []]))

  for (const finding of findings) {
    const cluster = CLUSTER_FOR_CODE[finding.code]
    if (!cluster) continue
    buckets.get(cluster).push({
      id: finding.id,
      code: finding.code,
      title: finding.cardTitle || finding.title,
    })
  }

  return CLUSTER_ORDER.filter((id) => buckets.get(id).length > 0).map((id) => ({
    id,
    label: CLUSTER_LABELS[id],
    items: buckets.get(id),
  }))
}
