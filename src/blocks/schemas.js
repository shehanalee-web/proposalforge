import { createRecordId } from '../models/ids.js'
import { BLOCK_TYPE } from './ids.js'
import {
  flattenCommercialItems,
  makeCommercialModule,
  modulesFromLegacyItems,
} from '../models/commercial.js'
import { hasAuthoredOffers, makeOfferGroups } from '../models/offer.js'

function items(list, makeItem) {
  return Array.isArray(list) ? list.map(makeItem) : []
}

export function makePricingItem(input = {}) {
  return {
    id: input.id ?? createRecordId('item'),
    description: input.description ?? '',
    amount: Number(input.amount ?? 0),
  }
}

export function makeCoverData(input = {}) {
  return {
    kicker: input.kicker ?? '',
    heading: input.heading ?? '',
    subheading: input.subheading ?? '',
    imageUrl: input.imageUrl ?? '',
    imageAssetId: input.imageAssetId ?? '',
  }
}

export function makeExecutiveSummaryData(input = {}) {
  return { body: input.body ?? '' }
}

export function makeRichTextData(input = {}) {
  return {
    heading: input.heading ?? '',
    body: input.body ?? '',
  }
}

export function makeGalleryItem(input = {}) {
  return {
    id: input.id ?? createRecordId('img'),
    url: input.url ?? input.src ?? '',
    assetId: input.assetId ?? '',
    caption: input.caption ?? input.alt ?? '',
  }
}

export function makeGalleryData(input = {}) {
  return { items: items(input.items, makeGalleryItem) }
}

export function makePricingData(input = {}) {
  const modules = Array.isArray(input.modules)
    ? input.modules.map((module) => makeCommercialModule(module))
    : modulesFromLegacyItems(input.items)

  return {
    notes: input.notes ?? '',
    modules,
    items: flattenCommercialItems(modules),
    offers: makeOfferGroups(input.offers),
  }
}

export function makeTimelineItem(input = {}) {
  return {
    id: input.id ?? createRecordId('time'),
    title: input.title ?? '',
    date: input.date ?? '',
    body: input.body ?? '',
  }
}

export function makeTimelineData(input = {}) {
  return { items: items(input.items, makeTimelineItem) }
}

export function makeDeliverableItem(input = {}) {
  return {
    id: input.id ?? createRecordId('del'),
    title: input.title ?? '',
    body: input.body ?? '',
  }
}

export function makeDeliverablesData(input = {}) {
  return { items: items(input.items, makeDeliverableItem) }
}

export function makeSpecRow(input = {}) {
  return {
    id: input.id ?? createRecordId('spec'),
    label: input.label ?? '',
    value: input.value ?? '',
  }
}

export function makeSpecificationsData(input = {}) {
  return { rows: items(input.rows ?? input.items, makeSpecRow) }
}

export function makeTeamMemberData(input = {}) {
  return {
    id: input.id ?? createRecordId('tm'),
    name: input.name ?? '',
    role: input.role ?? '',
    bio: input.bio ?? '',
    photoUrl: input.photoUrl ?? '',
    photoAssetId: input.photoAssetId ?? '',
  }
}

export function makeTeamData(input = {}) {
  return { members: items(input.members ?? input.items, makeTeamMemberData) }
}

export function makeTestimonialItem(input = {}) {
  return {
    id: input.id ?? createRecordId('tst'),
    quote: input.quote ?? '',
    authorName: input.authorName ?? '',
    authorRole: input.authorRole ?? '',
    company: input.company ?? '',
    portraitUrl: input.portraitUrl ?? '',
    portraitAssetId: input.portraitAssetId ?? '',
  }
}

export function makeTestimonialsData(input = {}) {
  return { items: items(input.items, makeTestimonialItem) }
}

export function makeFaqItem(input = {}) {
  return {
    id: input.id ?? createRecordId('faq'),
    question: input.question ?? '',
    answer: input.answer ?? '',
  }
}

export function makeFaqData(input = {}) {
  return { items: items(input.items, makeFaqItem) }
}

export function makeTermsData(input = {}) {
  return { body: input.body ?? '' }
}

export function makeSignatureData(input = {}) {
  return {
    clientLabel: input.clientLabel ?? 'Client',
    studioLabel: input.studioLabel ?? 'Studio',
  }
}

export function makeAttachmentItem(input = {}) {
  return {
    id: input.id ?? createRecordId('att'),
    assetId: input.assetId ?? '',
    name: input.name ?? '',
    mimeType: input.mimeType ?? '',
    sizeBytes: Number(input.sizeBytes ?? 0),
    url: input.url ?? '',
  }
}

export function makeAttachmentsData(input = {}) {
  return { items: items(input.items, makeAttachmentItem) }
}

export function makeCustomData(input = {}) {
  return {
    heading: input.heading ?? '',
    body: input.body ?? '',
  }
}

const MAKERS = {
  [BLOCK_TYPE.COVER]: makeCoverData,
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: makeExecutiveSummaryData,
  [BLOCK_TYPE.RICH_TEXT]: makeRichTextData,
  [BLOCK_TYPE.GALLERY]: makeGalleryData,
  [BLOCK_TYPE.PRICING]: makePricingData,
  [BLOCK_TYPE.TIMELINE]: makeTimelineData,
  [BLOCK_TYPE.DELIVERABLES]: makeDeliverablesData,
  [BLOCK_TYPE.SPECIFICATIONS]: makeSpecificationsData,
  [BLOCK_TYPE.TEAM]: makeTeamData,
  [BLOCK_TYPE.TESTIMONIALS]: makeTestimonialsData,
  [BLOCK_TYPE.FAQ]: makeFaqData,
  [BLOCK_TYPE.TERMS]: makeTermsData,
  [BLOCK_TYPE.SIGNATURE]: makeSignatureData,
  [BLOCK_TYPE.ATTACHMENTS]: makeAttachmentsData,
  [BLOCK_TYPE.CUSTOM]: makeCustomData,
}

export function makeBlockData(type, input = {}) {
  const make = MAKERS[type] ?? makeCustomData
  return make(input)
}

function hasText(...values) {
  return values.some((value) => typeof value === 'string' && value.trim())
}

export function isBlockDataEmpty(type, data = {}) {
  switch (type) {
    case BLOCK_TYPE.COVER:
      return !hasText(data.heading, data.subheading, data.imageUrl, data.imageAssetId)
    case BLOCK_TYPE.EXECUTIVE_SUMMARY:
    case BLOCK_TYPE.TERMS:
      return !hasText(data.body)
    case BLOCK_TYPE.RICH_TEXT:
    case BLOCK_TYPE.CUSTOM:
      return !hasText(data.heading, data.body)
    case BLOCK_TYPE.GALLERY:
      return !data.items?.some((item) => hasText(item.url, item.assetId, item.caption))
    case BLOCK_TYPE.TIMELINE:
      return !data.items?.some((item) => hasText(item.title, item.date, item.body))
    case BLOCK_TYPE.DELIVERABLES:
      return !data.items?.some((item) => hasText(item.title, item.body))
    case BLOCK_TYPE.TESTIMONIALS:
      return !data.items?.some((item) => hasText(item.quote, item.authorName))
    case BLOCK_TYPE.FAQ:
      return !data.items?.some((item) => hasText(item.question, item.answer))
    case BLOCK_TYPE.ATTACHMENTS:
      return !data.items?.some((item) => hasText(item.name, item.url, item.assetId))
    case BLOCK_TYPE.PRICING: {
      const hasModules = data.modules?.some((module) => {
        if (module.items?.length) {
          return module.items.some(
            (item) =>
              hasText(item.description, item.title) ||
              Number(item.unitPrice ?? item.amount) > 0 ||
              Number(item.percent) > 0,
          )
        }
        return Number(module.value) > 0 || Number(module.rate) > 0
      })
      return !hasModules && !hasText(data.notes) && !hasAuthoredOffers(data.offers)
    }
    case BLOCK_TYPE.SPECIFICATIONS:
      return !data.rows?.some((row) => hasText(row.label, row.value))
    case BLOCK_TYPE.TEAM:
      return !data.members?.some((member) =>
        hasText(member.name, member.role, member.bio),
      )
    case BLOCK_TYPE.SIGNATURE:
      return false
    default:
      return true
  }
}
