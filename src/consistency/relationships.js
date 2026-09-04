import { BLOCK_TYPE } from '../blocks/ids.js'

export const CONSISTENCY_SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  INFORMATIONAL: 'informational',
})

export const CONSISTENCY_SEVERITY_LABELS = Object.freeze({
  [CONSISTENCY_SEVERITY.CRITICAL]: 'Critical',
  [CONSISTENCY_SEVERITY.MAJOR]: 'Major',
  [CONSISTENCY_SEVERITY.MINOR]: 'Minor',
  [CONSISTENCY_SEVERITY.INFORMATIONAL]: 'Informational',
})

export const CONSISTENCY_SECTION = Object.freeze({
  SUMMARY: 'executive_summary',
  OBJECTIVES: 'objectives',
  DELIVERABLES: 'deliverables',
  PRICING: 'pricing',
  TIMELINE: 'timeline',
  WARRANTY: 'warranty',
  EXCLUSIONS: 'exclusions',
  ASSUMPTIONS: 'assumptions',
  ACCEPTANCE: 'acceptance',
})

export const CONSISTENCY_SECTION_LABELS = Object.freeze({
  [CONSISTENCY_SECTION.SUMMARY]: 'Executive Summary',
  [CONSISTENCY_SECTION.OBJECTIVES]: 'Objectives',
  [CONSISTENCY_SECTION.DELIVERABLES]: 'Deliverables',
  [CONSISTENCY_SECTION.PRICING]: 'Pricing',
  [CONSISTENCY_SECTION.TIMELINE]: 'Timeline',
  [CONSISTENCY_SECTION.WARRANTY]: 'Warranty',
  [CONSISTENCY_SECTION.EXCLUSIONS]: 'Exclusions',
  [CONSISTENCY_SECTION.ASSUMPTIONS]: 'Assumptions',
  [CONSISTENCY_SECTION.ACCEPTANCE]: 'Acceptance',
})

export const CONSISTENCY_REPAIR = Object.freeze({
  TIMELINE: 'Update Timeline',
  SUMMARY: 'Rewrite Executive Summary',
  PRICING: 'Align Pricing',
  DELIVERABLES: 'Update Deliverables',
  WARRANTY: 'Correct Warranty',
  ASSUMPTIONS: 'Update Assumptions',
  EXCLUSIONS: 'Update Exclusions',
})

/**
 * Deterministic section graph. Edges are declared, never inferred.
 */
export const SECTION_GRAPH = Object.freeze([
  {
    id: CONSISTENCY_SECTION.SUMMARY,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.SUMMARY],
    blockTypes: [BLOCK_TYPE.COVER, BLOCK_TYPE.EXECUTIVE_SUMMARY],
    dependsOn: [],
  },
  {
    id: CONSISTENCY_SECTION.OBJECTIVES,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.OBJECTIVES],
    blockTypes: [BLOCK_TYPE.EXECUTIVE_SUMMARY, BLOCK_TYPE.RICH_TEXT],
    dependsOn: [CONSISTENCY_SECTION.SUMMARY],
  },
  {
    id: CONSISTENCY_SECTION.DELIVERABLES,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.DELIVERABLES],
    blockTypes: [BLOCK_TYPE.DELIVERABLES],
    dependsOn: [CONSISTENCY_SECTION.OBJECTIVES, CONSISTENCY_SECTION.SUMMARY],
  },
  {
    id: CONSISTENCY_SECTION.PRICING,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.PRICING],
    blockTypes: [BLOCK_TYPE.PRICING],
    dependsOn: [CONSISTENCY_SECTION.DELIVERABLES],
  },
  {
    id: CONSISTENCY_SECTION.TIMELINE,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.TIMELINE],
    blockTypes: [BLOCK_TYPE.TIMELINE],
    dependsOn: [CONSISTENCY_SECTION.DELIVERABLES],
  },
  {
    id: CONSISTENCY_SECTION.WARRANTY,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.WARRANTY],
    blockTypes: [BLOCK_TYPE.TERMS],
    dependsOn: [CONSISTENCY_SECTION.TIMELINE],
  },
  {
    id: CONSISTENCY_SECTION.EXCLUSIONS,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.EXCLUSIONS],
    blockTypes: [BLOCK_TYPE.TERMS, BLOCK_TYPE.DELIVERABLES],
    dependsOn: [CONSISTENCY_SECTION.DELIVERABLES],
  },
  {
    id: CONSISTENCY_SECTION.ASSUMPTIONS,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.ASSUMPTIONS],
    blockTypes: [BLOCK_TYPE.TERMS, BLOCK_TYPE.RICH_TEXT],
    dependsOn: [CONSISTENCY_SECTION.TIMELINE, CONSISTENCY_SECTION.PRICING],
  },
  {
    id: CONSISTENCY_SECTION.ACCEPTANCE,
    label: CONSISTENCY_SECTION_LABELS[CONSISTENCY_SECTION.ACCEPTANCE],
    blockTypes: [BLOCK_TYPE.SIGNATURE],
    dependsOn: [CONSISTENCY_SECTION.PRICING, CONSISTENCY_SECTION.TIMELINE],
  },
])

export function buildRelationships(nodes = SECTION_GRAPH) {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    blockTypes: [...node.blockTypes],
    dependsOn: [...node.dependsOn],
    dependents: nodes
      .filter((other) => other.dependsOn.includes(node.id))
      .map((other) => other.id),
  }))
}
