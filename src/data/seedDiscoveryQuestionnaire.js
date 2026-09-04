import {
  FORM_KIND,
  makeQuestion,
  makeQuestionnaire,
  QUESTION_TYPE,
  VISIBILITY_OPERATOR,
} from '../models/questionnaire.js'

/**
 * Discovery form for the Brand Identity template. Question ids are stable so
 * visibility rules can point at each other in seed data. Cloning onto a
 * proposal regenerates those ids.
 */
export function seedBrandDiscoveryQuestionnaire() {
  return makeQuestionnaire({
    id: 'qn-tpl-2001',
    templateId: 'tpl-2001',
    kind: FORM_KIND.DISCOVERY,
    title: 'Brand discovery',
    description:
      'A short brief so the studio can lock scope before kickoff. You can save and return later.',
    frozen: false,
    questions: [
      makeQuestion({
        id: 'q-2001-company',
        type: QUESTION_TYPE.SHORT_TEXT,
        title: 'Company name',
        required: true,
        sectionTitle: 'About the brand',
        helperText: 'The name that should appear on the identity and guidelines.',
        internalNotes: 'Maps to cover and brand guideline title.',
      }),
      makeQuestion({
        id: 'q-2001-email',
        type: QUESTION_TYPE.EMAIL,
        title: 'Primary contact email',
        required: true,
        helperText: 'We will use this for reviews and file delivery.',
      }),
      makeQuestion({
        id: 'q-2001-phone',
        type: QUESTION_TYPE.PHONE,
        title: 'Phone number',
        helperText: 'Optional. Include the country code if you have one.',
      }),
      makeQuestion({
        id: 'q-2001-url',
        type: QUESTION_TYPE.URL,
        title: 'Current website',
        helperText: 'Leave blank if there is no site yet.',
      }),
      makeQuestion({
        id: 'q-2001-goals',
        type: QUESTION_TYPE.LONG_TEXT,
        title: 'What should this identity achieve?',
        required: true,
        sectionTitle: 'Direction',
        helperText: 'Audience, competitors, and the feeling the brand should leave.',
        internalNotes: 'Feed this into the discovery workshop agenda.',
      }),
      makeQuestion({
        id: 'q-2001-industry',
        type: QUESTION_TYPE.DROPDOWN,
        title: 'Industry',
        options: [
          { id: 'opt-2001-ind-1', label: 'Professional services', value: 'services' },
          { id: 'opt-2001-ind-2', label: 'Product / retail', value: 'product' },
          { id: 'opt-2001-ind-3', label: 'Hospitality', value: 'hospitality' },
          { id: 'opt-2001-ind-4', label: 'Technology', value: 'technology' },
          { id: 'opt-2001-ind-5', label: 'Other', value: 'other' },
        ],
      }),
      makeQuestion({
        id: 'q-2001-timeline',
        type: QUESTION_TYPE.MULTIPLE_CHOICE,
        title: 'Preferred timeline',
        required: true,
        options: [
          { id: 'opt-2001-time-1', label: 'As soon as possible', value: 'asap' },
          { id: 'opt-2001-time-2', label: 'Within six weeks', value: 'six_weeks' },
          { id: 'opt-2001-time-3', label: 'Flexible', value: 'flexible' },
        ],
      }),
      makeQuestion({
        id: 'q-2001-deliverables',
        type: QUESTION_TYPE.CHECKBOXES,
        title: 'Deliverables you need',
        helperText: 'Select everything that should be in scope.',
        options: [
          { id: 'opt-2001-del-1', label: 'Primary mark', value: 'mark' },
          { id: 'opt-2001-del-2', label: 'Wordmark', value: 'wordmark' },
          { id: 'opt-2001-del-3', label: 'Colour system', value: 'colour' },
          { id: 'opt-2001-del-4', label: 'Type pairing', value: 'type' },
          { id: 'opt-2001-del-5', label: 'Brand guidelines', value: 'guidelines' },
        ],
      }),
      makeQuestion({
        id: 'q-2001-existing',
        type: QUESTION_TYPE.YES_NO,
        title: 'Do you have an existing logo?',
        required: true,
        sectionTitle: 'Existing assets',
        internalNotes: 'If yes, ask for files before the workshop.',
      }),
      makeQuestion({
        id: 'q-2001-logo',
        type: QUESTION_TYPE.IMAGE_UPLOAD,
        title: 'Current logo',
        helperText: 'PNG or SVG preferred.',
        visibility: {
          enabled: true,
          questionId: 'q-2001-existing',
          operator: VISIBILITY_OPERATOR.EQUALS,
          value: 'yes',
        },
      }),
      makeQuestion({
        id: 'q-2001-files',
        type: QUESTION_TYPE.FILE_UPLOAD,
        title: 'Other brand assets',
        helperText: 'Guidelines, fonts, photography, or previous proposals.',
      }),
      makeQuestion({
        id: 'q-2001-clarity',
        type: QUESTION_TYPE.RATING,
        title: 'How clear is the current brand?',
        helperText: '1 is unclear, 5 is already distinctive.',
        ratingMax: 5,
      }),
      makeQuestion({
        id: 'q-2001-kickoff',
        type: QUESTION_TYPE.DATE,
        title: 'Ideal kickoff date',
        sectionTitle: 'Practicalities',
      }),
      makeQuestion({
        id: 'q-2001-budget',
        type: QUESTION_TYPE.NUMBER,
        title: 'Approximate budget (USD)',
        helperText: 'A range is fine. This is not a quote.',
      }),
      makeQuestion({
        id: 'q-2001-colour',
        type: QUESTION_TYPE.COLOUR,
        title: 'A colour you already associate with the brand',
      }),
      makeQuestion({
        id: 'q-2001-notes',
        type: QUESTION_TYPE.RICH_TEXT,
        title: 'Anything else we should know?',
        helperText: 'Links, references, or constraints.',
      }),
    ],
  })
}
