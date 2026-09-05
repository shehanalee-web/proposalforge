/**
 * Living Proposal contracts.
 *
 * Phase 1 defines names and capability flags only. Packages, add-ons,
 * selections, snapshots, and Forge actions stay off until later H14 phases.
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
 * Later H14 phases flip these on. Phase 1 rendering must not pretend they exist.
 */
export const LIVING_CAPABILITIES = Object.freeze({
  packages: false,
  addons: false,
  alternatives: false,
  selections: false,
  commercialEvents: false,
  livingSession: false,
  snapshots: false,
  forgeActions: false,
  rive: false,
})
