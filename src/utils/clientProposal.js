/**
 * Resolve the document a client should see.
 *
 * Live proposal fields are the current working copy. When version history is
 * present, the current (or latest) snapshot is applied so the portal always
 * shows the newest active version without rewriting stored history.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 * @returns {import('../models/proposal.js').Proposal}
 */
export function getActiveProposal(proposal) {
  const versions = proposal.versions

  if (!Array.isArray(versions) || versions.length === 0) {
    return proposal
  }

  const current =
    versions.find((version) => version.versionNumber === proposal.currentVersion) ??
    versions.reduce((latest, version) =>
      version.versionNumber > latest.versionNumber ? version : latest,
    )

  const snapshot = current?.snapshot

  if (!snapshot) return proposal

  const metadata = snapshot.metadata ?? {}

  return {
    ...proposal,
    title: snapshot.title ?? proposal.title,
    summary: snapshot.summary ?? snapshot.description ?? proposal.summary,
    sections: snapshot.sections ?? proposal.sections,
    items: snapshot.items ?? proposal.items,
    amount: snapshot.amount ?? snapshot.pricing?.amount ?? proposal.amount,
    currency: snapshot.currency ?? snapshot.pricing?.currency ?? proposal.currency,
    terms: snapshot.terms ?? proposal.terms,
    notes: snapshot.notes ?? proposal.notes,
    clientName: snapshot.clientName ?? metadata.clientName ?? proposal.clientName,
    clientEmail:
      snapshot.clientEmail ?? metadata.clientEmail ?? proposal.clientEmail,
    company: snapshot.company ?? metadata.company ?? proposal.company,
    projectType:
      snapshot.projectType ?? metadata.projectType ?? proposal.projectType,
    tags: snapshot.tags ?? metadata.tags ?? proposal.tags,
    validUntil: snapshot.validUntil ?? metadata.validUntil ?? proposal.validUntil,
  }
}

/**
 * @param {string} shareToken
 * @returns {string}
 */
export function getClientPortalPath(shareToken) {
  return `/p/${shareToken}`
}

/**
 * @param {string} shareToken
 * @returns {string}
 */
export function getClientPortalUrl(shareToken) {
  const path = getClientPortalPath(shareToken)

  if (typeof window === 'undefined' || !window.location?.origin) {
    return path
  }

  return `${window.location.origin}${path}`
}
