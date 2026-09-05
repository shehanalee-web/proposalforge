import { ImproveError, IMPROVE_ERROR_CODE } from '../improve/errors.js'
import { GENERATOR_SECTION, GENERATOR_SECTIONS } from './types.js'

function extractJson(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

function asString(value) {
  return String(value ?? '').trim()
}

function asStringList(value) {
  if (Array.isArray(value)) return value.map((entry) => asString(entry)).filter(Boolean)
  const text = asString(value)
  return text ? [text] : []
}

function asBlocks(value) {
  if (!Array.isArray(value)) {
    const body = asString(value)
    return body ? [{ heading: '', body, items: [] }] : []
  }
  return value
    .map((block) => ({
      heading: asString(block?.heading ?? block?.title),
      body: asString(block?.body ?? block?.content),
      items: Array.isArray(block?.items)
        ? block.items
            .map((item) => {
              if (typeof item === 'string') return { title: item, body: '' }
              return {
                title: asString(item?.title ?? item?.heading),
                body: asString(item?.body ?? item?.description),
                date: asString(item?.date),
                amount: item?.amount,
              }
            })
            .filter((item) => item.title || item.body)
        : [],
    }))
    .filter((block) => block.heading || block.body || block.items.length)
}

function asSection(entry) {
  const type = asString(entry?.type).replace(/-/g, '_')
  if (!GENERATOR_SECTIONS.includes(type) && type !== GENERATOR_SECTION.COVER) {
    const title = asString(entry?.title)
    if (!title && !asBlocks(entry?.blocks).length) return null
    return {
      type: type || GENERATOR_SECTION.SCOPE,
      title: title || 'Section',
      blocks: asBlocks(entry?.blocks ?? entry?.content),
    }
  }
  return {
    type,
    title: asString(entry?.title) || type,
    blocks: asBlocks(entry?.blocks ?? entry?.content),
  }
}

function asSources(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => ({
      id: asString(entry?.id ?? entry?.knowledgeId),
      title: asString(entry?.title),
    }))
    .filter((entry) => entry.id || entry.title)
}

/**
 * Validate provider JSON before it can enter the editor.
 *
 * @param {string|object} raw
 */
export function parseGeneratedProposal(raw) {
  const parsed = typeof raw === 'object' && raw ? raw : extractJson(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections.map(asSection).filter(Boolean)
    : []

  if (!asString(parsed.title) && sections.length === 0) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  return {
    title: asString(parsed.title),
    metadata: {
      proposalType: asString(parsed.metadata?.proposalType),
      clientName: asString(parsed.metadata?.clientName),
      industry: asString(parsed.metadata?.industry),
    },
    sections,
    assumptions: asStringList(parsed.assumptions),
    exclusions: asStringList(parsed.exclusions),
    sources: asSources(parsed.sources),
  }
}

export { extractJson }
