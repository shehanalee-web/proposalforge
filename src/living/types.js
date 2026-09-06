/**
 * Living Proposal contracts.
 *
 * Phase 14.7 enables studio Forge actions over living + H12 + H13.
 * Phase 14.8 adds a studio-only Forge Rive contract / fallback shell.
 * Client living never exposes Forge or Rive (`rive` stays false here).
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
 * Phase 14.7–14.8: studio Forge actions + Rive contract (studio chrome only).
 * Client living page never exposes Forge or Rive.
 */
export const LIVING_CAPABILITIES = Object.freeze({
  packages: true,
  addons: true,
  alternatives: true,
  selections: true,
  commercialEvents: true,
  livingSession: true,
  snapshots: true,
  h12Interactions: true,
  commercialSelectionFollowup: true,
  forgeActions: true,
  rive: false,
})
