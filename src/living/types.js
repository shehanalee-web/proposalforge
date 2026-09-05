/**
 * Living Proposal contracts.
 *
 * Phase 2 enables authored offer presentation only. Selections, snapshots,
 * Forge actions, and commercial engagement events stay off.
 * Event names match the H14 brief so later phases emit through one pipe.
 */

export const LIVING_EVENT = Object.freeze({
  PROPOSAL_OPENED: 'proposal_opened',
  SECTION_VIEWED: 'section_viewed',
  PRICING_VIEWED: 'pricing_viewed',
  PACKAGE_EXPANDED: 'package_expanded',
  PACKAGE_SELECTED: 'package_selected',
  ADDON_SELECTED: 'addon_selected',
  QUESTION_ANSWERED: 'question_answered',
  COMMENT_ADDED: 'comment_added',
  CHANGE_REQUESTED: 'change_requested',
  ACCEPTANCE_STARTED: 'acceptance_started',
  ACCEPTED: 'accepted',
})

export const LIVING_EVENTS = Object.freeze(Object.values(LIVING_EVENT))

export const LIVING_PUBLICATION_SOURCE = Object.freeze({
  AUTHORED: 'authored',
  PUBLISHED: 'published',
})

export const LIVING_SECTION_KIND = Object.freeze({
  CONTENT: 'content',
  COMMERCIAL: 'commercial',
  CLOSE: 'close',
})

/**
 * Later H14 phases flip the remaining flags. Phase 2 only presents authored
 * packages, add-ons, and alternatives — it does not persist selections.
 */
export const LIVING_CAPABILITIES = Object.freeze({
  packages: true,
  addons: true,
  alternatives: true,
  selections: false,
  commercialEvents: false,
  livingSession: false,
  snapshots: false,
  forgeActions: false,
  rive: false,
})
