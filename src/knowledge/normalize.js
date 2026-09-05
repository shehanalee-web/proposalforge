const WHITESPACE = /\s+/g
const NON_WORD = /[^\p{L}\p{N}]+/gu

/**
 * Collapse punctuation and case for duplicate / search comparisons.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .replace(WHITESPACE, ' ')
    .trim()
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function tokenize(value) {
  const normalized = normalizeText(value)
  if (!normalized) return []
  return normalized.split(' ').filter(Boolean)
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1 Jaccard similarity of token sets.
 */
export function tokenJaccard(a, b) {
  const left = new Set(tokenize(a))
  const right = new Set(tokenize(b))
  if (left.size === 0 && right.size === 0) return 1
  if (left.size === 0 || right.size === 0) return 0

  let intersection = 0
  for (const token of left) {
    if (right.has(token)) intersection += 1
  }

  const union = left.size + right.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return tokenize(String(value ?? '')).map((tag) => tag.replace(/,/g, ''))
  }

  const seen = new Set()
  const tags = []
  for (const entry of value) {
    const tag = normalizeText(entry)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

export function normalizeTitle(value) {
  return normalizeText(value)
}
