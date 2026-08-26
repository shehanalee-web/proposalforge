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
    group: WORKSPACE_GROUP.WORKSPACE,
    inNav: true,
    status: 'live',
    summary: 'Reusable starting points for new proposals.',
    description:
      'Templates copy into a proposal. Later edits never write back. A template may pick a default layout; it is not a layout.',
    capabilities: [],
  },
  {
    id: WORKSPACE_MODULE.BRAND_KIT,
    path: PATH.BRAND_KIT,
    label: 'Brand Kit',
    icon: 'brand',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'placeholder',
    summary: 'Workspace identity, inherited by every document.',
    description:
      'Logos, colours, typography, contact details, covers, headers, footers and watermarks. Studio preview, the client portal and PDF export will consume Brand Kit automatically. Settings remains the studio profile until this module owns identity.',
    capabilities: [
      'Primary, light, dark and mark logos',
      'Colour palette and typography scale',
      'Cover, header and footer styles',
      'Watermarks, page numbers, spacing and document chrome',
      'Company contact details resolved at render time',
    ],
  },
  {
    id: WORKSPACE_MODULE.SERVICES,
    path: PATH.SERVICES,
    label: 'Services',
    icon: 'services',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'placeholder',
    summary: 'Company-defined offerings. Replaces hardcoded project types.',
    description:
      'Each service is something the company sells — architecture scale models, 3D printing, legal work, software, campaigns. Proposals will reference services instead of a fixed project-type list. The Proposal Engine stays universal.',
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
    status: 'placeholder',
    summary: 'Reusable media for proposals, services and brand.',
    description:
      'Images, renders, videos, documents and certificates live here once. Proposals store asset IDs, not files. Layouts decide how an asset is framed — authors upload, they do not crop for each page.',
    capabilities: [
      'Images, renders, videos, documents and certificates',
      'Referenced by Brand Kit, services, components and proposals',
      'Display size and crop owned by the Layout Engine',
    ],
  },
  {
    id: WORKSPACE_MODULE.CONTENT_LIBRARY,
    path: PATH.CONTENT_LIBRARY,
    label: 'Content Library',
    icon: 'content',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'placeholder',
    summary: 'Reusable proposal blocks — the Component Library.',
    description:
      'Executive summaries, galleries, pricing, timelines, FAQs and every other block type. Layouts place these blocks; they do not define their schemas. Custom industry sections are new block types, not new proposal engines.',
    capabilities: [
      'Registered block types shared by screen, portal and PDF',
      'Workspace-saved block instances in a later phase',
      'Used by templates and services as default assemblies',
    ],
  },
  {
    id: WORKSPACE_MODULE.CASE_STUDIES,
    path: PATH.CASE_STUDIES,
    label: 'Case Studies',
    icon: 'cases',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'placeholder',
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
    id: WORKSPACE_MODULE.TESTIMONIALS,
    path: PATH.TESTIMONIALS,
    label: 'Testimonials',
    icon: 'testimonials',
    group: WORKSPACE_GROUP.LIBRARIES,
    inNav: true,
    status: 'placeholder',
    summary: 'Client quotes owned by the workspace, not the document.',
    description:
      'Quotes, attribution and company. The Testimonials block in a proposal references these records.',
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
    status: 'placeholder',
    summary: 'People who appear on proposals.',
    description:
      'Names, roles, bios and portraits. The Team block reads this library instead of embedding staff copy in every proposal.',
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
      'Existing studio settings. Brand identity will move to Brand Kit; this page remains account and workspace configuration.',
    capabilities: [],
  },
])
