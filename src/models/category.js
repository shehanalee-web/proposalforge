/**
 * Catalogue categories sit between industry and service template.
 *
 * Add a category in seed data; this module only normalises and looks up ids.
 */

export const CATEGORY = Object.freeze({
  ALL: '',
})

/**
 * @typedef {object} ServiceCategory
 * @property {string} id
 * @property {string} label
 * @property {string} industryId
 * @property {string} color
 * @property {string} icon
 */

/**
 * @param {Partial<ServiceCategory>} [input]
 * @returns {ServiceCategory}
 */
export function makeCategory(input = {}) {
  return {
    id: String(input.id ?? '').trim(),
    label: String(input.label ?? '').trim(),
    industryId: String(input.industryId ?? '').trim(),
    color: input.color ?? '#71717a',
    icon: input.icon ?? 'services',
  }
}

/**
 * @param {ServiceCategory[]} categories
 * @param {string} [id]
 * @returns {string}
 */
export function getCategoryLabel(categories, id) {
  if (!id) return ''
  return categories.find((category) => category.id === id)?.label ?? ''
}

/**
 * Categories for one industry, or the full set when industry is All.
 *
 * @param {ServiceCategory[]} categories
 * @param {string} [industryId]
 * @returns {ServiceCategory[]}
 */
export function categoriesForIndustry(categories, industryId) {
  const list = Array.isArray(categories) ? categories : []
  if (!industryId) return list
  return list.filter((category) => category.industryId === industryId)
}
