import { FINDING_CODE } from '../insights/ids.js'

export const COACH_MODE = Object.freeze({
  BEGINNER: 'beginner',
  PROFESSIONAL: 'professional',
  SALES: 'sales',
  TECHNICAL: 'technical',
  ENTERPRISE: 'enterprise',
})

export const COACH_MODES = Object.freeze(Object.values(COACH_MODE))

export const COACH_MODE_LABELS = Object.freeze({
  [COACH_MODE.BEGINNER]: 'Beginner',
  [COACH_MODE.PROFESSIONAL]: 'Professional',
  [COACH_MODE.SALES]: 'Sales',
  [COACH_MODE.TECHNICAL]: 'Technical',
  [COACH_MODE.ENTERPRISE]: 'Enterprise',
})

function fields(explanation, whyItMatters, riskIfIgnored, recommendation) {
  return { explanation, whyItMatters, riskIfIgnored, recommendation }
}

/**
 * Mode copy for Health findings. Tone and depth change; the underlying
 * finding, severity, and repair order do not.
 */
export const FINDING_MODE_COPY = Object.freeze({
  [FINDING_CODE.MISSING_OBJECTIVES]: {
    [COACH_MODE.BEGINNER]: fields(
      'The proposal does not yet say what the client is trying to achieve, so it can feel generic.',
      'Clients need to see that you understood their goals before they trust the rest of the offer.',
      'This may reduce confidence and make the proposal feel like a template.',
      'Write two or three client-specific objectives in plain language.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Client objectives are not clearly stated, so the document is not anchored to a defined outcome.',
      'Objectives tell the reader why this work exists and how success will be judged.',
      'This can create uncertainty about whether the proposal is actually for this client.',
      'Define the major client objectives in concrete, client-readable terms.',
    ),
    [COACH_MODE.SALES]: fields(
      'Without named objectives, a buyer has nothing to champion in an internal review.',
      'Clear objectives make the value of the offer easier to evaluate and defend.',
      'This may slow approval because stakeholders cannot map the work to a business need.',
      'State the client outcomes the commercial offer is meant to deliver.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No explicit objective statements were found, so success criteria remain unbounded.',
      'Objectives constrain scope, deliverables, and acceptance.',
      'This can introduce delivery risk because the work has no stated target state.',
      'Specify measurable or observable client objectives and keep later sections aligned to them.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Stakeholder review is harder when the engagement is not tied to named business objectives.',
      'Procurement, delivery, and sponsors need a shared statement of intent before they approve.',
      'This may create approval friction across teams that cannot see the intended outcome.',
      'Record the authorised objectives so later sections can be checked against them.',
    ),
  },
  [FINDING_CODE.WEAK_VALUE_PROPOSITION]: {
    [COACH_MODE.BEGINNER]: fields(
      'The opening does not yet say what changes for the client if they say yes.',
      'Busy readers decide in the first few lines whether the rest is worth their time.',
      'This may reduce confidence and make the proposal easier to skip.',
      'Open with the client outcome, then briefly how you will get there.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The opening never states what changes for the client, so the rest of the document has no commercial hook.',
      'A clear value proposition helps budget holders champion the work.',
      'This can weaken executive communication and delay a first serious read.',
      'Rewrite the opening so the client benefit is explicit before process or price.',
    ),
    [COACH_MODE.SALES]: fields(
      'Buyers cannot yet see the payoff, so the commercial conversation starts later than it should.',
      'A sharp opening reduces buyer uncertainty and makes the offer easier to evaluate.',
      'This may slow approval because no one has a one-line case to take upstairs.',
      'Lead with the client result, then the proof that you can deliver it.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'The opening lacks an explicit outcome statement, so later sections have no success condition to satisfy.',
      'Value should be stated as a change in the client’s operating state, not as a list of activities.',
      'This can leave implementation unbounded relative to the promised result.',
      'State the target outcome and the boundary of the work that produces it.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Executives scanning for decision value will not find a sponsor-ready statement of benefit.',
      'Approval packets need a concise rationale that legal, finance, and delivery can all accept.',
      'This may introduce friction when the document is forwarded without a champion’s summary.',
      'Put a decision-ready outcome in the opening so downstream reviewers share the same brief.',
    ),
  },
  [FINDING_CODE.MISSING_DELIVERABLES]: {
    [COACH_MODE.BEGINNER]: fields(
      'Your deliverables are unclear, so the client may not know exactly what they are paying for.',
      'Clients need to understand exactly what they are receiving before evaluating the commercial offer.',
      'Scope may feel unclear and the client may hesitate to approve the proposal.',
      'Define the major deliverables in concrete, client-readable terms.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The deliverables require greater specificity so the commercial scope is unambiguous.',
      'Clients cannot clearly understand what is included in the engagement.',
      'This can create uncertainty about scope and weaken perceived professionalism.',
      'List the primary outputs as named items the client will actually receive.',
    ),
    [COACH_MODE.SALES]: fields(
      'Clear deliverables reduce buyer uncertainty and make the value of the offer easier to evaluate.',
      'A buyer who cannot see the package will struggle to compare you with alternatives.',
      'This may slow approval and invite extra clarification rounds.',
      'Name the main outputs in language a non-specialist can take into a buying meeting.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Define the deliverables as explicit outputs, including the relevant implementation or specification boundaries.',
      'Without named outputs, later pricing and timeline claims have nothing concrete to attach to.',
      'This can increase delivery risk because acceptance criteria remain implicit.',
      'Specify each output, and keep quantities or formats only when they already exist in the draft.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Scope ambiguity can introduce approval friction across procurement, legal, delivery, and stakeholder review.',
      'Named deliverables are what reviewers check against commercials, contracts, and handover.',
      'This may delay approval and create commercial ambiguity in later negotiation.',
      'Record the authorised outputs so pricing, exclusions, and acceptance can be aligned.',
    ),
  },
  [FINDING_CODE.MISSING_TIMELINE]: {
    [COACH_MODE.BEGINNER]: fields(
      'There is no clear schedule, so the client cannot tell how long the work will take.',
      'People need a simple sequence before they can plan around your work.',
      'This can create uncertainty about delivery expectations.',
      'Add a short sequence such as kickoff, production, and handover.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'No implementation timeline was found, so delivery expectations remain undefined.',
      'Unclear implementation expectations reduce buyer confidence.',
      'This may slow approval while the client asks when work starts and finishes.',
      'Provide dated or phased milestones the client can review.',
    ),
    [COACH_MODE.SALES]: fields(
      'Without a path to handover, buyers cannot judge interruption or time-to-value.',
      'A visible schedule makes the offer feel real and easier to approve.',
      'This may reduce confidence compared with proposals that show a path.',
      'Show a simple delivery path the buyer can walk a stakeholder through.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No milestone sequence was detected, so duration, dependencies, and acceptance windows are unspecified.',
      'Implementation clarity depends on named phases, not a promise to start soon.',
      'This can increase delivery risk and make resource planning impossible.',
      'Define phases with relative or existing dates; do not invent a calendar the draft never stated.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Operations and sponsors cannot place this engagement on a delivery calendar.',
      'Reviewers need a schedule they can reconcile with access, freeze periods, and handover.',
      'This may create approval friction with teams that must book time around the work.',
      'Publish a reviewable milestone path aligned with any duration already stated elsewhere.',
    ),
  },
  [FINDING_CODE.WEAK_SUMMARY]: {
    [COACH_MODE.BEGINNER]: fields(
      'The executive summary is thin, so it does not carry the value of the work.',
      'Most clients read the summary first and decide whether to keep going.',
      'This may reduce confidence in the rest of a stronger document.',
      'Strengthen the summary so it names the client, the outcome, and the path.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'A thin opening fails to carry the value of the work into the rest of the document.',
      'The summary should brief a decision-maker who may not read every section.',
      'This can weaken executive communication even when later sections are sound.',
      'Rewrite the summary to include outcome, approach, and commercial frame — without inventing facts.',
    ),
    [COACH_MODE.SALES]: fields(
      'The summary does not yet give a buyer a story they can retell internally.',
      'A stronger opening makes the rest of the offer easier to sell upstairs.',
      'This may slow approval because the first page does not do enough work.',
      'Use the summary to state the client result and why this offer is the path to it.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'The summary lacks sufficient decision content: outcome, boundary, and delivery frame.',
      'Downstream sections cannot be briefed from a summary that only describes activity.',
      'This can leave reviewers without an authoritative abstract of the engagement.',
      'Compress the known facts into a decision-grade abstract. Do not add new scope.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'The opening is not yet suitable as a forwarding brief for multi-party review.',
      'Sponsors need a summary that legal, finance, and delivery can all start from.',
      'This may introduce friction when the document is circulated without context.',
      'Make the summary an accurate brief of the authorised engagement.',
    ),
  },
  [FINDING_CODE.LONG_SUMMARY]: {
    [COACH_MODE.BEGINNER]: fields(
      'The opening is too long, so the main point is easy to miss.',
      'Busy readers need the decision in a short opening, not a full essay.',
      'This can weaken perceived professionalism and bury the ask.',
      'Shorten the summary to the outcome, the path, and the commercial frame.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'An overlong opening buries the decision a buyer needs to make.',
      'Executive readers scan; length without structure hides the offer.',
      'This may slow approval because the first page takes too long to parse.',
      'Edit the summary down. Keep facts; cut repetition and process detail.',
    ),
    [COACH_MODE.SALES]: fields(
      'A long opening loses the buyer before the value is clear.',
      'Shorter openings make the offer easier to evaluate in a first meeting.',
      'This may reduce confidence that you can communicate under time pressure.',
      'Lead with the client result, then one pass of proof — not a walkthrough of every section.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'The summary exceeds a useful abstract length, mixing brief and specification.',
      'Implementation detail belongs in later sections, not in the executive abstract.',
      'This can create uncertainty about which statements are binding.',
      'Keep the summary as an abstract; move detail to the owning sections.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'A long opening is hard to reuse as a decision brief across reviewers.',
      'Procurement and sponsors need a compact statement they can quote.',
      'This may create approval friction when reviewers disagree on the point of the document.',
      'Reduce the summary to the authorised outcome, path, and commercial frame.',
    ),
  },
  [FINDING_CODE.MISSING_PAYMENT_TERMS]: {
    [COACH_MODE.BEGINNER]: fields(
      'Payment terms are not clear, so finance may not know when money is due.',
      'Clients need a simple picture of deposits, invoices, and timing.',
      'This can create commercial ambiguity and slow approval.',
      'State when invoices happen and what they are tied to, using only terms you actually offer.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Finance cannot see when money moves, so approval stalls or terms get rewritten.',
      'Payment terms are part of commercial clarity, not fine print to add later.',
      'This may slow approval and invite negotiation friction.',
      'Add a short payment path that matches the rest of the commercial offer.',
    ),
    [COACH_MODE.SALES]: fields(
      'Unclear payment terms make a willing buyer pause before they can say yes.',
      'A clean commercial path reduces last-minute finance objections.',
      'This may delay the close even when the work itself is agreed.',
      'Make the payment sequence easy for a non-finance buyer to explain internally.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No payment schedule or trigger was found, so commercial execution is unspecified.',
      'Invoicing should attach to milestones, deposits, or dates that already exist in the draft.',
      'This can increase commercial and delivery risk when work starts without a billing path.',
      'Define payment events against existing milestones. Do not invent new commercial terms.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Accounts payable cannot process an offer that does not state how money moves.',
      'Legal and finance review expects deposit, invoice, and trigger language.',
      'This may create approval friction and later contract redlines.',
      'Record the authorised payment path so it can be checked against pricing and timeline.',
    ),
  },
  [FINDING_CODE.MISSING_WARRANTY]: {
    [COACH_MODE.BEGINNER]: fields(
      'There is no warranty or aftercare statement, so the client may worry about what happens after handover.',
      'A short assurance after completion makes the offer feel safer to approve.',
      'This can increase perceived delivery risk even when the work itself is sound.',
      'Add a brief warranty or support note that matches what you actually provide.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Delivery risk appears higher because post-completion assurances are absent.',
      'Warranty language tells the client how defects or questions are handled after close.',
      'This may reduce confidence and leave legal exposure unaddressed.',
      'State the post-completion cover you already offer. Do not invent a warranty period.',
    ),
    [COACH_MODE.SALES]: fields(
      'Buyers often ask “what if something is wrong after we sign?” — this draft does not answer yet.',
      'A clear aftercare line reduces last-mile hesitation.',
      'This may slow approval while the client asks for cover that could have been in the draft.',
      'Describe the real aftercare window in plain language.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No post-completion defect or support boundary was found.',
      'Warranty should define duration, what is covered, and what is excluded.',
      'This can increase delivery risk because remediation obligations are implicit.',
      'Specify cover against work already described. Do not extend duration beyond facts in the draft.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Legal and delivery cannot see residual obligation after handover.',
      'Enterprise review expects a stated defects window or an explicit “none provided”.',
      'This may create approval friction and later contract negotiation.',
      'Record the authorised warranty or aftercare position so it can be aligned with timeline.',
    ),
  },
  [FINDING_CODE.MISSING_EXCLUSIONS]: {
    [COACH_MODE.BEGINNER]: fields(
      'The proposal does not say what is not included, so the client may assume extra work is free.',
      'Clear exclusions protect both sides and make the price easier to trust.',
      'This can create uncertainty about scope and increase the chance of later disagreement.',
      'List the major items that are outside this engagement.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Scope boundaries are unclear, increasing the chance of disputes.',
      'Exclusions complete the commercial picture started by deliverables and pricing.',
      'This can create commercial ambiguity and delivery risk.',
      'State what is out of scope in client-readable terms, without inventing new project facts.',
    ),
    [COACH_MODE.SALES]: fields(
      'When exclusions are missing, buyers either assume too much or pad the price in their heads.',
      'Honest boundaries make the offer easier to evaluate and harder to unwind later.',
      'This may slow approval or invite negotiation over work you never meant to include.',
      'Name the obvious out-of-scope items a buyer would otherwise assume.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No exclusion or out-of-scope boundary was detected.',
      'Implementation boundaries belong in exclusions so deliverables stay finite.',
      'This can increase delivery risk when implied work appears during execution.',
      'Define excluded systems, locations, or services only when they are implied by the existing draft.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Legal and delivery cannot see the negative scope of the engagement.',
      'Procurement compares inclusions and exclusions before they approve a fee.',
      'This may create approval friction and later change-control disputes.',
      'Record authorised exclusions so they cannot overlap named deliverables.',
    ),
  },
  [FINDING_CODE.PRICING_TOO_EARLY]: {
    [COACH_MODE.BEGINNER]: fields(
      'The price appears before the client has a reason to value the work.',
      'People understand a number better after they see what they get.',
      'This may reduce confidence and make the fee feel disconnected from the offer.',
      'Move pricing after the summary, objectives, or deliverables.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The number arrives before the client has a reason to value the work.',
      'Commercials should follow the case for the work, not precede it.',
      'This can weaken commercial clarity and invite a price-first reading.',
      'Place pricing after the reader understands outcome and scope.',
    ),
    [COACH_MODE.SALES]: fields(
      'Leading with price invites comparison shopping before value is established.',
      'A later number is easier to defend in a buying conversation.',
      'This may slow approval or frame the deal as a cost discussion too early.',
      'Let the buyer see the package, then the investment.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Pricing is placed before the sections that define the outputs being priced.',
      'Readers cannot reconcile fee and scope if scope has not been stated yet.',
      'This can create commercial ambiguity about what the number covers.',
      'Keep pricing after the blocks that specify deliverables or approach.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers who land on price first will not have the briefing they need for governance.',
      'Enterprise packs usually present rationale, then commercials.',
      'This may introduce friction when finance reviews a number without a scope brief.',
      'Sequence pricing after the authorised description of work.',
    ),
  },
  [FINDING_CODE.LONG_PROPOSAL]: {
    [COACH_MODE.BEGINNER]: fields(
      'The proposal is long, which can make the decision feel harder than the work itself.',
      'Shorter, well-ordered documents are easier for clients to approve.',
      'This may slow approval as readers lose the thread.',
      'Tighten repetition and keep each section to the decision it supports.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Length without structure makes the decision harder than the work itself.',
      'A readable document signals professionalism as much as complete content does.',
      'This can weaken perceived professionalism and bury the ask.',
      'Cut duplication. Keep facts. Do not add new sections to compensate.',
    ),
    [COACH_MODE.SALES]: fields(
      'A long document is harder to champion in a short internal meeting.',
      'Buyers forward what they can summarise. Length works against that.',
      'This may reduce confidence that you can communicate with executives.',
      'Keep the spine: outcome, deliverables, path, price, terms.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Document length exceeds a useful decision pack, mixing specification and narrative.',
      'Reviewers cannot see which statements are binding versus explanatory.',
      'This can create uncertainty and slow technical sign-off.',
      'Keep specifications in their owning blocks; compress narrative elsewhere.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Long packs are harder to route through legal, finance, and delivery in parallel.',
      'Each reviewer needs to find their section without rereading the whole file.',
      'This may create approval friction and missed clauses.',
      'Preserve required sections; remove repetition that does not change the authorised offer.',
    ),
  },
  [FINDING_CODE.MISSING_CTA]: {
    [COACH_MODE.BEGINNER]: fields(
      'There is no clear next step, so a willing client may not know how to accept.',
      'Proposals should end with a simple action: sign, reply, or approve.',
      'This may slow approval even when the client likes the work.',
      'Add a short acceptance or signature step.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Without a clear acceptance step, a willing buyer has no obvious next action.',
      'The close of the document should tell the client how to proceed.',
      'This can create uncertainty and delay an otherwise ready yes.',
      'Add a signature or acceptance block with the next step you actually use.',
    ),
    [COACH_MODE.SALES]: fields(
      'The draft does not ask for the business, so momentum can stall after a good read.',
      'A visible close makes it easier for a champion to get a signature.',
      'This may slow the close and invite “we’ll come back to you”.',
      'End with the approval action you want the buyer to take.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'No acceptance or signature mechanism was found, so the offer has no execution step.',
      'Acceptance should bind the authorised scope, price, and dates.',
      'This can leave commercial execution incomplete.',
      'Provide a signature or acceptance block. Do not invent legal terms.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'The pack cannot be executed because it lacks a defined approval artefact.',
      'Governance expects a signature block or equivalent acceptance path.',
      'This may create approval friction when reviewers ask how the document becomes binding.',
      'Add the authorised acceptance step used by your company.',
    ),
  },
})

export const CONSISTENCY_KIND_COPY = Object.freeze({
  duration: {
    [COACH_MODE.BEGINNER]: fields(
      'Two sections give different project durations.',
      'Conflicting timelines can reduce client confidence and create uncertainty about delivery expectations.',
      'This can create uncertainty about when the work actually finishes.',
      'Choose the authoritative project duration and align the other section with it.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Two sections communicate different engagement lengths.',
      'Conflicting timelines can reduce client confidence and create uncertainty about delivery expectations.',
      'This may slow approval while the client asks which date is real.',
      'Pick one duration and update every section that states a length.',
    ),
    [COACH_MODE.SALES]: fields(
      'A buyer who sees two durations will not know which promise to take to their team.',
      'Aligned timing makes the offer easier to evaluate and defend.',
      'This may reduce confidence and invite extra clarification before a yes.',
      'Align every duration to the date you are prepared to stand behind.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Duration claims are not internally consistent across sections.',
      'Schedule, summary, and warranty must share one engagement length.',
      'This can increase delivery risk if the wrong figure is treated as binding.',
      'Select the source-of-truth duration and update dependent sections.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot reconcile calendar, summary, and commercial timing.',
      'Governance requires one authorised duration before the pack is forwarded.',
      'This may create approval friction across operations and legal.',
      'Authorise one duration and align the remaining sections to it.',
    ),
  },
  dates: {
    [COACH_MODE.BEGINNER]: fields(
      'The calendar dates do not match the stated project length.',
      'Clients need the dates and the duration to tell the same story.',
      'This can create uncertainty about delivery expectations.',
      'Update the dates or the stated duration so they agree.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The timeline span and the stated duration do not agree.',
      'Conflicting dates make the schedule hard to trust.',
      'This may slow approval and reduce confidence in delivery planning.',
      'Align calendar dates with the duration stated elsewhere.',
    ),
    [COACH_MODE.SALES]: fields(
      'Mismatched dates look like the plan was not checked before it was sent.',
      'A single, believable schedule makes the offer easier to approve.',
      'This may reduce confidence in an otherwise strong commercial story.',
      'Present one schedule the buyer can put on an internal calendar.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Date span and duration claims diverge beyond a reasonable tolerance.',
      'Implementation planning requires one coherent schedule model.',
      'This can increase delivery risk if kickoff and handover are misread.',
      'Reconcile date span with the duration claim. Do not invent new dates.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Operations cannot book resources against contradictory calendars.',
      'Reviewers will halt a pack that cannot state when work occurs.',
      'This may create approval friction across delivery and finance.',
      'Authorise one calendar and align narrative duration to it.',
    ),
  },
  scope: {
    [COACH_MODE.BEGINNER]: fields(
      'Different sections seem to describe different kinds of work.',
      'Clients should feel they are reading one proposal, not two.',
      'This can create uncertainty about what is actually being offered.',
      'Rewrite the mismatched sections so they describe the same engagement.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The opening and the deliverables do not describe the same kind of engagement.',
      'Scope mismatch makes the rest of the commercial offer hard to trust.',
      'This may reduce confidence and invite a full rewrite request.',
      'Align summary and deliverables to one authorised scope of work.',
    ),
    [COACH_MODE.SALES]: fields(
      'A buyer who sees two offers in one document will not know which to champion.',
      'A single story makes the value easier to evaluate.',
      'This may slow approval and weaken the commercial case.',
      'Keep every section inside the same offer you intend to sell.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Section families do not share a work type, so implementation boundaries conflict.',
      'Downstream pricing and timeline cannot be correct if scope identity is split.',
      'This can increase delivery risk and change-control volume.',
      'Reconcile work-type claims. Do not add a second engagement to paper over the gap.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot tell which statement of work is authorised.',
      'Legal and procurement need one engagement identity across the pack.',
      'This may create approval friction and contract uncertainty.',
      'Authorise one scope narrative and align remaining sections to it.',
    ),
  },
  currency: {
    [COACH_MODE.BEGINNER]: fields(
      'The proposal uses more than one currency, which can confuse pricing.',
      'Finance needs one currency to review the commercial offer.',
      'This can create commercial ambiguity and slow approval.',
      'Use one currency in pricing, terms, and totals.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Commercials switch currency mid-document.',
      'Mixed currencies stall finance review and make totals hard to trust.',
      'This may slow approval and invite negotiation friction.',
      'Standardise on a single currency already used in the draft.',
    ),
    [COACH_MODE.SALES]: fields(
      'A mixed-currency offer is harder for a buyer to take to finance.',
      'One currency makes the investment easier to evaluate.',
      'This may delay the close while numbers are rebuilt.',
      'Quote the fee in one currency throughout.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Currency tokens are not unique across commercial sections.',
      'Billing systems and contracts expect a single unit of account.',
      'This can create commercial ambiguity at invoice time.',
      'Pick the existing currency of record and remove the others.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Accounts payable cannot process mixed-currency proposal totals cleanly.',
      'Procurement and finance require one authorised currency.',
      'This may create approval friction and later invoice disputes.',
      'Authorise one currency and align pricing and terms to it.',
    ),
  },
  quantity: {
    [COACH_MODE.BEGINNER]: fields(
      'Two sections give different quantities for the same kind of item.',
      'Clients need counts to match so they know what they are buying.',
      'This can create uncertainty and commercial ambiguity.',
      'Use the same quantity in both sections.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Named quantities do not agree across sections.',
      'Conflicting counts make deliverables and summary hard to trust together.',
      'This may slow approval and increase delivery risk.',
      'Align quantities to the figure you intend to deliver.',
    ),
    [COACH_MODE.SALES]: fields(
      'Mismatched counts look like the offer was not checked.',
      'A single quantity story is easier for a buyer to defend.',
      'This may reduce confidence in the rest of the commercial pack.',
      'Present one count the buyer can take into a meeting.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Unit quantities diverge between sections that should share a count.',
      'Implementation and pricing cannot both be correct if counts conflict.',
      'This can increase delivery risk and change requests.',
      'Select the source-of-truth quantity. Do not invent a new count.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot reconcile billable quantities across the pack.',
      'Governance expects one authorised count per unit type.',
      'This may create approval friction and later commercial disputes.',
      'Authorise one quantity and align remaining sections.',
    ),
  },
  pricing: {
    [COACH_MODE.BEGINNER]: fields(
      'Pricing and deliverables do not tell the same story about what is included.',
      'Clients should see the same items in the list of work and in the price.',
      'This can create commercial ambiguity and hesitation.',
      'Align priced lines with the deliverable list, or remove items that are not sold.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Pricing claims inclusion that the deliverable list does not fully support.',
      'Commercials and outputs must describe the same package.',
      'This may slow approval and invite negotiation over missing lines.',
      'Reconcile priced items with named deliverables.',
    ),
    [COACH_MODE.SALES]: fields(
      'A buyer who cannot match the fee to the package will not feel safe saying yes.',
      'Clear mapping from output to price makes value easier to evaluate.',
      'This may reduce confidence and delay the close.',
      'Make every priced promise visible in deliverables, and vice versa.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Inclusion language in pricing is not traceable to named outputs.',
      'Acceptance and invoicing need a 1:1 map from deliverable to commercial line.',
      'This can increase delivery and billing risk.',
      'Align identifiers between deliverables and pricing. Do not add unstated products.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Procurement cannot verify that the fee covers the stated statement of work.',
      'Finance and legal expect traceability from output to commercial line.',
      'This may create approval friction and contract uncertainty.',
      'Authorise one package and reflect it in both deliverables and pricing.',
    ),
  },
  exclusion: {
    [COACH_MODE.BEGINNER]: fields(
      'Something appears as both included and excluded.',
      'Clients need a clean line between what is in and what is out.',
      'This can create uncertainty and later disagreement.',
      'Keep the item in deliverables or in exclusions, not both.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'The same item is present in deliverables and in exclusions.',
      'Scope that is both in and out of the engagement is a dispute waiting to happen.',
      'This may reduce confidence and increase delivery risk.',
      'Choose the authorised treatment and remove the conflicting mention.',
    ),
    [COACH_MODE.SALES]: fields(
      'A buyer who sees an item included and excluded will not know what they are purchasing.',
      'Clean boundaries make the offer easier to evaluate.',
      'This may slow approval and invite extra legal review.',
      'Present one clear in-or-out decision for the overlapping item.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Deliverable identifiers overlap exclusion language.',
      'Implementation cannot both produce and omit the same output.',
      'This can increase change-control and acceptance risk.',
      'Remove the contradiction. Do not invent a third category of work.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Legal cannot approve a pack that both commits to and disclaims the same item.',
      'Governance requires a single authorised scope treatment.',
      'This may create approval friction and later disputes.',
      'Authorise inclusion or exclusion, then align both sections.',
    ),
  },
  warranty: {
    [COACH_MODE.BEGINNER]: fields(
      'The warranty period does not fit the project timeline as written.',
      'Aftercare should make sense next to the delivery schedule.',
      'This can create uncertainty about what happens after handover.',
      'Correct the warranty window or the project duration so they fit together.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Warranty language uses a duration that does not fit the stated timeline.',
      'Post-completion cover must be reconcilable with the engagement length.',
      'This may reduce confidence and leave legal exposure unclear.',
      'Align warranty duration with the project duration already in the draft.',
    ),
    [COACH_MODE.SALES]: fields(
      'A warranty that does not match the schedule is a question a buyer will raise.',
      'Consistent aftercare language makes the close cleaner.',
      'This may slow approval while cover is clarified.',
      'State cover that matches the delivery story you are selling.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Warranty duration exceeds or conflicts with the implementation timeline model.',
      'Defect windows should be defined relative to handover, not an unrelated span.',
      'This can increase residual obligation risk.',
      'Reconcile warranty duration with timeline. Do not invent a new cover period.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Legal cannot reconcile residual obligation with the delivery calendar.',
      'Enterprise review expects warranty and timeline to be jointly authorised.',
      'This may create approval friction and contract redlines.',
      'Authorise one duration model and align warranty language to it.',
    ),
  },
  missing_ref: {
    [COACH_MODE.BEGINNER]: fields(
      'One section refers to another section that has no content yet.',
      'Clients should not be sent looking for information that is not there.',
      'This can create uncertainty and make the document feel unfinished.',
      'Add the missing section or remove the reference.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'A section points to information that is not present in the draft.',
      'Broken internal references reduce professionalism and trust.',
      'This may slow approval while the client hunts for missing detail.',
      'Supply the referenced content or delete the pointer.',
    ),
    [COACH_MODE.SALES]: fields(
      'A dangling reference looks like the pack was sent before it was finished.',
      'Complete references make the offer easier to take internally.',
      'This may reduce confidence in an otherwise strong story.',
      'Either fill the referenced section or stop pointing to it.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'An internal reference has no resolving content in the target section.',
      'Reviewers cannot validate a claim that has no backing block.',
      'This can create implementation ambiguity.',
      'Resolve the reference with existing facts, or remove it.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot follow a citation to an empty section.',
      'Governance packs should be internally complete before circulation.',
      'This may create approval friction and extra clarification cycles.',
      'Authorise the missing content or remove the reference.',
    ),
  },
  duplicate: {
    [COACH_MODE.BEGINNER]: fields(
      'The same item appears more than once in a list.',
      'Duplicates make the document harder to read and easier to mis-count.',
      'This can weaken perceived professionalism.',
      'Remove the duplicate entry.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'A section lists the same item more than once.',
      'Duplicates create commercial and delivery ambiguity about quantity.',
      'This may create uncertainty about what is actually included.',
      'Keep a single authoritative entry.',
    ),
    [COACH_MODE.SALES]: fields(
      'Repeated lines make the offer look unchecked.',
      'A clean list is easier for a buyer to evaluate.',
      'This may reduce confidence in the rest of the pack.',
      'Deduplicate so the buyer sees one list of commitments.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Duplicate identifiers appear in a single section.',
      'Counts and acceptance tests cannot treat two identical rows as distinct outputs.',
      'This can increase delivery and billing risk.',
      'Collapse to one row. Do not invent a distinguishing fact.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot tell whether a duplicate is a second commitment or a copy error.',
      'Authorised lists should be unique before legal review.',
      'This may create approval friction over quantities.',
      'Keep one authorised entry and remove the duplicate.',
    ),
  },
  generic: {
    [COACH_MODE.BEGINNER]: fields(
      'Two sections do not agree with each other.',
      'Clients need the document to tell one consistent story.',
      'This can reduce confidence and create uncertainty.',
      'Align the sections so they describe the same engagement.',
    ),
    [COACH_MODE.PROFESSIONAL]: fields(
      'Cross-section claims are not consistent.',
      'Internal contradictions make the commercial offer harder to trust.',
      'This may slow approval and weaken perceived professionalism.',
      'Choose the authoritative statement and align the other section.',
    ),
    [COACH_MODE.SALES]: fields(
      'A contradiction gives a buyer a reason to pause.',
      'One consistent story is easier to evaluate and champion.',
      'This may reduce confidence before the commercial case is heard.',
      'Reconcile the conflicting sections before the next send.',
    ),
    [COACH_MODE.TECHNICAL]: fields(
      'Independent section claims cannot be satisfied at once.',
      'Implementation and acceptance require a single consistent model.',
      'This can increase delivery risk.',
      'Select the source of truth and update dependents. Do not invent new facts.',
    ),
    [COACH_MODE.ENTERPRISE]: fields(
      'Reviewers cannot authorise a pack with unresolved internal conflict.',
      'Governance requires one statement of record per claim type.',
      'This may create approval friction across legal, delivery, and finance.',
      'Authorise one claim and align remaining sections.',
    ),
  },
})

export function resolveCoachMode(mode) {
  const value = String(mode ?? '').trim()
  return COACH_MODES.includes(value) ? value : COACH_MODE.PROFESSIONAL
}

export function modeFields(pack, mode) {
  const resolved = resolveCoachMode(mode)
  if (!pack || typeof pack !== 'object') return null
  return pack[resolved] ?? pack[COACH_MODE.PROFESSIONAL] ?? null
}
