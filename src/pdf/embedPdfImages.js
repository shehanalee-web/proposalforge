/**
 * @react-pdf/renderer embeds image bytes during `toBlob()`. Fetch public
 * `/uploads/...` (and any other http) image URLs into data URIs first.
 * Attachment / file URLs stay as absolute public links — they are destinations,
 * not Image src.
 */

import { BLOCK_TYPE } from '../blocks/ids.js'
import { toAbsoluteUrl } from '../utils/publicUrl.js'

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

function isImageBlob(blob) {
  return typeof blob?.type === 'string' && blob.type.startsWith('image/')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not encode image.'))
    reader.readAsDataURL(blob)
  })
}

async function embedUrl(url) {
  if (!url || isDataUrl(url)) return url

  const absolute = toAbsoluteUrl(url)

  try {
    const response = await fetch(absolute)
    if (!response.ok) return absolute

    const blob = await response.blob()
    if (!isImageBlob(blob)) return absolute

    return await blobToDataUrl(blob)
  } catch {
    return absolute
  }
}

async function embedAssetRef(ref) {
  if (!ref || typeof ref === 'string') {
    const url = await embedUrl(ref)
    return url
  }

  const url = await embedUrl(ref.url)
  return url === ref.url ? ref : { ...ref, url }
}

async function embedItem(item) {
  if (!item || typeof item !== 'object') return item

  const next = { ...item }

  if (next.url) next.url = await embedUrl(next.url)
  if (next.src) next.src = await embedUrl(next.src)
  if (next.imageUrl) next.imageUrl = await embedUrl(next.imageUrl)
  if (next.photoUrl) next.photoUrl = await embedUrl(next.photoUrl)
  if (next.portraitUrl) next.portraitUrl = await embedUrl(next.portraitUrl)
  if (next.portrait) next.portrait = await embedAssetRef(next.portrait)

  return next
}

async function embedList(list) {
  if (!Array.isArray(list)) return list
  return Promise.all(list.map((item) => embedItem(item)))
}

/**
 * Clone a proposal with image URLs replaced by data URIs for <Image>.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export async function embedProposalImages(proposal) {
  const blocks = await Promise.all(
    (proposal.blocks ?? []).map(async (block) => {
      if (block.type === BLOCK_TYPE.ATTACHMENTS) {
        const data = { ...(block.data ?? {}) }
        if (Array.isArray(data.items)) {
          data.items = data.items.map((item) => ({
            ...item,
            url: toAbsoluteUrl(item.url),
          }))
        }
        return { ...block, data }
      }

      const data = { ...(block.data ?? {}) }

      if (data.imageUrl) data.imageUrl = await embedUrl(data.imageUrl)
      if (Array.isArray(data.items)) data.items = await embedList(data.items)
      if (Array.isArray(data.members)) data.members = await embedList(data.members)
      if (Array.isArray(data.rows)) data.rows = await embedList(data.rows)

      return { ...block, data }
    }),
  )

  return {
    ...proposal,
    blocks,
    images: await embedList(proposal.images ?? []),
  }
}

/**
 * Clone a Brand Kit with logo / portrait URLs replaced by data URIs.
 *
 * @param {import('../models/brandKit.js').BrandKit | null | undefined} kit
 */
export async function embedBrandKitImages(kit) {
  if (!kit) return kit

  const logos = kit.logos
    ? {
        ...kit.logos,
        primary: await embedAssetRef(kit.logos.primary),
        light: await embedAssetRef(kit.logos.light),
        dark: await embedAssetRef(kit.logos.dark),
        favicon: await embedAssetRef(kit.logos.favicon),
        cover: await embedAssetRef(kit.logos.cover),
      }
    : kit.logos

  const signature = kit.signature
    ? {
        ...kit.signature,
        image: await embedAssetRef(kit.signature.image),
        imageUrl: await embedUrl(kit.signature.imageUrl),
      }
    : kit.signature

  return {
    ...kit,
    logos,
    signature,
    teamMembers: await embedList(kit.teamMembers ?? []),
    testimonials: await embedList(kit.testimonials ?? []),
  }
}
