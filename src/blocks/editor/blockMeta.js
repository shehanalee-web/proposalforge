import { BLOCK_TYPE } from '../ids.js'
import { CONTENT_BLOCK_TYPE_LABELS } from '../../models/contentBlock.js'
import { getBlockIcon } from './blockIcons.js'

const META = {
  [BLOCK_TYPE.COVER]: {
    short: 'Cover',
    description: 'Opening hero with title, kicker and image.',
    emptyTitle: 'Start writing…',
    emptyHint: 'Add a heading or drop a cover image.',
  },
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: {
    short: 'Executive Summary',
    description: 'The pitch in a few sentences.',
    emptyTitle: 'Start writing…',
    emptyHint: 'Summarise the engagement in one short paragraph.',
  },
  [BLOCK_TYPE.RICH_TEXT]: {
    short: 'Text',
    description: 'Freeform heading and body copy.',
    emptyTitle: 'Start writing…',
    emptyHint: 'Add a heading and supporting copy.',
  },
  [BLOCK_TYPE.GALLERY]: {
    short: 'Gallery',
    description: 'Images with optional captions.',
    emptyTitle: 'Drop images here',
    emptyHint: 'Add visual references, mood boards or product shots.',
  },
  [BLOCK_TYPE.PRICING]: {
    short: 'Pricing',
    description: 'Commercials, add-ons and totals.',
    emptyTitle: 'No pricing yet',
    emptyHint: 'Add a pricing table to show the investment.',
  },
  [BLOCK_TYPE.TIMELINE]: {
    short: 'Timeline',
    description: 'Milestones and dates.',
    emptyTitle: 'No timeline yet',
    emptyHint: 'Add milestones so the client can see the path.',
  },
  [BLOCK_TYPE.DELIVERABLES]: {
    short: 'Deliverables',
    description: 'What the client receives.',
    emptyTitle: 'No deliverables yet',
    emptyHint: 'List what is included in this proposal.',
  },
  [BLOCK_TYPE.SPECIFICATIONS]: {
    short: 'Specifications',
    description: 'Label and value rows.',
    emptyTitle: 'No specifications yet',
    emptyHint: 'Add technical details as label / value pairs.',
  },
  [BLOCK_TYPE.TEAM]: {
    short: 'Team',
    description: 'People on the engagement.',
    emptyTitle: 'No team yet',
    emptyHint: 'Introduce the people the client will work with.',
  },
  [BLOCK_TYPE.TESTIMONIALS]: {
    short: 'Testimonials',
    description: 'Quotes from past clients.',
    emptyTitle: 'No quotes yet',
    emptyHint: 'Add a testimonial to build trust.',
  },
  [BLOCK_TYPE.FAQ]: {
    short: 'FAQ',
    description: 'Questions the client will ask.',
    emptyTitle: 'No questions yet',
    emptyHint: 'Add FAQs to reduce back-and-forth.',
  },
  [BLOCK_TYPE.TERMS]: {
    short: 'Terms',
    description: 'Conditions and legal copy.',
    emptyTitle: 'Start writing…',
    emptyHint: 'Add payment terms, validity and conditions.',
  },
  [BLOCK_TYPE.SIGNATURE]: {
    short: 'Signature',
    description: 'Acceptance lines for both parties.',
    emptyTitle: 'Ready to sign',
    emptyHint: 'Labels appear on the client-facing proposal.',
  },
  [BLOCK_TYPE.ATTACHMENTS]: {
    short: 'Attachments',
    description: 'Files the client can download.',
    emptyTitle: 'No files yet',
    emptyHint: 'Attach a PDF, rate card or supporting document.',
  },
  [BLOCK_TYPE.CUSTOM]: {
    short: 'Custom',
    description: 'A freeform section.',
    emptyTitle: 'Start writing…',
    emptyHint: 'Give this block a heading and body.',
  },
}

export function getBlockMeta(type) {
  const fallback = META[BLOCK_TYPE.CUSTOM]
  const meta = META[type] ?? fallback
  return {
    type,
    short: meta.short,
    label: CONTENT_BLOCK_TYPE_LABELS[type] ?? meta.short,
    description: meta.description,
    emptyTitle: meta.emptyTitle,
    emptyHint: meta.emptyHint,
    icon: getBlockIcon(type),
  }
}
