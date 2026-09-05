import { FINDING_CODE } from '../insights/ids.js'
import { resolveBlocks, findBlock, blockPlainText } from '../insights/document.js'
import { planPatchForFinding } from '../improve/patchPlan.js'
import { COACH_SECTION } from './types.js'
import { sectionGuidanceFor } from './sectionGuidance.js'

const MAX_SECTION_CHARS = 1200

const SECTION_CODES = Object.freeze({
  [COACH_SECTION.SUMMARY]: FINDING_CODE.WEAK_SUMMARY,
  [COACH_SECTION.OBJECTIVES]: FINDING_CODE.MISSING_OBJECTIVES,
  [COACH_SECTION.DELIVERABLES]: FINDING_CODE.MISSING_DELIVERABLES,
  [COACH_SECTION.TIMELINE]: FINDING_CODE.MISSING_TIMELINE,
  [COACH_SECTION.PRICING]: FINDING_CODE.PRICING_TOO_EARLY,
  [COACH_SECTION.WARRANTY]: FINDING_CODE.MISSING_WARRANTY,
  [COACH_SECTION.EXCLUSIONS]: FINDING_CODE.MISSING_EXCLUSIONS,
  [COACH_SECTION.ASSUMPTIONS]: FINDING_CODE.MISSING_PAYMENT_TERMS,
  [COACH_SECTION.TERMS]: FINDING_CODE.MISSING_PAYMENT_TERMS,
  [COACH_SECTION.ACCEPTANCE]: FINDING_CODE.MISSING_CTA,
  [COACH_SECTION.SIGNATURE]: FINDING_CODE.MISSING_CTA,
  [COACH_SECTION.SCOPE]: FINDING_CODE.MISSING_EXCLUSIONS,
})

function clip(value, limit = MAX_SECTION_CHARS) {
  const text = String(value ?? '').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trim()}…`
}

function firstBlock(blocks, types) {
  const list = Array.isArray(blocks) ? blocks : []
  for (const type of types) {
    const block = findBlock(list, type)
    if (block) return block
  }
  return null
}

export function resolveCompanyVoice(proposal = {}) {
  const brand = proposal.brand && typeof proposal.brand === 'object' ? proposal.brand : {}
  const company =
    proposal.companyProfile && typeof proposal.companyProfile === 'object'
      ? proposal.companyProfile
      : {}
  const tone = String(
    proposal.companyTone ?? proposal.tone ?? brand.tone ?? company.tone ?? '',
  ).trim()
  const voice = String(
    proposal.brandVoice ??
      proposal.voice ??
      brand.voice ??
      brand.brandVoice ??
      company.voice ??
      company.brandVoice ??
      '',
  ).trim()
  return { companyTone: tone, brandVoice: voice, hasVoice: Boolean(tone || voice) }
}

export function resolveBlockId(blocks, { diagnostic, contradiction, section } = {}) {
  if (contradiction?.navigateTo) return contradiction.navigateTo
  const fromIds = contradiction?.blockIds
  if (Array.isArray(fromIds) && fromIds[0]) return fromIds[0]
  if (diagnostic?.blockId) return diagnostic.blockId

  const list = Array.isArray(blocks) ? blocks : []
  const planned = diagnostic?.code ? planPatchForFinding(diagnostic) : null
  if (planned?.blockType) {
    const match = findBlock(list, planned.blockType)
    if (match?.id) return match.id
  }
  if (diagnostic?.blockType) {
    const match = findBlock(list, diagnostic.blockType)
    if (match?.id) return match.id
  }

  const help = sectionGuidanceFor(section)
  const block = firstBlock(list, help.blockTypes)
  return block?.id ?? null
}

export function sectionTextFor(blocks, section, diagnostic) {
  const list = Array.isArray(blocks) ? blocks : []
  const planned = diagnostic?.code ? planPatchForFinding(diagnostic) : null
  const help = sectionGuidanceFor(section)
  const types = planned?.blockType ? [planned.blockType, ...help.blockTypes] : help.blockTypes
  const block = firstBlock(list, types)
  return clip(blockPlainText(block ?? {}))
}

/**
 * Coaching context from existing engine outputs only. No document rescan
 * beyond looking up a navigation target and a short section excerpt.
 */
export function buildCoachContext({
  proposal,
  health,
  diagnostics,
  intelligence,
  consistency,
} = {}) {
  const source = proposal && typeof proposal === 'object' ? proposal : {}
  const blocks = resolveBlocks({ proposal: source, blocks: source.blocks })
  const snapshot = health && typeof health === 'object' ? health : {}
  const diagnosticList = Array.isArray(diagnostics)
    ? diagnostics
    : Array.isArray(intelligence?.repairOrder?.diagnostics)
      ? intelligence.repairOrder.diagnostics
      : Array.isArray(snapshot.suggestions)
        ? snapshot.suggestions
        : []
  const ordered =
    Array.isArray(intelligence?.repairOrder?.diagnostics) &&
    intelligence.repairOrder.diagnostics.length > 0
      ? intelligence.repairOrder.diagnostics
      : diagnosticList
  const findings = Array.isArray(intelligence?.findings) ? intelligence.findings : []
  const findingById = new Map(findings.map((item) => [item.id, item]))
  const findingByCode = new Map(findings.map((item) => [item.code, item]))
  const voice = resolveCompanyVoice(source)

  return {
    proposal: source,
    blocks,
    health: snapshot,
    diagnostics: ordered,
    intelligence: intelligence && typeof intelligence === 'object' ? intelligence : {},
    consistency: consistency && typeof consistency === 'object' ? consistency : {},
    findingById,
    findingByCode,
    companyTone: voice.companyTone,
    brandVoice: voice.brandVoice,
    hasVoice: voice.hasVoice,
    industry: String(source.projectType ?? '').trim(),
    client: String(source.clientName ?? '').trim(),
    company: String(source.company ?? '').trim(),
    proposalType: String(source.projectType ?? '').trim(),
  }
}

export function codeForSection(section) {
  return SECTION_CODES[section] ?? FINDING_CODE.WEAK_SUMMARY
}
