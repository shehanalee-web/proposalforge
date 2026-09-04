import { persistableUrl } from '../utils/publicUrl.js'
import { findById, load as loadAssets } from './assetStore.js'

function resolveUrl(assetId, url) {
  if (assetId) {
    const asset = findById(assetId)
    if (asset?.url) return asset.url
  }

  return persistableUrl(url)
}

function hydrateRef(ref) {
  if (!ref) return ref

  if (typeof ref === 'string') {
    return { assetId: ref.startsWith('asset-') ? ref : null, url: resolveUrl(ref, ref) }
  }

  const assetId = ref.assetId ?? ref.id ?? null
  return { ...ref, assetId, url: resolveUrl(assetId, ref.url) }
}

function hydrateBlock(block) {
  const data = { ...(block.data ?? {}) }

  if (data.imageAssetId || data.imageUrl) {
    data.imageUrl = resolveUrl(data.imageAssetId, data.imageUrl)
  }

  if (Array.isArray(data.items)) {
    data.items = data.items.map((item) => {
      const next = { ...item }
      next.url = resolveUrl(item.assetId, item.url)
      next.portraitUrl = resolveUrl(item.portraitAssetId, item.portraitUrl)
      if (item.portrait) next.portrait = hydrateRef(item.portrait)
      if (item.assetId) {
        const asset = findById(item.assetId)
        if (asset) {
          if (!next.name) next.name = asset.name
          if (!next.mimeType) next.mimeType = asset.mimeType
          if (!next.sizeBytes) next.sizeBytes = asset.sizeBytes
        }
      }
      return next
    })
  }

  if (Array.isArray(data.members)) {
    data.members = data.members.map((member) => ({
      ...member,
      photoUrl: resolveUrl(member.photoAssetId, member.photoUrl),
      portrait: member.portrait ? hydrateRef(member.portrait) : member.portrait,
    }))
  }

  return { ...block, data }
}

function stripItem(item) {
  if (!item || typeof item !== 'object') return item

  const next = { ...item }
  if (next.url) next.url = persistableUrl(next.url)
  if (next.src) next.src = persistableUrl(next.src)
  if (next.imageUrl) next.imageUrl = persistableUrl(next.imageUrl)
  if (next.photoUrl) next.photoUrl = persistableUrl(next.photoUrl)
  if (next.portraitUrl) next.portraitUrl = persistableUrl(next.portraitUrl)
  if (next.portrait && typeof next.portrait === 'object') {
    next.portrait = {
      ...next.portrait,
      url: persistableUrl(next.portrait.url),
    }
  }
  return next
}

/**
 * Fill display URLs from the Asset Library. Call after assets have loaded.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export function hydrateProposalAssets(proposal) {
  if (!proposal) return proposal

  const blocks = (proposal.blocks ?? []).map(hydrateBlock)
  const images = (proposal.images ?? []).map((item) => ({
    ...item,
    url: resolveUrl(item.assetId, item.url),
  }))

  return { ...proposal, blocks, images }
}

function persistSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot

  const next = {
    ...snapshot,
    blocks: (snapshot.blocks ?? []).map((block) => {
      const data = stripItem(block.data ?? {})
      if (Array.isArray(data.items)) data.items = data.items.map(stripItem)
      if (Array.isArray(data.members)) data.members = data.members.map(stripItem)
      if (Array.isArray(data.rows)) data.rows = data.rows.map(stripItem)
      return { ...block, data }
    }),
    images: (snapshot.images ?? []).map(stripItem),
    uploads: uploadMetadataList(snapshot.uploads),
  }
  delete next.shareToken
  return next
}

function uploadMetadataList(uploads = []) {
  return (uploads ?? []).map((item) => ({
    ...item,
    url: persistableUrl(item.url),
    versions: (item.versions ?? []).map((version) => ({
      ...version,
      url: persistableUrl(version.url),
    })),
  }))
}

/**
 * Drop blob/data URLs so saved JSON never stores a session object URL.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export function persistableProposal(proposal) {
  if (!proposal) return proposal

  const blocks = (proposal.blocks ?? []).map((block) => {
    const data = stripItem(block.data ?? {})
    if (Array.isArray(data.items)) data.items = data.items.map(stripItem)
    if (Array.isArray(data.members)) data.members = data.members.map(stripItem)
    if (Array.isArray(data.rows)) data.rows = data.rows.map(stripItem)
    return { ...block, data }
  })

  return {
    ...proposal,
    blocks,
    images: (proposal.images ?? []).map(stripItem),
    uploads: uploadMetadataList(proposal.uploads),
    versions: (proposal.versions ?? []).map((version) => ({
      ...version,
      snapshot: persistSnapshot(version.snapshot),
    })),
  }
}

export async function prepareProposalAssets(proposal) {
  await loadAssets()
  return hydrateProposalAssets(proposal)
}

export { resolveUrl as resolveAssetUrl }
