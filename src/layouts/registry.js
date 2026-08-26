import { DEFAULT_LAYOUT_ID, LAYOUT_IDS } from './ids.js'
import { landscapeLayout } from './definitions/landscape.js'
import { portraitLayout } from './definitions/portrait.js'

/**
 * @typedef {object} LayoutRegion
 * @property {string} id
 * @property {1 | 2} columns
 * @property {string[]} [blocks] Legacy layout slot ids.
 * @property {string[]} [accept] Block Engine types, or '*'.
 * @property {string[]} [chrome] Presentation-only slots (notes, tags).
 */

/**
 * @typedef {object} PdfSequenceStep
 * @property {'stack' | 'row' | 'content'} type
 * @property {string[]} [blocks]
 * @property {string[]} [chrome]
 * @property {string[]} [accept]
 * @property {string[]} [skip]
 */

/**
 * @typedef {object} LayoutDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {'A4'} pageSize
 * @property {'portrait' | 'landscape'} orientation
 * @property {{ maxWidth: string, variant: string, regions: LayoutRegion[] }} screen
 * @property {{ size: 'A4', orientation: 'portrait' | 'landscape', sequence: PdfSequenceStep[] }} pdf
 */

/**
 * Registered layouts. Add a definition here to ship a new type (Quotation,
 * Contract, Catalogue, …) without changing the proposal model.
 *
 * @type {readonly LayoutDefinition[]}
 */
export const LAYOUTS = Object.freeze([portraitLayout, landscapeLayout])

const LAYOUT_BY_ID = new Map(LAYOUTS.map((layout) => [layout.id, layout]))

export function isKnownLayoutId(id) {
  return LAYOUT_IDS.includes(id)
}

/**
 * Resolve a stored layout id to a registered definition.
 *
 * Unknown ids (from a newer app version, or a future layout) fall back to the
 * default so rendering never fails. The stored id is left unchanged.
 *
 * @param {string | null | undefined} id
 * @returns {LayoutDefinition}
 */
export function getLayout(id) {
  return LAYOUT_BY_ID.get(id) ?? LAYOUT_BY_ID.get(DEFAULT_LAYOUT_ID)
}

/**
 * @param {string | null | undefined} id
 * @returns {string}
 */
export function resolveLayoutId(id) {
  return isKnownLayoutId(id) ? id : DEFAULT_LAYOUT_ID
}

export function listLayouts() {
  return LAYOUTS
}
