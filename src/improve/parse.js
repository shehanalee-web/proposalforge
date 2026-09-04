import { makeImprovementDraft } from './draft.js'
import { ImproveError, IMPROVE_ERROR_CODE } from './errors.js'
import { planPatchForFinding } from './patchPlan.js'

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

function asItems(value, fields) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = {}
      for (const field of fields) {
        row[field] = String(item?.[field] ?? '').trim()
      }
      return row
    })
    .filter((item) => fields.some((field) => item[field]))
}

/**
 * Map a model completion onto the Horizon 3 draft/patch shape.
 *
 * @param {string} text
 * @param {object} request
 */
export function parseImprovementResponse(text, request = {}) {
  const finding = request.finding ?? {}
  const plan = planPatchForFinding(finding)
  const parsed = extractJson(text)

  if (!parsed && !String(text ?? '').trim()) {
    throw new ImproveError('Generation failed.', {
      code: IMPROVE_ERROR_CODE.MALFORMED,
      retryable: true,
    })
  }

  const previewBody = String(
    parsed?.previewBody ?? parsed?.body ?? text ?? '',
  ).trim()
  const previewTitle = String(parsed?.previewTitle ?? finding.title ?? plan.label).trim()
  const append = String(parsed?.append ?? '').trim() || previewBody
  const summary = plan.summary
    ? String(parsed?.summary ?? parsed?.data?.body ?? previewBody).trim()
    : null

  let data = {}
  if (plan.dataShape === 'timeline-items') {
    data = { items: asItems(parsed?.data?.items, ['title', 'date', 'body']) }
    if (!data.items.length) {
      data.items = previewBody
        .split(/\n{2,}/)
        .map((chunk) => {
          const [title, ...rest] = chunk.split(/[.—:]/)
          return { title: title.trim(), date: '', body: rest.join('—').trim() || chunk.trim() }
        })
        .filter((item) => item.title)
        .slice(0, 6)
    }
  } else if (plan.dataShape === 'deliverable-items') {
    data = { items: asItems(parsed?.data?.items, ['title', 'body']) }
    if (!data.items.length) {
      data.items = previewBody
        .split(/\n{2,}/)
        .map((chunk) => {
          const [title, ...rest] = chunk.split(/[:.—]/)
          return { title: title.trim(), body: rest.join(':').trim() || chunk.trim() }
        })
        .filter((item) => item.title)
        .slice(0, 8)
    }
  } else if (plan.dataShape === 'summary-body') {
    data = { body: String(parsed?.data?.body ?? previewBody).trim() }
  }

  return makeImprovementDraft({
    findingId: finding.id ?? '',
    findingCode: finding.code ?? '',
    title: finding.title ?? 'Improvement',
    severity: finding.severity,
    reason: finding.message ?? '',
    suggestion: finding.suggestion ?? '',
    provider: request.provider,
    previewTitle,
    previewBody,
    patch: {
      kind: plan.kind,
      blockType: plan.blockType,
      data,
      append: plan.dataShape === 'append' ? append : '',
      afterTypes: plan.afterTypes ?? [],
      summary,
    },
  })
}
