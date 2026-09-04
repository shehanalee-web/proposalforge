import { LAYOUT_ID } from '../layouts/ids.js'
import { PROPOSAL_TYPE } from '../models/proposalType.js'
import { CATALOGUE_TEMPLATES } from './catalogue/index.js'
import { seedBrandDiscoveryQuestionnaire } from './seedDiscoveryQuestionnaire.js'

/**
 * Seed templates for development.
 *
 * Each Create Proposal type points at one of these records. Timestamps are
 * fixed so the list looks the same on every reload.
 *
 * @param {object} input
 * @returns {Partial<import('../models/template.js').ProposalTemplate>}
 */
function seedTemplate({
  id,
  title,
  description,
  proposalType,
  isDefault = false,
  defaultLayoutId = LAYOUT_ID.PORTRAIT,
  scope,
  timeline,
  deliverables,
  items,
  terms,
  notes,
  questionnaire,
  createdAt,
  updatedAt,
}) {
  const sections = [
    { id: `${id}-sec-1`, heading: 'Scope of work', body: scope },
    { id: `${id}-sec-2`, heading: 'Timeline', body: timeline },
  ]

  if (deliverables) {
    sections.push({
      id: `${id}-sec-3`,
      heading: 'Deliverables',
      body: deliverables,
    })
  }

  return {
    id,
    title,
    description,
    proposalType,
    isDefault,
    defaultLayoutId,
    sections,
    items: items.map((item, index) => ({
      id: `${id}-item-${index + 1}`,
      description: item.description,
      amount: item.amount,
    })),
    terms,
    notes,
    questionnaire,
    createdAt,
    updatedAt,
  }
}

const SHARED_TERMS =
  'This proposal is valid for 30 days from the issue date.\n\nA 40% deposit is due on acceptance, with the balance invoiced on delivery. Invoices are payable within 14 days.\n\nEach deliverable includes two rounds of consolidated feedback. Additional rounds are billed separately.'

/**
 * @type {Partial<import('../models/template.js').ProposalTemplate>[]}
 */
export const MOCK_TEMPLATES = [
  seedTemplate({
    id: 'tpl-2001',
    title: 'Brand Identity Package',
    description:
      'A complete visual identity engagement: discovery, directions, refinement and a compact guideline document.',
    proposalType: PROPOSAL_TYPE.CREATIVE_AGENCY,
    isDefault: true,
    defaultLayoutId: LAYOUT_ID.LANDSCAPE,
    scope:
      'Discovery workshop, three identity directions, two rounds of refinement, and final asset delivery in print and digital formats.',
    timeline:
      'Six weeks from kickoff, with review checkpoints at the end of weeks two and four.',
    deliverables:
      'Primary mark, wordmark, colour system, type pairing, and a 12-page brand guideline PDF.',
    items: [
      { description: 'Discovery and strategy', amount: 4500 },
      { description: 'Identity design and refinement', amount: 9800 },
      { description: 'Brand guideline document', amount: 4200 },
    ],
    terms: SHARED_TERMS,
    notes:
      'Ask the client for existing brand assets and competitor examples before the discovery workshop.',
    questionnaire: seedBrandDiscoveryQuestionnaire(),
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-12T14:30:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-2002',
    title: 'Marketing Website',
    description:
      'Design and build of a marketing site with a CMS, analytics, and a documented handoff.',
    proposalType: PROPOSAL_TYPE.MARKETING,
    scope:
      'Information architecture, visual design for key templates, front-end build, CMS setup, and a one-hour training session.',
    timeline:
      'Eight weeks from kickoff, assuming feedback within three business days of each review.',
    items: [
      { description: 'UX and visual design', amount: 7200 },
      { description: 'Front-end development and CMS', amount: 11800 },
    ],
    terms:
      'Third-party costs (hosting, licences, stock) are billed at cost and are not included in the fees above.\n\nThe studio retains ownership of work until invoices are paid in full.',
    notes: 'Confirm hosting preference (Webflow vs custom) during kickoff.',
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-08-08T11:15:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-architecture',
    title: 'Architecture Design Package',
    description:
      'Concept through design development for a building or interior, with presentation drawings and a coordinated set.',
    proposalType: PROPOSAL_TYPE.ARCHITECTURE,
    scope:
      'Site and brief review, concept options, design development, and a presentation package suitable for client and consultant coordination.',
    timeline:
      'Ten weeks from kickoff, with reviews at concept, developed design and issue.',
    deliverables:
      'Concept boards, developed plans and elevations, a 3D presentation set, and a written design report.',
    items: [
      { description: 'Concept design', amount: 12000 },
      { description: 'Design development', amount: 18000 },
      { description: 'Presentation package', amount: 6500 },
    ],
    terms: SHARED_TERMS,
    notes: 'Confirm planning constraints and consultant team before concept freeze.',
    createdAt: '2026-07-12T09:00:00.000Z',
    updatedAt: '2026-08-10T16:00:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-motion',
    title: 'Motion Graphics Package',
    description:
      'A motion system and hero film for launch, with social cutdowns and a reusable after-effects kit.',
    proposalType: PROPOSAL_TYPE.MOTION_GRAPHICS,
    defaultLayoutId: LAYOUT_ID.LANDSCAPE,
    scope:
      'Motion principles, storyboard, hero film, platform cutdowns, and a compact motion kit for in-house teams.',
    timeline:
      'Five weeks from kickoff, with animatic and picture-lock reviews.',
    deliverables:
      'Hero film, 15s and 6s cutdowns, still frames, and an After Effects kit with type, colour and logo treatments.',
    items: [
      { description: 'Creative and storyboard', amount: 3800 },
      { description: 'Hero film production', amount: 9200 },
      { description: 'Cutdowns and motion kit', amount: 3400 },
    ],
    terms: SHARED_TERMS,
    notes: 'Collect brand assets, voiceover and music direction at kickoff.',
    createdAt: '2026-07-18T11:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-construction',
    title: 'Construction Scope Package',
    description:
      'Programme, commercial terms and a clearly bounded build or fit-out scope for client sign-off.',
    proposalType: PROPOSAL_TYPE.CONSTRUCTION,
    scope:
      'Site survey, detailed scope of works, programme, and a priced bill of quantities for the agreed package.',
    timeline:
      'Mobilisation in two weeks from acceptance, with a twelve-week on-site programme unless otherwise stated.',
    deliverables:
      'Scope of works, programme, priced schedule, and a handover pack with warranties and as-built notes.',
    items: [
      { description: 'Preliminaries and site setup', amount: 8500 },
      { description: 'Construction package', amount: 42000 },
      { description: 'Handover and snagging', amount: 4800 },
    ],
    terms:
      'This proposal is valid for 30 days from the issue date.\n\nA 30% mobilisation payment is due on acceptance. Progress claims are monthly. Retention of 5% is released at practical completion and after the defects period.\n\nVariations are quoted in writing before work proceeds.',
    notes: 'Confirm access, working hours and client-supplied items before mobilisation.',
    createdAt: '2026-07-05T08:30:00.000Z',
    updatedAt: '2026-08-11T09:45:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-software',
    title: 'Software Product Package',
    description:
      'Discovery, product design and a first engineering release for a web or software product.',
    proposalType: PROPOSAL_TYPE.SOFTWARE_DEVELOPMENT,
    scope:
      'Product discovery, UX for core flows, interface design, and an MVP engineering release with staging and documentation.',
    timeline:
      'Twelve weeks from kickoff: two weeks discovery, four weeks design, six weeks build.',
    deliverables:
      'Product brief, clickable prototype, production MVP, and a two-week handover with documentation.',
    items: [
      { description: 'Discovery and product definition', amount: 6400 },
      { description: 'UX and interface design', amount: 9800 },
      { description: 'MVP engineering', amount: 22000 },
    ],
    terms:
      'Third-party costs (hosting, licences, stock) are billed at cost and are not included in the fees above.\n\nThe studio retains ownership of work until invoices are paid in full.\n\nThis proposal is valid for 30 days from the issue date.',
    notes: 'Confirm stack preferences, integrations and launch constraints during discovery.',
    createdAt: '2026-07-22T13:00:00.000Z',
    updatedAt: '2026-08-13T12:00:00.000Z',
  }),
  seedTemplate({
    id: 'tpl-catalogue',
    title: 'Product Catalogue Package',
    description:
      'Art direction, photography and a print-ready catalogue for a collection or product line.',
    proposalType: PROPOSAL_TYPE.PRODUCT_CATALOGUE,
    defaultLayoutId: LAYOUT_ID.LANDSCAPE,
    scope:
      'Art direction, product photography, catalogue layout, print-ready files and a digital PDF edition.',
    timeline:
      'Seven weeks from kickoff, including a one-day studio shoot and two layout reviews.',
    deliverables:
      'Styled photography set, print-ready InDesign package, and a digital catalogue PDF.',
    items: [
      { description: 'Art direction and shoot', amount: 5600 },
      { description: 'Catalogue design and production', amount: 7400 },
      { description: 'Print-ready and digital files', amount: 2200 },
    ],
    terms: SHARED_TERMS,
    notes: 'Confirm product count, sample availability and print specification at kickoff.',
    createdAt: '2026-07-28T10:30:00.000Z',
    updatedAt: '2026-08-14T15:20:00.000Z',
  }),
  ...CATALOGUE_TEMPLATES,
]
