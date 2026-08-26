# ProposalForge Architecture

Internal engineering document. This is the long-term platform design, not user documentation and not a changelog of the current app.

Future features must fit this architecture. If a feature would require forking the proposal model, duplicating content into a layout, or building an industry-specific engine, it does not belong in the product.

---

## 1. Vision

ProposalForge is a **universal proposal platform**.

It is not a tool for creative studios, architecture firms, or any other single industry. It is a workspace where any company — architecture, fabrication, software, legal, marketing, consulting, and industries that do not exist yet — defines its services, assembles reusable content, and sends branded proposals.

The product succeeds when:

- A legal firm and a 3D-printing studio use the same proposal engine.
- Switching from Portrait to Catalogue does not rewrite proposal data.
- A new industry is supported by configuration (services, components, layouts, brand), not by a new codebase.
- Branding is set once and appears everywhere without per-document restyling.
- New capabilities (analytics, variables, AI, new layouts) extend existing modules instead of replacing them.

The current application is an early slice of this platform: proposals, templates, two layouts, a client portal, and PDF export. Those pieces must grow into the modules below, not be thrown away.

---

## 2. Core Principles

### Content is separate from presentation

Proposal data (who the client is, what is being offered, pricing, terms, assets) is stored independently of how that data is shown. Layouts, themes, PDFs, and the client portal are renderers. They never own the source of truth.

### Everything should be reusable

Services, components, assets, templates, brand, and variables are libraries. A proposal is an assembly of those libraries plus client-specific values. Copy-paste of content between documents is a failure of the platform.

### Branding is configured once and inherited everywhere

A workspace owns one Brand Kit. Screen layouts, the client portal, PDF export, email, and future surfaces consume it automatically. Documents do not carry a private copy of logos, colours, or typography unless the user has explicitly overridden a field — and overrides are the exception, not the model.

### Every industry uses the same proposal engine

Industry differences live in **data and configuration**: which services exist, which components a template includes, which layout is default, which assets are attached. They do not live in separate proposal types, separate schemas, or separate rendering pipelines.

### Layouts never duplicate data

A layout is a presentation definition. It names regions, block order, page size, and orientation. It does not store summaries, prices, galleries, or terms. Two layouts that show the same proposal must read the same record.

### Future features extend the platform instead of replacing existing systems

New layouts register in the Layout Engine. New blocks register in the Component Library. New file types register in the Asset Library. New industries are new Service Library entries. Do not introduce a parallel “architecture proposal” model, a second PDF stack, or a one-off client view that bypasses the Proposal Engine.

---

## 3. High-Level Architecture

Everything below hangs off a **Workspace**. A workspace is the tenant boundary: one company, one Brand Kit, one set of libraries, one set of proposals.

```
Workspace
├── Brand Kit
├── Service Library
├── Component Library
├── Asset Library
├── Templates
├── Layout Engine
├── Theme Engine
├── Proposal Engine
├── Client Portal
├── PDF Engine
├── Analytics
└── AI Assistant
```

Modules communicate through shared models and IDs. They do not reach into each other’s storage or duplicate fields.

### Workspace

The tenant. Owns identity, members (future), and every module below. All libraries and documents are workspace-scoped. There is no global “ProposalForge brand” applied to customer documents; the workspace Brand Kit is what clients see.

### Brand Kit

The workspace’s visual and company identity. Logos, colours, typography, contact details, watermark, footer, cover styles, and future brand assets. Consumed by every renderer. See [§7](#7-brand-kit).

### Service Library

The company’s catalogue of offerings. Replaces the idea of hardcoded project types. Each service is a reusable definition (description, pricing model, assets, deliverables, and so on) that proposals reference. See [§8](#8-service-library).

### Component Library

Reusable proposal blocks (Executive Summary, Gallery, Pricing, Timeline, FAQ, and so on). Layouts and templates compose components; they do not invent one-off sections that cannot be reused. See [§9](#9-component-library).

### Asset Library

Workspace media manager: images, renders, videos, documents, certificates, and future file types. Proposals, services, components, and Brand Kit reference assets by ID. See [§10](#10-asset-library).

### Templates

Saved assemblies: which services, which components, which default layout, which default theme, which placeholder content. Creating a proposal from a template is a **deep copy**. Later edits to the proposal never write back to the template; later edits to the template never mutate existing proposals.

Templates are not layouts. A template can say “use Landscape by default”; the layout remains a separate presentation definition.

### Layout Engine

Presentation definitions only: page geometry, region structure, block order, screen vs PDF sequence. Layouts consume proposal data; they do not contain it. See [§5](#5-layout-engine).

### Theme Engine

Visual styling: typography, colours, spacing, borders, density. Themes do not change content or layout structure. Brand Kit supplies identity values; themes decide how those values are applied. See [§6](#6-theme-engine).

### Proposal Engine

The universal data model and lifecycle for a proposal. Independent of layout, theme, PDF, and portal. See [§4](#4-proposal-engine).

### Client Portal

A renderer and an interaction surface, not a second document store. The portal reads the same proposal record the studio edits. It may collect client actions (view, accept, decline, request changes, sign) and write those events back through the Proposal Engine. It must not restyle by inventing its own content schema.

### PDF Engine

A renderer. It takes proposal data + layout definition + theme + Brand Kit and produces a paginated document. PDF-specific constraints (page size, wrap, running header/footer) belong here. Proposal fields do not.

If screen and PDF need different block implementations, they share **block IDs** and read the same data. They do not fork the proposal.

### Analytics

Observes the Proposal Engine and Client Portal. Views, time on document, accept/decline, revision requests, conversion by service, layout, and template. Analytics never becomes a source of truth for proposal content. It stores events and aggregates, not a parallel copy of the document.

### AI Assistant

A consumer of the platform, not a replacement for it. AI drafts into the Proposal Engine, suggests components from the Component Library, pulls assets from the Asset Library, and fills variables. It does not write layout-specific or PDF-only content. Generated output is ordinary proposal data that a human can edit and that every renderer can display.

---

## 4. Proposal Engine

The Proposal Engine is the **universal data model**. One schema serves every industry.

A proposal is a document instance: client, commercial terms, selected services, component instances, asset references, variable values, lifecycle status, and pointers to presentation choices (`layoutId`, `themeId`). It is not a designed page.

### What the engine owns

- **Identity and lifecycle** — id, status (`draft`, `sent`, `accepted`, `declined`, `revision_requested`, and future states), timestamps, version history, share token.
- **Parties** — client name, email, company, and future client records. Workspace/company identity is not copied onto the proposal; it is resolved from Brand Kit at render time.
- **Commercial data** — currency, line items, totals, validity dates, terms. Pricing is data. How a pricing table looks is layout + theme.
- **Content instances** — ordered component instances with their field values (summary text, section bodies, FAQs, timelines, and so on).
- **References** — service IDs, asset IDs, template ID (provenance only), layout ID, theme ID.
- **Variables** — resolved or overridden placeholder values for this document. See [§11](#11-variables).
- **Client interaction state** — last viewed at, accepted at, client feedback. Written by the portal, stored on the proposal (or as events the engine aggregates).

### What the engine must not own

- Page size, orientation, column counts, or block order (Layout Engine).
- Fonts, colours, spacing, or border radii (Theme Engine / Brand Kit).
- Binary media (Asset Library). The proposal stores asset IDs, not files.
- Industry-specific top-level schemas. An architecture scale model and a software engagement are both proposals that reference different services and components.

### Independence rule

The same proposal record must be renderable as:

- any registered layout (Portrait, Landscape, Catalogue, Contract, Quotation, Architecture Proposal, …)
- any theme
- the client portal
- a PDF
- future surfaces (email preview, public link, print)

Changing layout, theme, or renderer **must not require migrating proposal data**. If a new field is needed, it is added to the shared model (or to a component’s schema) so every renderer can ignore or display it.

### Current mapping

Today the proposal model already holds content (`title`, `summary`, `sections`, `items`, `terms`, `notes`, `tags`, client fields, status) and a `layoutId` pointer. Settings hold a thin company profile. That split is the correct direction. `projectType` as a hardcoded enum is not; it will be replaced by the Service Library. Inline section/item blobs will evolve into Component Library instances without changing the rule that content lives on the proposal, not in the layout.

---

## 5. Layout Engine

Layouts are **presentation definitions only**.

A layout answers: page size, orientation, named regions, which blocks appear, in what order, and how those blocks are sequenced on screen vs PDF. It does not answer: what the client is buying, what it costs, or what the terms say.

### Contract

- Layouts are registered (id, label, description, geometry, region/block maps).
- Proposals and templates store a layout **id**, never an embedded copy of the definition.
- Unknown or future layout IDs fall back to a default at render time without mutating the stored id.
- Adding a layout means adding a definition and registering it. It does not mean changing the proposal model, the PDF document class, or the client portal’s data loading.

### Same data, different presentation

These layouts — and any future ones — all consume the same proposal data:

| Layout                 | Role                                              |
| ---------------------- | ------------------------------------------------- |
| Portrait               | Default paginated proposal                        |
| Landscape              | Wider / presentation arrangement                  |
| Catalogue              | Multi-item, visual, service-heavy                 |
| Contract               | Legal-forward, signature and terms prominent      |
| Quotation              | Price-forward, compact commercial offer           |
| Architecture Proposal  | Visual and scope-heavy arrangement for that trade |
| Future layouts         | Registered the same way                           |

“Architecture Proposal” is a layout (and possibly a template that picks that layout and a set of components). It is **not** a separate product, schema, or engine.

### Blocks vs components

Layout block IDs are slots in a presentation (`cover`, `pricing`, `gallery`, …). The Component Library provides the reusable content types that fill those slots. A layout must not hard-code copy, prices, or images; it only says where a pricing block goes.

Screen and PDF may use different component implementations for the same block id, because the rendering technology differs. Both implementations read the same proposal fields.

### Non-goals

- Layouts do not persist user content.
- Layouts do not branch business logic (pricing rules, acceptance, validity).
- Layouts do not embed Brand Kit. They receive brand and theme at render time.

---

## 6. Theme Engine

Themes control **how** a proposal looks: typography, colours, spacing, borders, radius, density, and related visual styling.

Themes do **not**:

- add or remove proposal content
- change layout structure (regions, block order, page orientation)
- store client or commercial data
- replace Brand Kit

### Relationship to Brand Kit

Brand Kit is identity (this company’s logo, palette, typefaces, contact block). A theme is a styling system (how type scale, spacing, and chrome are applied). Renderers combine them:

1. Layout decides structure.
2. Brand Kit supplies identity tokens (logo, primary colour, fonts, footer text).
3. Theme supplies the rest of the visual system and maps brand tokens onto it.
4. Proposal Engine supplies content.

A workspace may eventually ship multiple themes (for example a dense quotation theme and a cinematic catalogue theme). Switching theme restyles the document; it does not rewrite it.

### Application chrome vs document chrome

The app shell (sidebar, dashboard, forms) may use a product theme. Customer-facing documents use Brand Kit + document themes. Do not mix those palettes in document renderers. Hard-coded document colours are a bug; they should come from theme/brand tokens.

---

## 7. Brand Kit

Every workspace owns its branding. Brand Kit is the single source of company identity for that workspace.

### What it contains

- **Logos** — primary, inverse, mark, and future variants, stored as Asset Library references.
- **Colours** — primary, secondary, neutrals, and semantic colours the documents are allowed to use.
- **Typography** — heading and body families, weights, and fallbacks.
- **Contact details** — legal name, address, email, phone, website, and future fields.
- **Watermark** — optional mark for draft, preview, or all PDFs.
- **Footer** — default document footer (legal line, page style, contact strip).
- **Cover styles** — default cover treatment (full-bleed, split, minimal) used when a layout includes a cover block.
- **Future brand assets** — stamps, letterheads, signature images, social icons, certification marks — added to Brand Kit, not scattered across templates.

### Inheritance

Everything throughout the application consumes Brand Kit automatically:

- Studio proposal preview
- Client portal
- PDF Engine
- Templates (preview and defaults)
- Future email and public links

Proposals do not clone the Brand Kit. They resolve it from the workspace at render time so a logo update appears on every unspecialised document. If a document-level override is ever required, it is an explicit exception stored as a reference (for example “this proposal uses a campaign logo”), not a fork of the kit.

### Current mapping

Studio settings (`studioName`, `contactEmail`, `about`) are a stub of Brand Kit. They should grow into this module rather than remain a flat settings form while documents invent their own headers.

---

## 8. Service Library

**Services replace Project Types.**

Project types as a fixed enum (`Branding`, `Web Development`, `Fabrication`, …) cannot represent every industry and cannot carry defaults. A service is a **company-defined offering** in the workspace catalogue.

### Examples

These are examples, not a built-in taxonomy:

- Architecture Scale Model
- 3D Printing
- Software Development
- Legal Services
- Marketing Campaign
- Consulting

A fabrication shop and a law firm never share the same list. The engine only requires that a service has a stable id and a schema for its defaults.

### What a service may contain

- Default descriptions and scope language
- Pricing models (fixed, unit, hourly, milestone, retainer, custom)
- Default assets (from Asset Library)
- Deliverables
- Timelines or typical duration
- Variables specific to that offering
- Default components to insert when the service is added to a proposal
- Future fields (warranty, SLA, jurisdictions) as data on the service, not as new proposal engines

### How proposals use services

A proposal references one or more services (or line items derived from them). The proposal stores the **instance** values (agreed price, chosen options). The Service Library remains the reusable definition. Editing a service updates future assemblies; existing sent proposals keep the values they were sent with.

Do not resurrect project type as a parallel concept. Migration is: map each old `projectType` string onto a Service Library record, then drop the enum from the proposal model.

---

## 9. Component Library

Reusable proposal blocks. The document is an ordered list of component instances, not a free-form blob and not a layout-specific tree.

### Examples

- Executive Summary
- Gallery
- Pricing
- Timeline
- FAQ
- Warranty
- Team
- About Us
- Testimonials
- Terms

New industries add components (or configure existing ones). They do not add a new proposal type.

### Rules

- A component has a stable type id, a field schema, and one or more renderers (screen, PDF, portal).
- Templates and services may include default component instances.
- Layouts place components into regions by type/slot; they do not define component schemas.
- Empty or unused components are a presentation concern (hide when empty), not a reason to store different data per layout.
- Custom one-off text still uses a generic component (for example a rich-text or notes block), so it remains addressable, reusable, and renderable everywhere.

The existing screen/PDF blocks (`cover`, `summary`, `sections`, `pricing`, `gallery`, `terms`, `notes`, `signature`, `tags`) are the seed of this library. They should be generalised into registered components rather than replaced by a second block system.

---

## 10. Asset Library

A reusable media manager for the workspace.

### Supported kinds (extensible)

- Images
- Renders
- Videos
- Documents
- Certificates
- Future file types (3D, CAD previews, audio, signed PDFs)

### Rules

- Files live in the Asset Library. Proposals, services, components, Brand Kit, and templates store **asset IDs** (and optional captions, crop, or role).
- The same render can appear in a service default, a template gallery, and ten proposals without duplication of the file.
- Renderers receive resolved URLs or blobs at display time; they do not scrape files out of proposal JSON.
- Deleting or replacing an asset is a library operation. Sent proposals should keep a snapshot or immutable reference so historical PDFs do not silently change — exact snapshot policy is an implementation detail, but the principle is: library is reusable, sent documents are stable.

Do not introduce per-page image uploads that never enter the library. Upload UI may live on the proposal editor; persistence belongs in the Asset Library.

---

## 11. Variables

Dynamic placeholders resolved at render time (and previewed in the editor).

### Examples

```
{{Client.Name}}
{{Proposal.Date}}
{{Company.Name}}
```

Further namespaces will follow the same pattern, for example `{{Client.Company}}`, `{{Proposal.Number}}`, `{{Proposal.ValidUntil}}`, `{{Company.Email}}`, `{{Service.Name}}`.

### Rules

- Variable **definitions** are platform- or workspace-level (what keys exist, where they resolve from).
- Variable **values** come from proposal data, Brand Kit, services, or explicit overrides — never from a layout.
- Unresolved variables must fail visibly in preview (do not ship `{{Client.Name}}` to a client).
- Layouts, themes, and PDFs display resolved strings; they do not implement their own token languages.
- AI and templates insert variable syntax; the Proposal Engine (or a shared resolver used by every renderer) performs substitution.

Variables keep content reusable: an “About Us” component can live in the library once and still print the correct company name on every workspace’s proposals.

---

## 12. Roadmap

Phases, not dates. A later phase may start only when the previous phase’s modules are stable enough to extend.

### Foundation

Make the current app match the principles, without expanding into new product surfaces.

- Keep the Proposal Engine as the only document model; stop adding presentation fields to it.
- Grow settings into Brand Kit (identity consumed by preview, portal, and PDF).
- Replace Project Types with Service Library.
- Formalise layout registration as the only way to add document types.
- Extract a Theme Engine from hardcoded document styles so brand tokens flow into screen and PDF.
- Introduce Asset Library as the persistence path for media already shown in galleries.
- Keep Client Portal and PDF Engine as pure consumers of the same data.

This phase is complete when a new layout can ship by registration alone, and a logo/colour change in Brand Kit appears in studio preview, portal, and PDF without editing proposals.

### Studio Platform

Turn the workspace into a reusable content studio.

- Component Library as first-class records, not only layout block IDs.
- Templates compose services, components, assets, default layout, and default theme.
- Variables in templates and components.
- Richer Brand Kit (covers, watermark, footer, type).
- Additional layouts: Catalogue, Contract, Quotation, Architecture Proposal — all on the same engine.
- Snapshot/version behaviour that keeps sent documents stable while libraries evolve.

This phase is complete when a workspace can define its industry entirely through libraries and templates, with no code change.

### Sales Platform

Turn proposals into a commercial workflow.

- Client records and repeat sending.
- Analytics on views, engagement, and conversion.
- Stronger portal: comments, signing, multi-party, expiry.
- Quotation-to-proposal and contract flows as **layouts and statuses**, not new engines.
- Team/workspace members, roles, and audit trail (as needed).

This phase is complete when sales performance is visible and clients can complete a deal on the same document model used in the studio.

### AI Platform

Add an assistant that writes into the existing system.

- Draft proposals from a brief into the Proposal Engine.
- Suggest services, components, and assets from the workspace libraries.
- Fill and validate variables.
- Rewrite tone against Brand Kit; never invent a parallel document format.
- Optional analytics-informed suggestions (which templates convert).

This phase is complete when AI output is indistinguishable from human-authored proposal data: editable, layout-agnostic, and renderable by portal and PDF.

---

## 13. Engineering Rules

These rules keep ProposalForge scalable. Prefer them over short-term shortcuts.

### 1. Models are pure

Domain models (proposal, template, settings/brand, future service/component/asset) normalise and validate data. They have no I/O, no React, no PDF imports. Storage and HTTP live in services. UI lives in pages and components.

### 2. Services are the only data access layer

UI hooks call services. Services own persistence. Swapping an in-memory store for an API is a service-internal change. Pages must not import stores or shape records ad hoc.

### 3. Extend by registration, not by forks

New layouts, blocks/components, asset kinds, and statuses are added to registries. Do not copy `ProposalDocument` or the proposal model for a new industry or page shape.

### 4. Presentation never writes canonical content

Layout definitions, theme objects, PDF components, and portal views may format, hide empty fields, and arrange blocks. They must not persist duplicate summaries, prices, or HTML that the editor cannot round-trip.

### 5. One document, many renderers

Screen preview, client portal, and PDF share block IDs and read the same record. If a renderer needs a new field, add it to the model or component schema so every renderer can use it. Do not add `pdfOnlyTitle` or `portalHtml`.

### 6. IDs, not copies, for shared resources

Brand Kit, services, components (definitions), assets, layouts, and themes are referenced by id. Deep-copy only at the moment a proposal (or sent snapshot) must freeze instance values.

### 7. Workspace identity flows from Brand Kit

Do not pass studio name, logo, or colours as one-off props through unrelated trees when Brand Kit (or a resolved brand context) should provide them. Document chrome must not hard-code product UI colours.

### 8. Industry configuration is data

If supporting a new industry requires a new React page tree or a new proposal schema, the design is wrong. It should require new services, components, assets, and perhaps a registered layout.

### 9. Features attach to modules

| Kind of work              | Where it belongs                          |
| ------------------------- | ----------------------------------------- |
| New field on a proposal   | Proposal Engine                           |
| New visual arrangement    | Layout Engine                             |
| New look and feel         | Theme Engine / Brand Kit                  |
| New reusable section      | Component Library                         |
| New offering              | Service Library                           |
| New file type             | Asset Library                             |
| New client action         | Client Portal + Proposal Engine lifecycle |
| New export quirk          | PDF Engine                                |
| New insight               | Analytics                                 |
| New generation behaviour  | AI Assistant consuming the above          |

If the work does not fit a module, add a module to this document first. Do not smuggle a new system into an existing folder.

### 10. Compatibility over rewrites

Ship additive changes. Preserve stored IDs. Unknown layout IDs fall back safely. Migrations (project type → service, sections → components) are explicit and one-way. Do not break sent proposals to make the studio nicer.

### 11. Keep the UI stack consistent

Stay on the existing application stack (React, Vite, CSS Modules, design tokens, declarative routing) unless this document is updated. Tokens belong in one place; components consume them. Do not introduce a second styling system for documents without routing it through the Theme Engine.

### 12. No speculative engines

Do not build AI, analytics, or a second layout runtime ahead of Foundation. Stub modules are allowed only as clear boundaries (for example a brand object that settings already resemble). Unused abstractions that duplicate the current path are not boundaries; they are forks.

---

## Working agreement

Before implementing a feature, check:

1. Which module owns this?
2. Does it keep content separate from presentation?
3. Can another industry use it unchanged?
4. Does it extend a registry or library instead of replacing one?

If the answer to 2–4 is no, the feature is not ready to build.
)
