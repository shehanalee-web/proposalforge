import { PROPOSAL_STATUS } from '../models/proposal.js'

/**
 * Seed data for development.
 *
 * Timestamps are hard-coded rather than derived from the current date so the
 * app looks identical on every reload, which makes sorting and filtering easy
 * to reason about while building UI. Replaced wholesale once a real API exists.
 *
 * @type {Partial<import('../models/proposal.js').Proposal>[]}
 */
export const MOCK_PROPOSALS = [
  {
    id: 'prop-1001',
    title: 'Brand Identity Refresh',
    clientName: 'Dana Whitfield',
    clientEmail: 'dana@northwindstudio.com',
    company: 'Northwind Studio',
    projectType: 'Branding',
    status: PROPOSAL_STATUS.SENT,
    amount: 18500,
    summary:
      'Full visual identity refresh covering logo system, typography, colour and a compact brand guideline document.',
    sections: [
      {
        id: 'sec-1001-1',
        heading: 'Scope of Work',
        body: 'Discovery workshop, three identity directions, two rounds of refinement, and final asset delivery in print and digital formats.',
      },
      {
        id: 'sec-1001-2',
        heading: 'Timeline',
        body: 'Six weeks from kickoff, with review checkpoints at the end of weeks two and four.',
      },
      {
        id: 'sec-1001-3',
        heading: 'Investment',
        body: 'Fixed fee of $18,500, invoiced in three equal milestones.',
      },
    ],
    tags: ['identity', 'retainer-candidate'],
    validUntil: '2026-09-10',
    shareToken: 'share-1001',
    lastViewedAt: '2026-08-20T14:30:00.000Z',
    items: [
      { id: 'item-1001-1', description: 'Identity system', amount: 12000 },
      { id: 'item-1001-2', description: 'Brand guidelines', amount: 6500 },
    ],
    terms:
      'Work begins on receipt of a 40% deposit. Remaining balance is due on delivery of final files. This proposal is valid until the date shown.',
    createdAt: '2026-08-10T09:15:00.000Z',
    updatedAt: '2026-08-14T16:42:00.000Z',
  },
  {
    id: 'prop-1002',
    title: 'Custom Steel Staircase Fabrication',
    clientName: 'Marcus Reyes',
    clientEmail: 'm.reyes@harborlinedev.com',
    company: 'Harborline Developments',
    projectType: 'Fabrication',
    status: PROPOSAL_STATUS.ACCEPTED,
    amount: 47200,
    summary:
      'Design, fabrication and installation of a blackened steel feature staircase with oak treads for a lobby renovation.',
    sections: [
      {
        id: 'sec-1002-1',
        heading: 'Materials',
        body: 'Hot-rolled steel stringers with a blackened patina finish, solid white oak treads, and a mild steel handrail.',
      },
      {
        id: 'sec-1002-2',
        heading: 'Fabrication and Installation',
        body: 'Shop fabrication over four weeks, followed by a two-day on-site installation coordinated with the general contractor.',
      },
    ],
    tags: ['structural', 'install-required'],
    validUntil: '2026-07-31',
    shareToken: 'share-1002',
    acceptedAt: '2026-07-19T08:20:00.000Z',
    lastViewedAt: '2026-07-18T16:05:00.000Z',
    createdAt: '2026-07-02T11:00:00.000Z',
    updatedAt: '2026-07-19T08:20:00.000Z',
  },
  {
    id: 'prop-1003',
    title: 'E-commerce Site Rebuild',
    clientName: 'Priya Raman',
    clientEmail: 'priya@voltcycles.co',
    company: 'Volt Cycles',
    projectType: 'Web Development',
    status: PROPOSAL_STATUS.DRAFT,
    amount: 32000,
    summary:
      'Replatform the existing storefront, rebuild the product configurator and improve checkout conversion.',
    sections: [],
    tags: ['ecommerce'],
    validUntil: null,
    shareToken: 'share-1003',
    createdAt: '2026-08-21T13:05:00.000Z',
    updatedAt: '2026-08-23T10:12:00.000Z',
  },
  {
    id: 'prop-1004',
    title: 'Retail Pop-Up Build-Out',
    clientName: 'Elena Voss',
    clientEmail: 'elena.voss@lumencosmetics.com',
    company: 'Lumen Cosmetics',
    projectType: 'Fabrication',
    status: PROPOSAL_STATUS.REVISION_REQUESTED,
    amount: 61500,
    summary:
      'Turnkey fabrication of a travelling retail pop-up: modular display walls, illuminated signage and a demo counter.',
    sections: [
      {
        id: 'sec-1004-1',
        heading: 'Deliverables',
        body: 'Six modular wall units, one demo counter, backlit channel-letter signage, crating and freight to three cities.',
      },
    ],
    tags: ['retail', 'multi-city'],
    validUntil: '2026-09-05',
    shareToken: 'share-1004',
    lastViewedAt: '2026-08-19T11:10:00.000Z',
    clientFeedback:
      'Please quote a second finish option for the demo counter and confirm freight to the Dallas date.',
    createdAt: '2026-08-05T15:30:00.000Z',
    updatedAt: '2026-08-19T11:22:00.000Z',
  },
  {
    id: 'prop-1005',
    title: 'Product Launch Campaign',
    clientName: 'Tobias Lund',
    clientEmail: 'tobias@atlasfoods.com',
    company: 'Atlas Foods',
    projectType: 'Marketing',
    status: PROPOSAL_STATUS.DECLINED,
    amount: 24750,
    summary:
      'Integrated launch campaign covering paid social, influencer seeding and in-store point-of-sale collateral.',
    sections: [],
    tags: ['campaign'],
    validUntil: '2026-06-20',
    shareToken: 'share-1005',
    lastViewedAt: '2026-06-12T09:40:00.000Z',
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-06-24T14:35:00.000Z',
  },
  {
    id: 'prop-1006',
    title: 'Museum Exhibit Millwork',
    clientName: 'Harriet Osei',
    clientEmail: 'h.osei@civicartstrust.org',
    company: 'Civic Arts Trust',
    projectType: 'Fabrication',
    status: PROPOSAL_STATUS.ACCEPTED,
    amount: 88900,
    summary:
      'Custom millwork and vitrine fabrication for a permanent gallery installation, including conservation-grade finishes.',
    sections: [
      {
        id: 'sec-1006-1',
        heading: 'Conservation Requirements',
        body: 'All materials tested for off-gassing, sealed with conservation-approved finishes and documented for the registrar.',
      },
      {
        id: 'sec-1006-2',
        heading: 'Payment Schedule',
        body: 'Thirty percent deposit, forty percent at fabrication midpoint, thirty percent on final acceptance.',
      },
    ],
    tags: ['museum', 'conservation', 'long-lead'],
    validUntil: '2026-05-15',
    shareToken: 'share-1006',
    lastViewedAt: '2026-04-28T15:12:00.000Z',
    acceptedAt: '2026-05-02T12:00:00.000Z',
    createdAt: '2026-04-08T08:45:00.000Z',
    updatedAt: '2026-05-02T12:00:00.000Z',
  },
  {
    id: 'prop-1007',
    title: 'Motion Graphics Package',
    clientName: 'Jordan Blake',
    clientEmail: 'jordan@beaconsports.tv',
    company: 'Beacon Sports',
    projectType: 'Motion Design',
    status: PROPOSAL_STATUS.DRAFT,
    amount: 12400,
    summary:
      'Broadcast package including opening titles, lower thirds, transition stings and a reusable After Effects template set.',
    sections: [],
    tags: ['broadcast', 'templates'],
    validUntil: null,
    shareToken: 'share-1007',
    createdAt: '2026-08-24T17:20:00.000Z',
    updatedAt: '2026-08-24T17:20:00.000Z',
  },
  {
    id: 'prop-1008',
    title: 'Annual Report Design',
    clientName: 'Sofia Alvarez',
    clientEmail: 'salvarez@meridiancapital.com',
    company: 'Meridian Capital',
    projectType: 'Print Design',
    status: PROPOSAL_STATUS.SENT,
    amount: 9800,
    summary:
      'Editorial design and production of a 64-page annual report, including infographics and print management.',
    sections: [
      {
        id: 'sec-1008-1',
        heading: 'Production',
        body: 'Print-ready artwork supplied to the client printer, with a press check attended in person.',
      },
    ],
    tags: ['editorial', 'annual'],
    validUntil: '2026-09-01',
    shareToken: 'share-1008',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-12T11:15:00.000Z',
  },
]
