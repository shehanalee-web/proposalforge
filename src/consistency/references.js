import { BLOCK_TYPE } from '../blocks/ids.js'
import { blockPlainText } from '../insights/document.js'
import {
  CONSISTENCY_SECTION,
  CONSISTENCY_SECTION_LABELS,
  SECTION_GRAPH,
} from './relationships.js'

const DURATION_RE =
  /(\d+(?:\.\d+)?)\s*(?:business\s+)?(days?|weeks?|months?|hours?|hrs?)\b/gi

const DATE_ISO_RE = /\b(\d{4}-\d{2}-\d{2})\b/g
const DATE_NUMERIC_RE = /\b(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/g

const CURRENCY_RE = /\b(usd|eur|gbp|aed|cad|aud)\b|\$|€|£/gi

const QUANTITY_RE =
  /\b(\d+)\s+(units?|items?|copies|sets?|hours?|hrs?|milestones?|deliverables?|walls?|screens?)\b/gi

const REFERENCE_RE =
  /\b(?:see|refer to|as (?:set out|described|detailed) in|per(?: the)?)\s+(?:the\s+)?(timeline|schedule|deliverables?|pricing|warranty|exclusions?|assumptions?|appendix|executive summary|objectives?|acceptance)\b/gi

const MONTHS = Object.freeze({
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
})

const FAMILY_TERMS = Object.freeze([
  { id: 'hvac', terms: ['hvac', 'air conditioning', 'mechanical ventilation'] },
  {
    id: 'architecture_model',
    terms: ['scale model', 'architectural model', 'physical model'],
  },
  { id: 'fitout', terms: ['fit-out', 'fit out', 'fitout'] },
  { id: 'brand', terms: ['brand identity', 'logo system', 'brand guidelines'] },
  { id: 'web', terms: ['website', 'e-commerce', 'web app', 'storefront'] },
  { id: 'fabrication', terms: ['fabrication', 'steel staircase'] },
])

const REFERENCE_TARGET = Object.freeze({
  timeline: CONSISTENCY_SECTION.TIMELINE,
  schedule: CONSISTENCY_SECTION.TIMELINE,
  deliverable: CONSISTENCY_SECTION.DELIVERABLES,
  deliverables: CONSISTENCY_SECTION.DELIVERABLES,
  pricing: CONSISTENCY_SECTION.PRICING,
  warranty: CONSISTENCY_SECTION.WARRANTY,
  exclusion: CONSISTENCY_SECTION.EXCLUSIONS,
  exclusions: CONSISTENCY_SECTION.EXCLUSIONS,
  assumptions: CONSISTENCY_SECTION.ASSUMPTIONS,
  appendix: CONSISTENCY_SECTION.SUMMARY,
  'executive summary': CONSISTENCY_SECTION.SUMMARY,
  objective: CONSISTENCY_SECTION.OBJECTIVES,
  objectives: CONSISTENCY_SECTION.OBJECTIVES,
  acceptance: CONSISTENCY_SECTION.ACCEPTANCE,
})

function unitToDays(amount, unit) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return null
  const key = String(unit).toLowerCase()
  if (key.startsWith('hour') || key.startsWith('hr')) return n / 24
  if (key.startsWith('day')) return n
  if (key.startsWith('week')) return n * 7
  if (key.startsWith('month')) return n * 30
  return null
}

function extractDurations(text) {
  const found = []
  const source = String(text ?? '')
  DURATION_RE.lastIndex = 0
  let match
  while ((match = DURATION_RE.exec(source))) {
    const days = unitToDays(match[1], match[2])
    if (days == null) continue
    found.push({
      raw: match[0].trim(),
      days,
      index: match.index,
    })
  }
  return found
}

function parseIsoDate(value) {
  const stamp = Date.parse(value)
  return Number.isFinite(stamp) ? stamp : null
}

function parseNumericDate(value) {
  const parts = String(value).split(/[/.]/)
  if (parts.length !== 3) return null
  let [a, b, c] = parts.map((part) => Number(part))
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null
  if (c < 100) c += 2000
  const monthFirst = a <= 12
  const month = monthFirst ? a - 1 : b - 1
  const day = monthFirst ? b : a
  const stamp = Date.UTC(c, month, day)
  return Number.isFinite(stamp) ? stamp : null
}

function extractDates(text) {
  const found = []
  const source = String(text ?? '')
  DATE_ISO_RE.lastIndex = 0
  let match
  while ((match = DATE_ISO_RE.exec(source))) {
    const stamp = parseIsoDate(match[1])
    if (stamp == null) continue
    found.push({ raw: match[1], stamp })
  }
  DATE_NUMERIC_RE.lastIndex = 0
  while ((match = DATE_NUMERIC_RE.exec(source))) {
    const stamp = parseNumericDate(match[1])
    if (stamp == null) continue
    found.push({ raw: match[1], stamp })
  }
  const monthRe =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/gi
  while ((match = monthRe.exec(source))) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()]
    const day = Number(match[2])
    if (!match[3]) continue
    const year = Number(match[3])
    if (month == null || !Number.isFinite(day) || !Number.isFinite(year)) continue
    found.push({
      raw: match[0],
      stamp: Date.UTC(year, month, day),
    })
  }
  return found
}

function extractCurrencies(text) {
  const found = new Set()
  const source = String(text ?? '')
  CURRENCY_RE.lastIndex = 0
  let match
  while ((match = CURRENCY_RE.exec(source))) {
    const token = match[0].toUpperCase()
    if (token === '$') found.add('USD')
    else if (token === '€') found.add('EUR')
    else if (token === '£') found.add('GBP')
    else found.add(token)
  }
  return [...found]
}

function extractQuantities(text) {
  const found = []
  const source = String(text ?? '')
  QUANTITY_RE.lastIndex = 0
  let match
  while ((match = QUANTITY_RE.exec(source))) {
    found.push({
      raw: match[0].trim(),
      amount: Number(match[1]),
      unit: match[2].toLowerCase(),
    })
  }
  return found
}

function detectFamilies(text) {
  const source = String(text ?? '').toLowerCase()
  return FAMILY_TERMS.filter((family) =>
    family.terms.some((term) => source.includes(term)),
  ).map((family) => family.id)
}

function extractReferences(text) {
  const found = []
  const source = String(text ?? '')
  REFERENCE_RE.lastIndex = 0
  let match
  while ((match = REFERENCE_RE.exec(source))) {
    const key = match[1].toLowerCase()
    const target = REFERENCE_TARGET[key]
    if (!target) continue
    found.push({ raw: match[0].trim(), target })
  }
  return found
}

function headingOf(block) {
  const data = block?.data ?? {}
  return String(data.heading || data.kicker || data.title || '').trim()
}

function classifyRichText(block) {
  const heading = headingOf(block).toLowerCase()
  if (/objectiv|goal/.test(heading)) return CONSISTENCY_SECTION.OBJECTIVES
  if (/assumption/.test(heading)) return CONSISTENCY_SECTION.ASSUMPTIONS
  if (/exclusion|not included|out of scope/.test(heading)) {
    return CONSISTENCY_SECTION.EXCLUSIONS
  }
  if (/warrant|guarantee/.test(heading)) return CONSISTENCY_SECTION.WARRANTY
  return null
}

function pushText(bucket, sectionId, text, block) {
  const next = String(text ?? '').trim()
  if (!next) return
  const current = bucket.get(sectionId) ?? {
    id: sectionId,
    label: CONSISTENCY_SECTION_LABELS[sectionId],
    text: '',
    blockIds: [],
    blockType: block?.type ?? null,
  }
  current.text = current.text ? `${current.text}\n${next}` : next
  if (block?.id && !current.blockIds.includes(block.id)) {
    current.blockIds.push(block.id)
  }
  if (block?.type && !current.blockType) current.blockType = block.type
  bucket.set(sectionId, current)
}

function titlesFrom(block, key) {
  const items = block?.data?.[key] ?? []
  return items
    .map((item) => String(item.title || item.description || '').trim())
    .filter(Boolean)
}

/**
 * Gather per-section text and structured claims from live blocks.
 *
 * @param {{ proposal?: object, blocks?: object[] }} input
 */
export function collectSectionClaims({ proposal, blocks } = {}) {
  const list = Array.isArray(blocks) ? blocks : []
  const bucket = new Map()

  pushText(
    bucket,
    CONSISTENCY_SECTION.SUMMARY,
    [proposal?.title, proposal?.summary].filter(Boolean).join('\n'),
    list.find((block) => block.type === BLOCK_TYPE.EXECUTIVE_SUMMARY),
  )

  for (const block of list) {
    const text = blockPlainText(block)
    if (block.type === BLOCK_TYPE.COVER || block.type === BLOCK_TYPE.EXECUTIVE_SUMMARY) {
      pushText(bucket, CONSISTENCY_SECTION.SUMMARY, text, block)
      pushText(bucket, CONSISTENCY_SECTION.OBJECTIVES, text, block)
    } else if (block.type === BLOCK_TYPE.DELIVERABLES) {
      pushText(bucket, CONSISTENCY_SECTION.DELIVERABLES, text, block)
    } else if (block.type === BLOCK_TYPE.PRICING) {
      pushText(bucket, CONSISTENCY_SECTION.PRICING, text, block)
    } else if (block.type === BLOCK_TYPE.TIMELINE) {
      pushText(bucket, CONSISTENCY_SECTION.TIMELINE, text, block)
    } else if (block.type === BLOCK_TYPE.TERMS) {
      pushText(bucket, CONSISTENCY_SECTION.WARRANTY, text, block)
      pushText(bucket, CONSISTENCY_SECTION.EXCLUSIONS, text, block)
      pushText(bucket, CONSISTENCY_SECTION.ASSUMPTIONS, text, block)
    } else if (block.type === BLOCK_TYPE.SIGNATURE) {
      pushText(bucket, CONSISTENCY_SECTION.ACCEPTANCE, text, block)
    } else if (block.type === BLOCK_TYPE.RICH_TEXT) {
      const section = classifyRichText(block)
      if (section) pushText(bucket, section, text, block)
    }
  }

  const sections = SECTION_GRAPH.map((node) => {
    const current = bucket.get(node.id) ?? {
      id: node.id,
      label: node.label,
      text: '',
      blockIds: [],
      blockType: node.blockTypes[0],
    }
    const text = current.text
    const durations = extractDurations(text)
    const dates = extractDates(text)
    const maxDuration = durations.reduce(
      (best, item) => (item.days > (best?.days ?? 0) ? item : best),
      null,
    )
    const dateStamps = dates.map((item) => item.stamp).filter(Boolean)
    const dateSpanDays =
      dateStamps.length >= 2
        ? (Math.max(...dateStamps) - Math.min(...dateStamps)) / 86400000
        : null

    return {
      ...current,
      filled: text.trim().length > 0,
      durations,
      maxDuration,
      dates,
      dateSpanDays,
      currencies: extractCurrencies(text),
      quantities: extractQuantities(text),
      families: detectFamilies(text),
      references: extractReferences(text),
      titles:
        node.id === CONSISTENCY_SECTION.DELIVERABLES
          ? list
              .filter((block) => block.type === BLOCK_TYPE.DELIVERABLES)
              .flatMap((block) => titlesFrom(block, 'items'))
          : node.id === CONSISTENCY_SECTION.TIMELINE
            ? list
                .filter((block) => block.type === BLOCK_TYPE.TIMELINE)
                .flatMap((block) => titlesFrom(block, 'items'))
            : node.id === CONSISTENCY_SECTION.PRICING
              ? list
                  .filter((block) => block.type === BLOCK_TYPE.PRICING)
                  .flatMap((block) => titlesFrom(block, 'items'))
              : [],
    }
  })

  return { sections, byId: new Map(sections.map((item) => [item.id, item])) }
}

function duplicatesIn(list) {
  const seen = new Map()
  const dupes = []
  for (const title of list) {
    const key = title.toLowerCase()
    if (seen.has(key)) dupes.push(title)
    else seen.set(key, title)
  }
  return dupes
}

/**
 * Duplicate titles and references to sections that have no copy.
 *
 * @param {{ sections: object[] }} claims
 */
export function findReferenceIssues(claims) {
  const sections = claims?.sections ?? []
  const byId = new Map(sections.map((item) => [item.id, item]))
  const issues = []

  for (const section of sections) {
    for (const ref of section.references) {
      const target = byId.get(ref.target)
      if (target?.filled) continue
      issues.push({
        kind: 'missing_reference',
        from: section.id,
        target: ref.target,
        raw: ref.raw,
        blockIds: section.blockIds,
      })
    }
  }

  for (const section of sections) {
    const dupes = duplicatesIn(section.titles)
    for (const title of dupes) {
      issues.push({
        kind: 'duplicate',
        from: section.id,
        title,
        blockIds: section.blockIds,
      })
    }
  }

  return issues
}
