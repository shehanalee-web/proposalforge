/**
 * @typedef {object} IntelligenceFinding
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {string} severity
 * @property {string} businessPriority
 * @property {string} businessImpact
 * @property {string} clientImpact
 * @property {string} legalImpact
 * @property {string} commercialImpact
 * @property {string} professionalismImpact
 * @property {string} repairDifficulty
 * @property {number} estimatedValue
 * @property {string} recommendation
 * @property {string} section
 * @property {string} band
 * @property {number} effort
 * @property {number} businessScore
 * @property {string} riskLabel
 */

/**
 * @typedef {object} IntelligenceRisk
 * @property {string} id
 * @property {string} label
 * @property {string} level
 */

/**
 * @typedef {object} IntelligenceQuickWin
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {string} section
 * @property {number} effort
 * @property {number} estimatedValue
 * @property {number} ratio
 * @property {string} recommendation
 */

/**
 * @typedef {object} IntelligenceRepairStep
 * @property {string} code
 * @property {string} title
 * @property {string} section
 * @property {string} sectionLabel
 * @property {string} band
 */

/**
 * @typedef {object} IntelligenceRepairOrder
 * @property {IntelligenceRepairStep[]} steps
 * @property {string[]} codes
 * @property {object[]} diagnostics
 */

/**
 * @typedef {object} IntelligenceTimeline
 * @property {{ id: string, label: string }[]} immediate
 * @property {{ id: string, label: string }[]} recommended
 * @property {{ id: string, label: string }[]} optional
 */

/**
 * @typedef {object} IntelligenceSection
 * @property {string} id
 * @property {string} label
 * @property {number} confidence
 */

/**
 * @typedef {object} IntelligenceReadiness
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {object} IntelligenceSummary
 * @property {number | null} healthScore
 * @property {string} readiness
 * @property {string} readinessLabel
 * @property {string} highestPriority
 * @property {string} largestRisk
 * @property {string} bestQuickWin
 * @property {number} clientConfidence
 */

/**
 * @typedef {object} ProposalIntelligence
 * @property {IntelligenceFinding[]} findings
 * @property {IntelligenceRisk[]} risks
 * @property {IntelligenceQuickWin[]} quickWins
 * @property {IntelligenceRepairOrder} repairOrder
 * @property {IntelligenceTimeline} timeline
 * @property {IntelligenceSection[]} sections
 * @property {IntelligenceReadiness} readiness
 * @property {IntelligenceSummary} summary
 * @property {number | null} healthScore
 * @property {Record<string, null>} extensions
 */

export {}
