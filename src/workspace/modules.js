import { WORKSPACE_GROUP, WORKSPACE_MODULE } from './ids.js'
import { PATH } from './paths.js'

/**
 * @typedef {object} WorkspaceModule
 * @property {string} id
 * @property {string} path
 * @property {string} label
 * @property {string} icon
 * @property {string} group
 * @property {boolean} inNav
 * @property {'live' | 'placeholder'} status
 * @property {string} summary
 * @property {string} description
 * @property {string[]} capabilities
 */

/**
 * Registered workspace modules. Navigation, routing, and placeholder pages
 * all read from this list so a new library is one registration, not a fork
 * of the proposal editor.
 *
 * @type {readonly WorkspaceModule[]}
 */
export const WORKSPACE_MODULES = Object.freeze([
  {
    id: WORKSPACE_MODULE.DASHBOARD,
    path: PATH.DASHBOARD,
    label: 'Dashboard',
    icon: 'dashboard',
    group: WORKSPACE_GROUP.WORKSPACE,
    inNav: true,
    status: 'live',
    summary: 'Pipeline overview for the workspace.',
    description:
      'Summary of proposal volume, value and recent activity. Unchanged by the library modules.',
    capabilities: [],
  },
  {
    id: WORKSPACE_MODULE.CREATE_PROPOSAL,
    path: PATH.NEW_PROPOSAL,
    label: 'Create Proposal',
    icon: 'new',
    group: WORKSPACE_GROUP.WORKSPACE,
    inNav: true,
    status: 'live',
    summary: 'Start a new proposal from workspace, brand and service.',
    description:
      'A dedicated creation journey. Generate with AI or copy a service’s template into a new document.',
    capabilities: [],
  },
  {
    id: WORKSPACE_MODULE.PROPOSALS,
    path: PATH.PROPOSALS,
    label: 'Proposals',
    icon: 'proposals',
    group: WORKSPACE_GROUP.WORKSPACE,
    inNav: true,
    status: 'live',
    summary: 'The Proposal Engine — documents sent to clients.',
    description:
      'List, view, edit and duplicate proposals. Layout, theme, PDF and the client portal consume this data; they do not own it.',
    capabilities: [],
  },
  {
    id: WORKSPACE_MODULE.TEMPLATES,
    path: PATH.TEMPLATES,
    label: 'Templates',
    icon: 'templates',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Reusable starting points managed as a library.',
    description:
      'Edit, duplicate and organise templates here. Creating a proposal happens from Create Proposal, which copies a service’s template into a new document.',
    capabilities: [],
  },
  {
    id: WORKSPACE_MODULE.BRAND_KIT,
    path: PATH.BRAND_KIT,
    label: 'Brand Kit',
    icon: 'brand',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Company identity, inherited by every document.',
    description:
      'Set logos, colours, type, contact details, legal copy, team and testimonials once. Studio preview, the client portal, templates and PDF export consume Brand Kit automatically.',
    capabilities: [
      'Company logos, favicon and cover image',
      'Colour palette, type and contact details',
      'Team, testimonials, terms and payment details',
      'Inherited by proposals and templates at render time',
    ],
  },
  {
    id: WORKSPACE_MODULE.SERVICES,
    path: PATH.SERVICES,
    label: 'Services',
    icon: 'services',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Company-defined offerings. Replaces hardcoded project types.',
    description:
      'Each service is something the company sells — architecture scale models, 3D printing, legal work, software, campaigns. Create Proposal offers these instead of a fixed project-type list. The Proposal Engine stays universal.',
    capabilities: [
      'Name, description and default scope language',
      'Pricing models (fixed, unit, hourly, milestone, retainer)',
      'Default deliverables, duration and assets',
      'Default content blocks inserted onto a proposal',
    ],
  },
  {
    id: WORKSPACE_MODULE.ASSETS,
    path: PATH.ASSETS,
    label: 'Assets',
    icon: 'assets',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Reusable media for proposals, services and brand.',
    description:
      'Files uploaded from Brand Kit and proposal blocks. Proposals store asset IDs; layouts decide crop and size.',
    capabilities: [
      'Images, renders, videos, documents and certificates',
      'Referenced by Brand Kit, services, components and proposals',
      'Display size and crop owned by the Layout Engine',
    ],
  },
  {
    id: WORKSPACE_MODULE.CONTENT_LIBRARY,
    path: PATH.CONTENT_LIBRARY,
    label: 'Proposal Blocks',
    icon: 'content',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Reusable proposal blocks — the Component Library.',
    description:
      'Create unlimited reusable blocks. Proposals assemble from these records; layouts place them. Variables, conditions and theme tokens apply at render time.',
    capabilities: [
      'Reusable blocks with categories, tags and favorites',
      'Variables such as {{client_name}} resolve live in preview, portal and PDF',
      'Insert into any proposal without rewriting sent documents',
    ],
  },
  {
    id: WORKSPACE_MODULE.CASE_STUDIES,
    path: PATH.CASE_STUDIES,
    label: 'Case Studies',
    icon: 'cases',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Proof of past work, reused across proposals.',
    description:
      'Client stories with narrative, services, and assets. Dropped into proposals as content, not rewritten per document.',
    capabilities: [
      'Title, client, summary and body',
      'Links to services and assets',
      'Reusable on any layout',
    ],
  },
  {
    id: WORKSPACE_MODULE.KNOWLEDGE,
    path: PATH.KNOWLEDGE,
    label: 'Company Knowledge',
    icon: 'knowledge',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Approved reusable company knowledge for future proposals and AI.',
    description:
      'Company-scoped profiles, services, legal language, and approved wording. Drafts never enter AI context until they are approved.',
    capabilities: [
      'Searchable, approval-aware records',
      'Save proposal content as a draft',
      'Deterministic context for later AI',
    ],
  },
  {
    id: WORKSPACE_MODULE.TESTIMONIALS,
    path: PATH.TESTIMONIALS,
    label: 'Testimonials',
    icon: 'testimonials',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'Client quotes owned by the workspace, not the document.',
    description:
      'Quotes from Brand Kit. Attribution and company appear on proposals that include a Testimonials block.',
    capabilities: [
      'Quote, author, role and company',
      'Optional portrait from the Asset Library',
    ],
  },
  {
    id: WORKSPACE_MODULE.TEAM,
    path: PATH.TEAM,
    label: 'Team',
    icon: 'team',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'live',
    summary: 'People who appear on proposals.',
    description:
      'People from Brand Kit. Names, roles, bios and portraits appear on proposals that include a Team block.',
    capabilities: [
      'Name, role and biography',
      'Portrait asset reference',
    ],
  },
  {
    id: WORKSPACE_MODULE.SETTINGS,
    path: PATH.SETTINGS,
    label: 'Settings',
    icon: 'settings',
    group: WORKSPACE_GROUP.ACCOUNT,
    inNav: true,
    status: 'live',
    summary: 'Studio profile and workspace defaults.',
    description:
      'Existing studio settings. Company name, email and about stay in sync with Brand Kit.',
    capabilities: [],
  },
])
