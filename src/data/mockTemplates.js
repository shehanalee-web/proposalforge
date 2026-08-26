/**
 * Seed templates for development.
 *
 * Replaced wholesale once a real API exists. Timestamps are fixed so the list
 * looks the same on every reload.
 *
 * @type {Partial<import('../models/template.js').ProposalTemplate>[]}
 */
export const MOCK_TEMPLATES = [
  {
    id: 'tpl-2001',
    title: 'Brand Identity Package',
    description:
      'A complete visual identity engagement: discovery, directions, refinement and a compact guideline document.',
    sections: [
      {
        id: 'tpl-2001-sec-1',
        heading: 'Scope of work',
        body: 'Discovery workshop, three identity directions, two rounds of refinement, and final asset delivery in print and digital formats.',
      },
      {
        id: 'tpl-2001-sec-2',
        heading: 'Timeline',
        body: 'Six weeks from kickoff, with review checkpoints at the end of weeks two and four.',
      },
      {
        id: 'tpl-2001-sec-3',
        heading: 'Deliverables',
        body: 'Primary mark, wordmark, colour system, type pairing, and a 12-page brand guideline PDF.',
      },
    ],
    items: [
      {
        id: 'tpl-2001-item-1',
        description: 'Discovery and strategy',
        amount: 4500,
      },
      {
        id: 'tpl-2001-item-2',
        description: 'Identity design and refinement',
        amount: 9800,
      },
      {
        id: 'tpl-2001-item-3',
        description: 'Brand guideline document',
        amount: 4200,
      },
    ],
    terms:
      'This proposal is valid for 30 days from the issue date.\n\nA 40% deposit is due on acceptance, with the balance invoiced on delivery. Invoices are payable within 14 days.\n\nEach deliverable includes two rounds of consolidated feedback. Additional rounds are billed separately.',
    notes:
      'Ask the client for existing brand assets and competitor examples before the discovery workshop.',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-12T14:30:00.000Z',
  },
  {
    id: 'tpl-2002',
    title: 'Marketing Website',
    description:
      'Design and build of a marketing site with a CMS, analytics, and a documented handoff.',
    sections: [
      {
        id: 'tpl-2002-sec-1',
        heading: 'Scope of work',
        body: 'Information architecture, visual design for key templates, front-end build, CMS setup, and a one-hour training session.',
      },
      {
        id: 'tpl-2002-sec-2',
        heading: 'Timeline',
        body: 'Eight weeks from kickoff, assuming feedback within three business days of each review.',
      },
    ],
    items: [
      {
        id: 'tpl-2002-item-1',
        description: 'UX and visual design',
        amount: 7200,
      },
      {
        id: 'tpl-2002-item-2',
        description: 'Front-end development and CMS',
        amount: 11800,
      },
    ],
    terms:
      'Third-party costs (hosting, licences, stock) are billed at cost and are not included in the fees above.\n\nThe studio retains ownership of work until invoices are paid in full.',
    notes: 'Confirm hosting preference (Webflow vs custom) during kickoff.',
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-08-08T11:15:00.000Z',
  },
]
