# H14 — Living Proposal

Interactive Proposal Experience

Internal implementation source of truth for Horizon 14. Product intent lives in `PRODUCT_VISION.md`. Platform rules live in `ARCHITECTURE.md`. This document tells engineering how to implement H14 without forking those systems.

H14 is ready for implementation. This file does not authorize starting work until an implementation brief is issued. Do not treat this document as permission to migrate production storage, wire vendors, or invent a second proposal schema.

---

## Terminology

These names are locked. Do not conflate them.

| Name | Meaning |
| --- | --- |
| **ProposalForge** | The complete proposal platform. |
| **Forge** | ProposalForge’s AI assistant / intelligence layer. It operates across company knowledge, proposals, clients, workflow, interactions, commercial signals, and later integrations. |
| **Forge Creation** | The proposal-creation experience powered by Forge (brief, website, email, template, client request, previous proposal). |
| **Forge Rive** | A separate cross-cutting visual/product workstream to design and animate the Forge assistant in Rive. |

Forge is **not** Forge Creation. Forge Rive is **not** Forge. A living proposal page is **not** a Forge chatbot.

---

## Locked roadmap

| Horizon | Name | Status |
| --- | --- | --- |
| H8 | Company Knowledge / Knowledge System | Complete |
| H9 | Forge + AI Proposal Creation | Complete as generator/coach/improve; `forge` capability remains off |
| H10 | Internal Proposal Workflow | Complete |
| H11 | Client Portal | Complete |
| H12 | Client Interactions | Complete |
| H13 | Follow-up / Next Action | Complete |
| **H14** | **Living Proposal / Interactive Proposal Experience** | **This document** |
| H15 | Advanced Commercial Interaction | Future |
| H16 | Automation + Integrations | Future |

---

## State domains (do not collapse)

H14 must keep these as separate objects. They may reference each other by id. They must not merge into one JSON blob.

| Domain | Source of truth | H14 may |
| --- | --- | --- |
| **A. Authored proposal content** | Proposal Engine (`proposal` + `blocks`) | Add offer-group fields on blocks; never let the client write this |
| **B. Client interaction state** | H12 interactions (+ existing portal comments until converged) | Bind comments/questions/change requests to living sections by `blockId` |
| **C. Commercial selection state** | New `living` session/decision records | Store package/add-on choices and derived totals snapshots |
| **D. Workflow state** | H10 workflow store | Read; emit viewed/accepted through existing workflow APIs only |
| **E. Follow-up state** | H13 follow-up store | Consume new signals; do not own living UI |
| **F. Analytics/event state** | Activity events + view analytics + new living events | Observe; never become document content |

Proposal remains the source of truth for what was offered. The client portal is a renderer and interaction surface, not a second document store.

---

## 1. Purpose

Turn a sent proposal URL into a branded, interactive commercial experience.

The client should experience a living web proposal: hero, services, proof, galleries, specifications, pricing, packages, optional add-ons, alternatives, timeline, team, FAQ, terms, and close. The studio remains the only author. Client actions create signals for Follow-up (H13) and later Advanced Commercial Interaction (H15) and Forge.

Benchmark: Qwilr-style shareable web proposals. Do **not** clone Qwilr. Build a ProposalForge-native experience on the existing proposal, portal, interaction, workflow, follow-up, and block systems.

---

## 2. Product definition

A **Living Proposal** is the client-facing presentation of an existing Proposal Engine record at a stable public URL.

It is:

- a renderer (Brand Kit + theme + layout + blocks)
- an interaction surface (navigate, select, comment, accept)
- a signal source (opens, section views, commercial selections)

It is not:

- a second proposal schema
- a marketing-site builder
- H15 vendor close (Stripe, DocuSign)
- H16 automation
- a client-facing Forge chatbot

Success: one URL, designed sections, commercial choices that do not rewrite authored copy, structured feedback, and events that H13 can turn into next actions.

---

## 3. User experience

### Client

- Opens `/p/:token` (see §4).
- Sees a premium branded document, not ProposalForge chrome.
- Moves through sections with persistent navigation.
- Expands galleries, specs, FAQs, and packages.
- Selects authored packages / alternatives and toggles authored add-ons.
- Leaves questions, comments, and change requests.
- May accept, decline, complete the existing internal clickwrap, and use existing payment placeholders.
- Choices persist for that share session without editing studio content.

### Studio

- Authors the living experience in the existing proposal editor using blocks.
- Marks which blocks are client-visible / interactive.
- Authors packages, add-ons, and alternatives as commercial block data.
- After send, edits require an explicit republish against a frozen revision (see §19).
- Sees engagement and selections on the existing proposal/follow-up surfaces.

### Forge (studio)

- Summonable assistant over real ProposalForge data.
- Not present on the client living page in H14 (client sees the company’s brand).

---

## 4. Canonical client route

| Route | Role in H14 |
| --- | --- |
| `/p/:token` | **Canonical Living Proposal URL.** |
| `/p/share/:token` | Current implementation; keep as alias or the rendered path behind the canonical route. |
| `/portal/:portalId` | H11 publication identity. Do not grow this as a second living app. Redirect to `/p/:token` once share-token mapping is reliable. |

Today two client UIs exist:

1. **Share-token portal** (`ClientPortal` → `PortalApp`) — full block document, accept/sign/pay, questionnaire, older comments.
2. **H11 proposal portal** (`ProposalPortal`) — flattened client-safe projection + H12 interactions.

**Locked decision:** evolve `PortalApp` into the living experience. Keep H11 for publish/revoke/expiry and client-safe field policy. Do not add a third client application.

Public URL shape for the product: `proposalforge.com/p/:token` (token is the existing unguessable `shareToken`).

---

## 5. Existing systems reused

Do not duplicate these.

| System | Reuse |
| --- | --- |
| Proposal Engine | Authored content, status, share token, versions |
| Block Engine | Section spine (`COVER`, `PRICING`, `GALLERY`, …) |
| Commercial modules | `TABLE`, `ADDONS`, `MILESTONES`, `RECURRING`, `DISCOUNT`, `TAX` on pricing blocks |
| Brand Kit / theme / layout | Presentation only |
| Share access | Password, email gate, expiry, revoke |
| H11 portal domain | Publication lifecycle; client-safe projection policy |
| H12 interactions | Comment, question, change request, approval; immutable after submit |
| H10 workflow | Studio pipeline; viewed/accepted transitions |
| H13 follow-up | Operational next-action layer |
| Activity + view analytics | Studio audit and mock/real session stats |
| Questionnaire | Client questions without a new form engine |
| Signature / payment models | Placeholders only; no vendors |
| Production API adapter | `server/productionApi.js` plugin chain |
| SPA routing | `vercel.json` already rewrites client routes |

Capability flags that stay **false** in H14: Forge, RAG, vendor digital signature, payment processing, WhatsApp, CRM, realtime chat, auto proposal edit, marketing site, unguessable-URL-as-auth.

---

## 6. Proposal model requirements

Keep the universal proposal model. No industry-specific top-level schemas.

**Proposal Engine continues to own**

- identity, lifecycle, parties
- authored blocks and commercial offer definitions
- share token, layout/theme pointers, versions
- high-level client timestamps already on the record (`lastViewedAt`, `acceptedAt`)

**Proposal Engine must not absorb**

- per-section view streams
- package selection history
- follow-up queues
- workflow review comments
- Forge prompts or provider secrets

Additive authored fields (on blocks or a small proposal-level `living` config object, not a new document type):

- `clientVisible` / `interactive` on block instances
- offer groups: packages, alternatives, selectable add-ons (see §10)
- optional `publishedRevision` pointer for the live link (see §19)

Do not add `packages` as a disconnected top-level industry SKU list. Offers live on commercial blocks so layout/PDF/portal all read the same data.

---

## 7. Block / component requirements

Documents are ordered `blocks[]`. H14 treats enabled blocks as living sections.

**Use existing Block Engine types first**

`COVER`, `EXECUTIVE_SUMMARY`, `RICH_TEXT`, `GALLERY`, `PRICING`, `TIMELINE`, `DELIVERABLES`, `SPECIFICATIONS`, `TEAM`, `TESTIMONIALS`, `FAQ`, `TERMS`, `SIGNATURE`, `ATTACHMENTS`, `CUSTOM`

**Promote from the content-library catalog when needed (still universal)**

`OPTIONAL_PRICING`, `ALTERNATIVES`, `VIDEO`, and related catalog types already exist on `CONTENT_BLOCK_TYPE` but are not all Block Engine builtins. Promote them into the engine rather than inventing Qwilr-like widgets.

**Rules**

- Layouts place blocks; they do not store prices or copy.
- Screen, living portal, and PDF share block ids.
- Empty blocks hide in presentation; they do not fork data per surface.
- H12 interactions target `blockId` (already supported in H12).

---

## 8. Studio authoring / editing requirements

Studio can:

- compose the living page from existing blocks
- mark blocks client-visible / interactive
- author packages, add-ons, alternatives, optional services on commercial blocks
- reorder blocks (existing editor)
- change imagery, timeline, and terms as authored content
- republish a frozen revision to the live link

Studio cannot, in H14:

- let the client become a co-author
- auto-rewrite the proposal when a client selects an add-on
- silently change a sent snapshot without republish

After send, the editor edits the working proposal. The public living URL continues to serve the last published revision until the studio explicitly updates live.

---

## 9. Client interaction capabilities

### In H14

- Open and navigate the living proposal
- Expand sections, galleries, FAQs, packages
- Select one package or alternative; toggle authored add-ons
- Answer questionnaire questions
- Create H12 interactions (comment, question, change request, approval) once bound to the living URL
- Upload files through the existing portal files module
- Accept / decline through existing proposal lifecycle
- Use existing internal signature and payment **placeholders**

### Not in H14

- Edit headings, body, prices, terms, or block order
- Create or delete packages
- See studio notes, versions, coach, knowledge, follow-ups, or generation metadata
- Realtime presence, typing, or chat
- Vendor e-sign or card capture

`EDIT_CONTENT` and `MANAGE_BLOCKS` remain denied. `INTERACTION_CAPABILITIES.autoProposalEdit` remains false.

---

## 10. Pricing / package / optional-service model

**Authored (Proposal Engine / commercial blocks)**

Reuse `COMMERCIAL_MODULE`:

- `TABLE` — included investment lines
- `ADDONS` — optional add-ons (`included === false` already used in PDF totals)
- `MILESTONES`, `RECURRING`, `DISCOUNT`, `TAX`

H14 extends authored data with **offer groups**:

- **Package** — mutually exclusive set of included lines (choose one)
- **Alternative** — mutually exclusive scoped option (A / B / C)
- **Optional service** — independently toggleable add-on already modeled as add-ons

These are universal commercial structures, not industry SKUs.

**Selected (living session)**

Client selections reference offer ids. Displayed total = authored prices × current selection. Do not write the client’s choice back into `proposal.items` or block line `amount` fields.

---

## 11. Commercial interaction model

1. Studio authors the offer graph on the proposal.
2. Living session records `{ offerId, selected, at, proposalVersion }`.
3. Renderer derives totals for display.
4. Accept/sign/pay (existing placeholders) operate on a **decision snapshot** captured at that moment.
5. Follow-up and later Forge read the snapshot and events.

H15 owns real payment, multi-party signature, invoices as a close system. H14 must not flip `digitalSignature` or `paymentProcessing` to true.

---

## 12. Events and signals

Do not duplicate `ACTIVITY_EVENT_TYPE`, portal events, interaction events, or follow-up events. Extend them.

### Reuse

- `proposal_viewed`, `client_opened`
- portal access events
- `interaction.created` / acknowledged / resolved
- workflow `viewed` / `accepted`

### Add (living domain)

| Event | Analytics | Follow-up | Forge (later) |
| --- | --- | --- | --- |
| `living.opened` | yes | NEVER_OPENED / AWAITING_RESPONSE | later |
| `living.section_viewed` | yes | no (too noisy) | later |
| `living.pricing_viewed` | yes | maybe AWAITING_RESPONSE | later |
| `living.package_expanded` | yes | no | later |
| `living.package_selected` | yes | new reason `commercial_selection` | yes |
| `living.addon_selected` | yes | `commercial_selection` | yes |
| `living.question_answered` | yes | existing CLIENT_INTERACTION | later |
| `living.acceptance_started` | yes | yes | yes |
| `living.republished` | studio | no | later |

Analytics stores events. Follow-up **reads** signals. Forge **consumes** the same events. None of those layers own authored content.

---

## 13. H12 interaction convergence

Today:

- `/p/share/:token` uses older `proposal.comments` / portal comment modules
- `/portal/:portalId` uses H12 `interactions` records scoped by `portalId`

**H14 rule:** H12 is the structured feedback system. Mount it on the living document by `blockId`. Do not grow the legacy comment path.

Convergence work (phase 6):

- public interaction APIs must accept the living share token (or map token → portal id)
- keep immutability and studio ack/resolve
- keep `autoWorkflowTransition` and `autoProposalEdit` false
- studio follow-up `CLIENT_INTERACTION` continues to resolve from H12

Until convergence ships, do not add a third feedback model.

---

## 14. H13 follow-up integration

H13 remains the operational next-action layer. H14 does not replace it.

Follow-up continues to read proposal, workflow, portal, and interactions. H14 adds living signals:

- open / never opened (already aligned with `lastViewedAt`)
- commercial selection without accept
- acceptance started

Suggested additive reason (do not overload MANUAL):

- `COMMERCIAL_SELECTION` — client chose a package or add-on and has not accepted

Follow-up stays studio-only. `/api/followups/public` remains 403. Living pages must never call follow-up APIs.

`FOLLOWUP_CAPABILITIES.llm`, `emailDelivery`, `whatsapp`, `crm` remain false.

---

## 15. Forge integration

Forge is the platform intelligence layer, not a page-specific chatbot.

**H14 Forge (studio only, optional late phase)**

- Summarize client engagement from living events + interactions + follow-up
- Explain why a proposal has not been accepted
- Suggest the next commercial action by **creating or updating a follow-up** (no email send)
- “Make this more persuasive” / “Create three package options” draft into the Proposal Engine; a human applies

**H14 must not**

- put Forge on the client living page
- enable `KNOWLEDGE_CAPABILITIES.forge` or `GENERATOR_CAPABILITIES.forge` as a blanket “Forge is done”
- call external providers beyond what H9 already supports for studio authoring
- auto-rewrite the live proposal

Forge reads real ProposalForge data. It does not invent a parallel document.

---

## 16. Forge Creation integration

Forge Creation is how proposals are born. Living Proposal is how they are received.

```
Brief / website / email / template / prior proposal
        → Forge Creation (H9 + later sources)
        → Proposal Engine
        → Workflow ready → publish + share token
        → Living Proposal (H14)
        → Client decisions + events
        → Follow-up (H13) + Forge (studio)
        → Next action or revise via Forge Creation
```

H14 does **not** implement website crawl, email ingest, `websiteContext`, or `proposalCloning`. It only requires that Creation writes ordinary proposal blocks the living renderer can show.

---

## 17. Forge Rive requirements

Parallel design workstream. Not a blocker for living renderer phases 1–5.

**Where (H14):** studio Forge entry (dashboard, proposal detail, later editor). **Not** on the client living page.

**States:** idle, listening, thinking, working, success, warning/error, presenting results.

**Behavior:** summonable (button / command), not a persistent floating mascot.

**Mapping:** product status → Rive state-machine inputs. If Rive fails: icon + text. Honor `prefers-reduced-motion`.

**H14 engineering deliverable:** documented contract + non-Rive fallback shell when Forge studio actions exist. The `.riv` file is designed separately.

---

## 18. Analytics

Analytics observes; it does not own the proposal.

- Reuse `activityEvent` for studio audit.
- Reuse `viewAnalytics` / `recordViewSession` for opens on the share path.
- Add living events (§12) as first-party events from the living page.
- No tracking pixel requirement in H14.
- Do not store a duplicate copy of sections in analytics.

Section-view events are for engagement charts and Forge summaries, not for spawning a follow-up per section.

---

## 19. Versioning / history

Reuse `proposal.versions`.

**Rule:** the public living URL resolves a **frozen published revision** (blocks + authored offers).

Studio edits create working versions as they do today. “Update live proposal” is explicit:

- writes / points `publishedRevision`
- emits `living.republished`
- does not rewrite in-flight client decision snapshots

Client decisions store `proposalVersion`. Accept uses that snapshot.

Do not implement `GENERATOR_CAPABILITIES.versionGeneration` as an H14 feature.

---

## 20. Security / privacy boundaries

- Share token in the URL is not authentication (`unguessableUrlIsAuth` remains false).
- Keep share gates: password, email, expiry, revoke.
- Public living APIs are token-scoped.
- Client projection continues to strip notes, versions, coach, knowledge, generation, follow-ups, API keys, and internal comments.
- No studio follow-up, workflow review, or Forge APIs on the living page.
- Company isolation via the proposal’s workspace / `companyId`.
- Rate-limit living event POSTs.
- Do not log share passwords or secrets.

---

## 21. Responsive / mobile behavior

- Single column on small screens.
- Sticky section jump + sticky commercial summary (selection + derived total).
- Tap-sized package / add-on controls; no hover-only compare.
- Galleries swipe; no horizontal overflow (existing mobile guards).
- Living page is brand-first; Forge Rive is studio-only.
- Reduced motion: skip heavy animation and Rive.

---

## 22. API requirements

Reuse `dispatchProductionApi`. Add a living plugin; do not put living writes on `PUT /api/proposals`.

### Public (token)

- `GET /api/living/:token` — client-safe living view + current session + derived totals
- `POST /api/living/:token/decisions` — package / add-on selection
- `POST /api/living/:token/events` — engagement events

### Studio

- `GET /api/living/proposal/:proposalId` — engagement + selections summary
- `POST /api/living/proposal/:proposalId/publish` — point live URL at a frozen revision (or equivalent on portal publish)

### Existing APIs to reuse, not replace

- Share inspect / client proposal load
- H12 public interactions (after token mapping)
- H11 publish/revoke
- Workflow viewed/accepted
- H13 follow-up (studio only)

Public living APIs must not accept spoofable `actorId` as authorization.

---

## 23. Persistence requirements

| Data | Store | Notes |
| --- | --- | --- |
| Authored proposal | `data/proposals.json` (current) | Source of truth |
| Portal publication | `data/portal.json` | H11 |
| Interactions | `data/interactions.json` | H12 |
| Follow-ups | `data/followups.json` | H13 |
| Workflow | `data/workflow.json` | H10 |
| Living sessions / decisions / events | new living JSON (local) | Separate domain |

JSON files are **not** durable shared SaaS storage on Vercel (`/tmp` per instance). H14 implementation may use the current JSON pattern locally, matching other horizons. It must not pretend that pattern is production-durable. Durable datastore migration is **out of scope** for H14 (infra milestone).

H14 features that will eventually require shared durable storage: living sessions, selection snapshots, section events, republish, follow-up updates driven by those events.

---

## 24. Production considerations

- SPA rewrite already serves `/p/:token` and `/p/share/:token`.
- New `/api/living/*` must go through the production adapter, not a fake frontend API.
- Seed JSON on Vercel is instance-local; living decisions will not survive cold start in real production until shared storage exists.
- Do not change `vercel.json` SPA rules to swallow `/api`.
- Do not deploy vendor keys for sign/pay in H14.

---

## 25. Explicit non-goals for H14

Do **not** automatically include:

- client source-content editing
- collaborative document editing
- RAG / embeddings / vector search
- new external AI provider integration beyond existing H9 studio paths
- automatic proposal rewriting from client selections
- e-sign vendor integration (DocuSign, Dropbox Sign, Adobe Sign, OpenSign)
- payment vendor integration (Stripe, PayPal, Square)
- CRM integration
- WhatsApp
- Slack
- Teams
- calendar integration
- durable datastore migration
- website/email Forge Creation sources
- client-facing Forge chatbot
- shipping a Rive file as a blocker
- industry-specific proposal engines
- Qwilr clone / marketing-site builder
- growing `/portal/:id` as a second living app

Those are future capabilities (H15, H16, Forge, Forge Rive, or infra).

---

## 26. Internal implementation phases

Safest order: renderer first, authored offers second, client decisions third, signals fourth, publish freeze fifth, H12 convergence sixth, studio Forge last.

### Phase 14.1 — Living renderer

**Objective:** Canonical `/p/:token` presents a section-navigable branded document from existing blocks. No new commercial writes.

**Likely files:** `src/App.jsx`, `src/portal/ClientShareRedirect.jsx`, `src/pages/ClientPortal/ClientPortal.jsx`, `src/portal/PortalApp.jsx`, portal header/aside, `src/workspace/paths.js`

**APIs:** none new; existing client proposal + share inspect

**Data:** none new

**UI:** living section nav, sticky close/summary using existing totals

**Tests:** route alias `/p/:token` → living page; no Vercel-style 404 in app router; client still cannot see follow-ups; existing portal tests still pass

**Not touched:** follow-up, workflow, H12, AI, `data/proposals.json` seed, vercel.json unless a bug is proven

### Phase 14.2 — Offer authoring

**Objective:** Studio can author packages / alternatives / selectable add-ons on commercial blocks. Client still read-only.

**Likely files:** `src/models/commercial.js`, `src/blocks/schemas.js`, pricing editor, PDF/screen pricing renderers

**APIs:** existing proposal save only

**Data:** authored offer groups on pricing (and catalog types if promoted)

**UI:** studio pricing editor; living page still non-selectable or display-only

**Tests:** commercial module round-trip; PDF totals still match; no industry schema

**Not touched:** living session store, follow-up reasons, Forge

### Phase 14.3 — Living session and selections

**Objective:** Client can select packages/add-ons. Derived totals. Authored `items[]` unchanged.

**Likely files:** `src/living/*`, `server/livingPlugin.js`, `server/productionApi.js`, living UI on `PortalApp`

**APIs:** `GET/POST /api/living/:token`, `POST .../decisions`

**Data:** living session + decisions (separate from proposal)

**UI:** selectable packages/add-ons; sticky derived total

**Tests:** selection does not write `proposals.json` line amounts; token isolation; invalid offer id rejected

**Not touched:** Stripe, DocuSign, follow-up mutations beyond existing view timestamps

### Phase 14.4 — Engagement events and H13 signals

**Objective:** Emit living events; analytics records them; follow-up resolver can see commercial selection.

**Likely files:** `src/living` events, `src/models/activityEvent.js` or living event log, `src/followup/reasons.js`, `src/followup/resolver.js`, `scripts/verify-followup.mjs`

**APIs:** `POST /api/living/:token/events`; studio follow-up GET still only

**Data:** living events; additive follow-up reason `commercial_selection`

**UI:** none required beyond existing follow-up queue picking up the signal

**Tests:** section_viewed does not create follow-ups; package_selected can; public follow-up still 403; existing follow-up tests pass

**Not touched:** email delivery, workers, LLM

### Phase 14.5 — Published revision and republish

**Objective:** Live URL serves frozen revision; studio republish is explicit.

**Likely files:** `src/models/proposalVersion.js`, portal publish path, living GET resolver, proposal detail “update live”

**APIs:** studio publish-live; living GET reads published revision

**Data:** `publishedRevision` pointer; decisions keep `proposalVersion`

**UI:** studio control to update live proposal

**Tests:** in-flight selection snapshot unchanged after unpublished studio edits

**Not touched:** generator versionGeneration, collaborative editing

### Phase 14.6 — H12 on the living document

**Objective:** Structured interactions on `/p/:token` by `blockId`. Thin `/portal/:id` redirects or aliases.

**Likely files:** `src/interactions/*`, `server/interactionsPlugin.js`, `PortalApp`, `ProposalPortal.jsx`, `App.jsx`

**APIs:** public interactions via token or token→portal map

**Data:** still `interactions.json`; no third comment store

**UI:** living page comments/questions/change requests; stop growing legacy `proposal.comments` path

**Tests:** existing H12 tests pass; portal isolation; no auto proposal edit

**Not touched:** realtime chat, workflow auto-transition

### Phase 14.7 — Studio Forge actions (optional in H14)

**Objective:** Studio-only summarize / next-action using living + follow-up data. Human remains author.

**Likely files:** thin `src/forge/actions/*` or proposal-detail panel; reuse coach/improve; follow-up create API

**APIs:** studio-only; no public Forge

**Data:** may write follow-ups; must not rewrite proposal unless the human applies a draft

**UI:** summonable studio assistant; non-Rive fallback

**Tests:** no client Forge; no RAG; capability flags stay honest

**Not touched:** Rive file, external new providers, Forge Creation sources

### Phase 14.8 — Forge Rive contract (parallel)

**Objective:** Document state-machine mapping and fallback. Asset produced outside this horizon’s critical path.

**Likely files:** studio chrome only if 14.7 exists

**APIs:** none

**Data:** none

**UI:** fallback icon/text; Rive when asset exists

**Tests:** reduced-motion fallback

**Not touched:** living client page

---

## 27. Dependencies

- H8–H13 domains in place
- Production API adapter and SPA rewrites (PR #14)
- Block Engine + commercial modules
- `PortalApp` share-token portal
- H11 publication + H12 interaction model
- H13 follow-up resolver

**Parallel, not blocking 14.1–14.2:** durable shared storage; Forge Rive artwork.

---

## 28. Risks

| Risk | Mitigation |
| --- | --- |
| Third client UI | Evolve `PortalApp` only; redirect `/portal/:id` |
| Client selection mutates authored prices | Living session is a separate domain; tests forbid `items[]` writes |
| Live edit without snapshots | Phase 14.5 required before treating selections as contractual |
| Dual comment systems | Phase 14.6; freeze legacy comment growth |
| Event noise | section_viewed never creates follow-ups |
| `/tmp` JSON on Vercel | Document honestly; do not ship H14 as durable SaaS close |
| Scope creep into H15 | Keep vendor flags false |
| Naming collapse (Forge vs Creation vs Rive) | This document’s terminology section is binding |

---

## 29. Suggested module / file structure

When implementation starts (not before):

```
src/living/
  types.js          # session, decision, event ids, capabilities (vendors false)
  schema.js
  store.js
  repository.js
  projection.js     # client-safe living view
  totals.js         # derived totals from authored offers × decisions
  signals.js        # map events → follow-up reasons without owning follow-up
  events.js

server/livingPlugin.js   # registered in productionApi.js and vite.config.js

src/portal/PortalApp.jsx # living renderer in place
src/models/commercial.js # offer groups
src/followup/reasons.js  # additive commercial_selection
```

Do not add `src/qwilr/`, a second proposal model, or a parallel activity log.

Optional later: `src/forge/actions/livingSummary.js` (studio only).

---

## 30. Recommended build order

1. 14.1 Living renderer  
2. 14.2 Offer authoring  
3. 14.3 Living session  
4. 14.4 Events + H13 signal  
5. 14.5 Published revision  
6. 14.6 H12 convergence  
7. 14.7 Studio Forge actions (optional)  
8. 14.8 Forge Rive contract (parallel)

Do not start 14.3 before 14.2. Do not start 14.6 by building a new feedback type. Do not start vendor pay/sign in any H14 phase.

---

## 31. Acceptance criteria

H14 is complete when all of the following are true:

1. `/p/:token` loads the living branded proposal (SPA, not a platform 404).
2. The page is rendered from Proposal Engine blocks, not a duplicate document store.
3. Studio-authored packages/add-ons/alternatives can be selected by the client without mutating authored content.
4. Derived totals match authored prices × selection.
5. Living events record open, section, pricing, and selection; section views do not spam follow-ups.
6. At least one new follow-up signal exists for commercial selection; public follow-up API remains studio-only.
7. H12 interactions work on the living document (or a documented alias) without auto-editing the proposal.
8. Live URL can freeze a revision; republish is explicit.
9. Client cannot see studio follow-up, workflow internals, or Forge.
10. No RAG, no new AI vendors, no e-sign vendor, no payment vendor, no CRM/WhatsApp/Slack/Teams/calendar.
11. Existing verification suites for workflow, portal, interactions, follow-up, knowledge, and generator still pass.
12. New living/offer tests cover token isolation, non-mutation of proposals, and capability flags.
13. Documentation and flags still distinguish ProposalForge, Forge, Forge Creation, and Forge Rive.
14. Production adapter serves `/api/living/*` if those routes exist; SPA rewrite still excludes `/api`.

---

## Working agreement

Before implementing any H14 slice, check:

1. Which state domain owns this (A–F above)?
2. Does the proposal remain the authored source of truth?
3. Can another industry use it unchanged?
4. Are we extending a registry/block/plugin instead of forking a client app?

If the answer to 2–4 is no, the slice is not ready to build.
