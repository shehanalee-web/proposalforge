import { COACH_SECTION } from './types.js'

const NOTE =
  'Generic example only. Do not copy these details into the proposal unless they are already true.'

function example(weak, better) {
  return { weak, better, note: NOTE }
}

/**
 * Safe educational examples. These never describe the live proposal.
 */
export const SECTION_EXAMPLES = Object.freeze({
  [COACH_SECTION.SUMMARY]: example(
    'We will complete the work quickly and to a high standard.',
    'This engagement delivers a defined outcome for the client, with a clear path from kickoff to handover.',
  ),
  [COACH_SECTION.OBJECTIVES]: example(
    'The goal is to help the client succeed.',
    'The client needs a named outcome — for example, a launch-ready identity system the team can apply without further interpretation.',
  ),
  [COACH_SECTION.SCOPE]: example(
    'We will handle whatever comes up during the project.',
    'The engagement covers the named work only. Adjacent systems, locations, or services are out of scope unless added in writing.',
  ),
  [COACH_SECTION.DELIVERABLES]: example(
    'Work will be completed quickly.',
    'Implementation will be completed within four weeks of approved kickoff.',
  ),
  [COACH_SECTION.TIMELINE]: example(
    'The project will move fast once we start.',
    'Week 1 kickoff and discovery. Weeks 2–4 production and review. Week 5 handover.',
  ),
  [COACH_SECTION.PRICING]: example(
    'Pricing is competitive and can be discussed.',
    'Fixed fee stated after the scope, with the same items the deliverables list names.',
  ),
  [COACH_SECTION.ASSUMPTIONS]: example(
    'We assume everything we need will be available.',
    'The client provides access, feedback, and source files within the review windows named in the timeline.',
  ),
  [COACH_SECTION.EXCLUSIONS]: example(
    'Anything not listed might still be included.',
    'Hosting, third-party licences, and work outside the named locations are not included.',
  ),
  [COACH_SECTION.WARRANTY]: example(
    'We stand behind our work.',
    'Defects in the delivered work are reviewed for 30 days after handover. New scope is a separate change.',
  ),
  [COACH_SECTION.TERMS]: example(
    'Standard terms apply.',
    'Work begins on a named deposit. Remaining invoices follow the milestones already in the proposal.',
  ),
  [COACH_SECTION.ACCEPTANCE]: example(
    'Let us know if you would like to go ahead.',
    'Approve by signing this proposal. Work starts after the named kickoff conditions are met.',
  ),
  [COACH_SECTION.SIGNATURE]: example(
    'We can start when you are ready.',
    'Sign below to accept the scope, fee, and dates in this document.',
  ),
})

export function exampleFor(section) {
  return SECTION_EXAMPLES[section] ?? SECTION_EXAMPLES[COACH_SECTION.SUMMARY]
}

export function formatGoodExample(section) {
  const item = exampleFor(section)
  return `${item.note} Weak: “${item.weak}” Better: “${item.better}”`
}
