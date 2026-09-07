/**
 * Living Proposal contracts.
 *
 * H14 close-binding hardening: sessions carry publication revision identity,
 * publish emits `republished`, and acceptance freezes a decision snapshot.
 * Rive and client Forge stay off. Vendor signature/payment stay off.
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
  /** Studio-only: emitted when an immutable living publication is created. */
  REPUBLISHED: 'republished',
  /** Studio-only: H15 commercial close opened (recorded via living event store). */
  CLOSE_OPENED: 'close.opened',
})

export const LIVING_EVENTS = Object.freeze(Object.values(LIVING_EVENT))

/** Event types clients may not POST. Recorded only by studio paths. */
export const LIVING_STUDIO_ONLY_EVENTS = Object.freeze([
  LIVING_EVENT.REPUBLISHED,
  LIVING_EVENT.CLOSE_OPENED,
])

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
 * H14 capabilities through close-binding hardening.
 * Client living page never exposes Forge or Rive.
 * Vendor close flags stay false until H15 architecture.
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
  decisionSnapshots: true,
  rive: false,
})
