import {
  CONSISTENCY_REPAIR,
  CONSISTENCY_SECTION,
  CONSISTENCY_SECTION_LABELS,
  CONSISTENCY_SEVERITY,
} from './relationships.js'

function labelOf(id) {
  return CONSISTENCY_SECTION_LABELS[id] || id
}

function makeContradiction(input) {
  return {
    id: input.id ?? `cons-${input.code}`,
    code: input.code,
    severity: input.severity,
    title: input.title,
    explanation: input.explanation,
    suggestion: input.suggestion,
    repairs: input.repairs ?? [],
    sections: input.sections ?? [],
    blockIds: [...new Set(input.blockIds ?? [])],
    blockType: input.blockType ?? null,
    navigateTo: input.navigateTo ?? input.blockIds?.[0] ?? null,
  }
}

function durationConflict(left, right, sections) {
  if (!left?.maxDuration || !right?.maxDuration) return null
  if (left.id === right.id) return null
  const a = left.maxDuration.days
  const b = right.maxDuration.days
  const high = Math.max(a, b)
  const low = Math.min(a, b)
  if (low <= 0) return null
  const ratio = high / low
  if (ratio < 1.45 && Math.abs(a - b) < 7) return null

  const severity =
    ratio >= 2 || Math.abs(a - b) >= 21
      ? CONSISTENCY_SEVERITY.CRITICAL
      : CONSISTENCY_SEVERITY.MAJOR

  const first = a >= b ? left : right
  const second = first === left ? right : left
  const timelineSide = [left, right].find((item) => item.id === CONSISTENCY_SECTION.TIMELINE)
  return makeContradiction({
    code: `duration_${left.id}_${right.id}`,
    severity,
    title: 'Conflicting durations',
    explanation: `${labelOf(first.id)} states ${first.maxDuration.raw} while ${labelOf(second.id)} states ${second.maxDuration.raw}. Clients may lose confidence because different sections communicate conflicting expectations.`,
    suggestion: `Align the duration in ${labelOf(left.id)} and ${labelOf(right.id)} so both describe the same engagement length.`,
    repairs: sections,
    sections: [left.id, right.id],
    blockIds: [...(left.blockIds ?? []), ...(right.blockIds ?? [])],
    blockType: timelineSide?.blockType ?? first.blockType,
    navigateTo: timelineSide?.blockIds?.[0] ?? first.blockIds?.[0] ?? second.blockIds?.[0] ?? null,
  })
}

function dateSpanConflict(timeline, other) {
  if (!timeline?.dateSpanDays || !other?.maxDuration) return null
  const span = timeline.dateSpanDays
  const claimed = other.maxDuration.days
  if (span < 1 || claimed < 1) return null
  const ratio = Math.max(span, claimed) / Math.min(span, claimed)
  if (ratio < 1.5) return null
  return makeContradiction({
    code: `dates_${timeline.id}_${other.id}`,
    severity: CONSISTENCY_SEVERITY.MAJOR,
    title: 'Conflicting dates',
    explanation: `${labelOf(timeline.id)} spans about ${Math.round(span)} days while ${labelOf(other.id)} states ${other.maxDuration.raw}.`,
    suggestion: `Update the dates or the stated duration so the calendar and the copy agree.`,
    repairs: [CONSISTENCY_REPAIR.TIMELINE, CONSISTENCY_REPAIR.SUMMARY],
    sections: [timeline.id, other.id],
    blockIds: [...(timeline.blockIds ?? []), ...(other.blockIds ?? [])],
    blockType: timeline.blockType,
    navigateTo: timeline.blockIds?.[0] ?? null,
  })
}

function familyConflict(left, right) {
  const a = new Set(left.families ?? [])
  const b = new Set(right.families ?? [])
  if (a.size === 0 || b.size === 0) return null
  const shared = [...a].filter((id) => b.has(id))
  if (shared.length > 0) return null
  return makeContradiction({
    code: `scope_${left.id}_${right.id}`,
    severity: CONSISTENCY_SEVERITY.CRITICAL,
    title: 'Scope mismatch',
    explanation: `${labelOf(left.id)} describes a different kind of engagement than ${labelOf(right.id)}. Clients may think they are reading two proposals.`,
    suggestion: `Rewrite ${labelOf(left.id)} or ${labelOf(right.id)} so both describe the same scope of work.`,
    repairs: [CONSISTENCY_REPAIR.SUMMARY, CONSISTENCY_REPAIR.DELIVERABLES],
    sections: [left.id, right.id],
    blockIds: [...(left.blockIds ?? []), ...(right.blockIds ?? [])],
    blockType: right.blockType,
    navigateTo: right.blockIds?.[0] ?? left.blockIds?.[0] ?? null,
  })
}

function currencyConflict(sections, proposalCurrency) {
  const tokens = new Set()
  const owners = []
  for (const section of sections) {
    for (const code of section.currencies ?? []) {
      tokens.add(code)
      owners.push(section)
    }
  }
  const declared = String(proposalCurrency ?? '').trim().toUpperCase()
  if (declared) tokens.add(declared)
  if (tokens.size <= 1) return null
  const list = [...tokens]
  return makeContradiction({
    code: 'currency_mismatch',
    severity: CONSISTENCY_SEVERITY.MAJOR,
    title: 'Conflicting currencies',
    explanation: `The proposal mixes ${list.join(' and ')}. Commercials that switch currency mid-document stall finance review.`,
    suggestion: 'Use one currency in pricing, terms, and the proposal total.',
    repairs: [CONSISTENCY_REPAIR.PRICING],
    sections: [...new Set(owners.map((item) => item.id))],
    blockIds: owners.flatMap((item) => item.blockIds ?? []),
    blockType: owners[0]?.blockType ?? null,
    navigateTo: owners[0]?.blockIds?.[0] ?? null,
  })
}

function quantityConflict(left, right) {
  if (!left?.quantities?.length || !right?.quantities?.length) return null
  for (const a of left.quantities) {
    for (const b of right.quantities) {
      if (a.unit.replace(/s$/, '') !== b.unit.replace(/s$/, '')) continue
      if (a.amount === b.amount) continue
      return makeContradiction({
        code: `quantity_${left.id}_${right.id}_${a.unit}`,
        severity: CONSISTENCY_SEVERITY.MAJOR,
        title: 'Conflicting quantities',
        explanation: `${labelOf(left.id)} states ${a.raw} while ${labelOf(right.id)} states ${b.raw}.`,
        suggestion: `Use the same quantity in ${labelOf(left.id)} and ${labelOf(right.id)}.`,
        repairs: [CONSISTENCY_REPAIR.DELIVERABLES, CONSISTENCY_REPAIR.SUMMARY],
        sections: [left.id, right.id],
        blockIds: [...(left.blockIds ?? []), ...(right.blockIds ?? [])],
        blockType: left.blockType,
        navigateTo: left.blockIds?.[0] ?? null,
      })
    }
  }
  return null
}

function pricingDeliverableMismatch(pricing, deliverables) {
  if (!pricing?.filled || !deliverables?.filled) return null
  const priceText = pricing.text.toLowerCase()
  const titles = deliverables.titles.filter((title) => title.length >= 4)
  if (titles.length < 2) return null
  const missing = titles.filter((title) => {
    const token = title.toLowerCase()
    return token.length >= 4 && !priceText.includes(token)
  })
  const included = /\bincluded\b/i.test(pricing.text)
  if (!included || missing.length === 0) return null
  if (missing.length / titles.length < 0.5) return null
  return makeContradiction({
    code: 'pricing_deliverable_gap',
    severity: CONSISTENCY_SEVERITY.MAJOR,
    title: 'Pricing inconsistency',
    explanation: `Pricing says work is included, but deliverables name ${missing.slice(0, 3).join(', ')} that never appear in the commercials.`,
    suggestion: 'Align priced lines with the deliverable list, or remove items that are not sold.',
    repairs: [CONSISTENCY_REPAIR.PRICING, CONSISTENCY_REPAIR.DELIVERABLES],
    sections: [pricing.id, deliverables.id],
    blockIds: [...(pricing.blockIds ?? []), ...(deliverables.blockIds ?? [])],
    blockType: pricing.blockType,
    navigateTo: pricing.blockIds?.[0] ?? null,
  })
}

function exclusionOverlap(exclusions, deliverables) {
  if (!exclusions?.filled || !deliverables?.titles?.length) return null
  const exclusionText = exclusions.text.toLowerCase()
  if (!/\b(not included|exclusion|out of scope|does not include)\b/i.test(exclusionText)) {
    return null
  }
  const hit = deliverables.titles.find((title) => {
    const token = title.toLowerCase()
    return token.length >= 5 && exclusionText.includes(token)
  })
  if (!hit) return null
  return makeContradiction({
    code: 'exclusion_deliverable_overlap',
    severity: CONSISTENCY_SEVERITY.MAJOR,
    title: 'Exclusion inconsistency',
    explanation: `"${hit}" appears as a deliverable and also in exclusions. Scope that is both in and out of the engagement is a dispute waiting to happen.`,
    suggestion: 'Keep the item in deliverables or in exclusions, not both.',
    repairs: [CONSISTENCY_REPAIR.EXCLUSIONS, CONSISTENCY_REPAIR.DELIVERABLES],
    sections: [exclusions.id, deliverables.id],
    blockIds: [...(exclusions.blockIds ?? []), ...(deliverables.blockIds ?? [])],
    blockType: exclusions.blockType,
    navigateTo: exclusions.blockIds?.[0] ?? null,
  })
}

function warrantyLongerThanProject(warranty, timeline) {
  if (!warranty?.maxDuration || !timeline?.maxDuration) return null
  const terms = String(warranty.text ?? '')
  const lower = terms.toLowerCase()
  const idx = lower.search(/\b(warranty|commissioning|guarantee)\b/)
  const near =
    idx >= 0
      ? warranty.durations.find((item) =>
          terms.slice(Math.max(0, idx - 24), idx + 80).includes(item.raw),
        )
      : null
  const used = near ?? warranty.maxDuration
  const projectDays = timeline.maxDuration.days
  if (used.days <= projectDays) return null
  return makeContradiction({
    code: 'warranty_timeline',
    severity: CONSISTENCY_SEVERITY.MAJOR,
    title: 'Warranty inconsistency',
    explanation: `Warranty language uses ${used.raw} while the timeline is ${timeline.maxDuration.raw}.`,
    suggestion: 'Correct the warranty window or the project duration so post-completion cover fits the engagement.',
    repairs: [CONSISTENCY_REPAIR.WARRANTY, CONSISTENCY_REPAIR.TIMELINE],
    sections: [warranty.id, timeline.id],
    blockIds: [...(warranty.blockIds ?? []), ...(timeline.blockIds ?? [])],
    blockType: warranty.blockType,
    navigateTo: warranty.blockIds?.[0] ?? timeline.blockIds?.[0] ?? null,
  })
}

function fromReferenceIssues(issues, byId) {
  return issues.map((issue) => {
    const from = byId.get(issue.from)
    if (issue.kind === 'missing_reference') {
      return makeContradiction({
        code: `missing_ref_${issue.from}_${issue.target}`,
        severity: CONSISTENCY_SEVERITY.MINOR,
        title: 'Missing referenced information',
        explanation: `${labelOf(issue.from)} refers to ${labelOf(issue.target)} (“${issue.raw}”), but that section has no content.`,
        suggestion: `Add ${labelOf(issue.target)} or remove the reference.`,
        repairs:
          issue.target === CONSISTENCY_SECTION.TIMELINE
            ? [CONSISTENCY_REPAIR.TIMELINE]
            : issue.target === CONSISTENCY_SECTION.DELIVERABLES
              ? [CONSISTENCY_REPAIR.DELIVERABLES]
              : [CONSISTENCY_REPAIR.SUMMARY],
        sections: [issue.from, issue.target],
        blockIds: issue.blockIds,
        blockType: from?.blockType ?? null,
        navigateTo: issue.blockIds?.[0] ?? null,
      })
    }
    return makeContradiction({
      code: `duplicate_${issue.from}_${issue.title}`,
      severity: CONSISTENCY_SEVERITY.INFORMATIONAL,
      title: 'Duplicate information',
      explanation: `${labelOf(issue.from)} lists “${issue.title}” more than once.`,
      suggestion: `Remove the duplicate entry in ${labelOf(issue.from)}.`,
      repairs:
        issue.from === CONSISTENCY_SECTION.DELIVERABLES
          ? [CONSISTENCY_REPAIR.DELIVERABLES]
          : [CONSISTENCY_REPAIR.TIMELINE],
      sections: [issue.from],
      blockIds: issue.blockIds,
      blockType: from?.blockType ?? null,
      navigateTo: issue.blockIds?.[0] ?? null,
    })
  })
}

/**
 * Compare claims that already exist. Empty sections are Health's concern.
 *
 * @param {{ byId: Map<string, object>, sections: object[] }} claims
 * @param {object[]} referenceIssues
 * @param {object} [proposal]
 */
export function findContradictions(claims, referenceIssues = [], proposal = {}) {
  const byId = claims?.byId ?? new Map()
  const summary = byId.get(CONSISTENCY_SECTION.SUMMARY)
  const objectives = byId.get(CONSISTENCY_SECTION.OBJECTIVES)
  const deliverables = byId.get(CONSISTENCY_SECTION.DELIVERABLES)
  const pricing = byId.get(CONSISTENCY_SECTION.PRICING)
  const timeline = byId.get(CONSISTENCY_SECTION.TIMELINE)
  const warranty = byId.get(CONSISTENCY_SECTION.WARRANTY)
  const exclusions = byId.get(CONSISTENCY_SECTION.EXCLUSIONS)

  const found = [
    durationConflict(summary, timeline, [
      CONSISTENCY_REPAIR.TIMELINE,
      CONSISTENCY_REPAIR.SUMMARY,
    ]),
    objectives?.maxDuration?.raw !== summary?.maxDuration?.raw
      ? durationConflict(objectives, timeline, [
          CONSISTENCY_REPAIR.TIMELINE,
          CONSISTENCY_REPAIR.SUMMARY,
        ])
      : null,
    dateSpanConflict(timeline, summary),
    dateSpanConflict(timeline, objectives),
    familyConflict(summary, deliverables),
    (objectives?.families ?? []).join() !== (summary?.families ?? []).join()
      ? familyConflict(objectives, deliverables)
      : null,
    quantityConflict(summary, deliverables),
    quantityConflict(objectives, deliverables),
    currencyConflict(
      [pricing, summary, warranty].filter(Boolean),
      proposal.currency,
    ),
    pricingDeliverableMismatch(pricing, deliverables),
    exclusionOverlap(exclusions, deliverables),
    warrantyLongerThanProject(warranty, timeline),
    ...fromReferenceIssues(referenceIssues, byId),
  ].filter(Boolean)

  const seen = new Set()
  return found.filter((item) => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}
