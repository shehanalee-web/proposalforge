# ProposalForge Product Vision

Internal product document. This describes what ProposalForge should become, not how it is implemented. Engineering constraints live in `ARCHITECTURE.md`. This file is the product counterpart: who it is for, how it should feel, and what a complete proposal experience includes.

ProposalForge is a **universal proposal platform**. It is not a niche tool for agencies, architects, or any other single trade. Any company, in any industry, should be able to send a branded, client-ready proposal from the same product.

---

## Mission

ProposalForge should allow any company in any industry to create beautiful, professional proposals without hiring designers.

The bar is not “good enough for an internal draft.” The bar is a document a client is proud to open, forward, and sign — produced by the people who already do the work, not by a design team standing between them and the send button.

---

## Philosophy

A proposal should feel like a **premium presentation**, not a Word document.

Default output must already look designed: considered type, confident spacing, coherent colour, photography that sits in the layout as if an art director placed it. Authors fill in the work. The product is responsible for taste.

Everything should look polished by default.

- Empty states still look intentional.
- Unstyled dumps of text, stretched images, and leftover template junk are product failures.
- Choosing a layout or a service should never produce a uglier document than starting from a blank page.
- Screen preview, client portal, and PDF should feel like the same piece of work, not three different products.

If a feature makes proposals faster but makes them look cheaper, it does not ship.

---

## Universal Industries

ProposalForge must work equally well for:

- Architecture
- Interior Design
- Construction
- 3D Printing
- Manufacturing
- Engineering
- Marketing
- Creative Agencies
- Software Development
- IT
- Legal
- Medical
- Finance
- Consulting
- Education
- Real Estate
- Hospitality
- Events
- Retail
- E-commerce
- Logistics
- Government
- Freelancers
- and future industries

Industry differences show up as **what a company offers and how they present it** — services, assets, templates, tone — not as separate products, separate editors, or “architecture mode.” A law firm and a fabrication shop use the same platform. Neither should feel like a guest in someone else’s tool.

If a new industry cannot be served by Brand Kit, services, components, layouts, and assets, the product is not yet universal enough. The answer is to deepen those concepts, not to fork the product.

---

## Core Concepts

These are the nouns of the product. Authors should be able to explain them without reading engineering docs.

### Brand Kit

The company’s identity, set once. Logos, colours, type, contact details, cover and footer treatments, watermarks, and the rest of the visual system. Every proposal, template preview, client link, and PDF inherits Brand Kit automatically. Authors should not restyle a document to “look like us.” It already does.

### Theme

The visual language applied on top of brand: how type, colour, space, and chrome are used. Brand says *who we are*. Theme says *how this document feels* — dense and commercial, editorial and photographic, quiet and legal. Changing theme restyles the proposal; it does not rewrite the work.

### Layout

The arrangement of a proposal on the page: portrait, landscape, catalogue, contract, quotation, an architecture-style presentation, and layouts that do not exist yet. Layout is presentation only. Switching layout is like moving the same exhibition into a different gallery. The work does not change.

### Service Library

The company’s catalogue of offerings. Not a fixed list of “project types.” A studio defines Architecture Scale Model, 3D Printing, Legal Retainer, Marketing Campaign, or anything they sell. Each service can carry default language, pricing, assets, deliverables, and building blocks so starting a proposal feels like choosing work, not formatting a document.

### Asset Library

The company’s media. Renders, photos, videos, drawings, certificates, PDFs, and future files live here once and are reused everywhere. Authors pick assets; they do not manage a pile of copies inside each proposal.

### Proposal

The live document for a specific client: what is offered, what it costs, who it is for, and where it sits in the sales cycle. A proposal is assembled from brand, services, components, assets, and a layout. It is the thing that gets sent, viewed, accepted, and exported — not a designed file that only exists in one format.

### Template

A starting point the company trusts. A template remembers which services, components, layout, and placeholder content usually go together. Creating a proposal from a template copies that assembly; editing the new proposal does not change the template, and editing the template does not rewrite proposals already sent.

### Component Library

Reusable sections of a proposal: executive summary, gallery, pricing, timeline, team, terms, and the rest. Authors add blocks; they do not invent a new document type for every kind of page. Custom needs are met with custom blocks the platform already knows how to brand, layout, and export.

### Variables

Smart placeholders such as client name, proposal date, and company name. Write the language once; the product fills in the facts for each client. Authors should not hunt through a template replacing “Acme” by hand.

### Client Portal

The client’s experience of the proposal: a polished, branded page they can open, read, comment on, accept, or request changes. It is the same proposal the company wrote, not a stripped-down export. The portal is how proposals are meant to be received.

### PDF

The portable, official artefact — for inboxes, procurement, print, and archive. It must look like the premium presentation, not a print stylesheet of a web page. PDF is a view of the proposal, not a second document the author has to maintain.

### AI

A future assistant inside the same product. It helps write, price, summarise, place images, choose layouts, score, and translate. It never becomes a separate “AI proposal” that bypasses brand, layout, or the libraries. Humans remain the authors; AI drafts into the real proposal.

---

## Proposal Experience

Every proposal should be capable of including the following, **without custom coding**. If a company needs one of these, they add it. They do not file a feature request or hire a developer.

- **Beautiful cover** — a first page that feels designed, not a title stuck on letterhead.
- **Executive summary** — the case for the work, in language a decision-maker can read in a minute.
- **Image galleries** — photography and renders presented as part of the layout, not a stack of attachments.
- **Videos (future)** — walkthroughs, reels, and explainers where the medium belongs in the proposal, not only in a follow-up email.
- **Before / after comparisons** — transformations the client can see, not only be told about.
- **Pricing** — clear commercial terms, as prominent or as quiet as the layout requires.
- **Optional pricing** — add-ons and electives the client can consider without a second document.
- **Alternatives** — option A / B / C, packages, or scopes, presented as choices rather than confusion.
- **Tables** — structured information that stays readable on screen and in PDF.
- **Specifications** — materials, performance, scope limits, and technical detail when the work demands it.
- **Technical drawings** — plans, diagrams, and CAD-derived visuals as first-class content.
- **Downloads** — files the client can take with them without leaving the proposal experience.
- **Attachments** — supporting documents that travel with the proposal.
- **Timeline** — when the work happens, in a form that is easy to scan.
- **Milestones** — named moments of delivery and decision.
- **Deliverables** — what the client actually receives.
- **Team** — the people who will do the work.
- **Testimonials** — proof from other clients, branded like the rest of the document.
- **FAQs** — objections answered before the call.
- **Warranty** — guarantees and aftercare, in plain view.
- **Terms** — commercial and legal conditions, still part of the designed document.
- **Signature** — a clear place to agree, on screen and on paper.
- **Appendices** — overflow that stays organised instead of becoming a second PDF.
- **Company profile** — who we are, pulled from brand and library, not rewritten per proposal.
- **Maps** — location, site, or service area when place matters.
- **QR codes** — a bridge from print to portal, payment, or a supporting page.
- **Custom blocks** — company-specific sections that still inherit brand, layout, and export.

Not every proposal uses every block. Every industry must be able to use the ones it needs, from the same palette, and still look like itself.

---

## Branding

Every company can define:

- Logos
- Light logo
- Dark logo
- Colors
- Fonts
- Typography scale
- Buttons
- Icons
- Cover style
- Header style
- Footer style
- Watermarks
- Page numbers
- Spacing
- Document borders
- Corner radius

Everything should inherit these automatically.

Authors should not pick a logo variant per page, restyle a footer per template, or match a hex code from memory. Light surfaces use the light logo; dark surfaces use the dark logo. Covers, headers, footers, buttons, and page furniture all come from Brand Kit. A brand change — new colour, new mark, new type — should ripple through studio preview, client portal, and PDF without retouching old templates by hand.

The client should never see ProposalForge’s product chrome in the document. They should see the company’s brand.

---

## Asset Experience

Images should simply be uploaded.

Proposal authors should never manually resize or crop images.

Layouts automatically determine how assets are displayed.

The author chooses *which* photograph or render belongs in the story. The layout chooses *how* it is framed: full-bleed cover, gallery grid, before/after pair, inline figure, thumbnail in a table. Cropping, fit, and resolution for screen vs PDF are the product’s job.

If an author is fighting image boxes, the asset experience has failed. If the same file looks correct on a landscape presentation, a portrait contract, and a phone-sized portal, it has succeeded.

---

## Fonts

Support **Google Fonts** initially so any company can match its brand type without a design ops process.

Later, support **uploaded fonts** for houses that already own licensed typefaces, wordmarks, and families that are not on Google Fonts.

In both phases, fonts are part of Brand Kit. They apply through the typography scale to every proposal surface. Authors should not pick a font on a single heading to “make this page nicer.”

---

## AI

Future capabilities. None of this is in the product yet; when it arrives, it writes into the real proposal, using the real Brand Kit, libraries, and layouts.

- **Proposal writing** — draft scope, narrative, and section copy from a brief, a service, or a previous proposal, in the company’s voice.
- **Pricing suggestions** — recommend packages, line items, and ranges from the Service Library and past work, never inventing a private price list the rest of the product cannot see.
- **Grammar** — clean language without flattening the brand’s tone.
- **Image placement** — suggest which assets belong where, and in which layout, instead of leaving a gallery empty or a cover generic.
- **Layout optimization** — recommend portrait vs landscape vs catalogue vs contract based on content density, imagery, and how the client will read it.
- **Executive summaries** — distill a long proposal into a first-page argument a decision-maker can use.
- **Proposal scoring** — rate completeness, clarity, brand consistency, and likelihood to convert, so authors know what to fix before send.
- **Proposal translation** — produce client-language versions that keep structure, brand, and commercial meaning intact.

AI is an accelerator for authors who already own the work. It is not a generator of generic decks, and it is not a substitute for Brand Kit, layouts, or human approval.

---

## Long-Term Goal

ProposalForge should become the **Canva + Notion + Figma + PandaDoc** of proposal software.

- **Canva** — anyone can make something that looks designed, without a designer.
- **Notion** — content is structured, reusable, and assembled from blocks and libraries, not trapped in a single file.
- **Figma** — presentation quality: layout, type, and imagery that feel intentional on every surface.
- **PandaDoc** — the document is a business object: sent, viewed, signed, exported, and tracked.

The destination is one product where a company defines who they are and what they sell, then produces proposals that look like a studio made them, read like a strategist wrote them, and close like a sales tool. Every industry. No custom coding. Polished by default.
