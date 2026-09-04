import { createRecordId } from './ids.js'

/**
 * Reusable form engine.
 *
 * Discovery questionnaires are the first consumer. The same schema is meant
 * for onboarding, briefs, feedback, surveys, design approvals and change
 * requests without forking models.
 */

export const FORM_KIND = Object.freeze({
  DISCOVERY: 'discovery',
  ONBOARDING: 'onboarding',
  BRIEF: 'brief',
  FEEDBACK: 'feedback',
  SURVEY: 'survey',
  APPROVAL: 'approval',
  CHANGE_REQUEST: 'change_request',
})

export const FORM_KINDS = Object.freeze(Object.values(FORM_KIND))

export const FORM_KIND_LABELS = Object.freeze({
  [FORM_KIND.DISCOVERY]: 'Discovery questionnaire',
  [FORM_KIND.ONBOARDING]: 'Client onboarding',
  [FORM_KIND.BRIEF]: 'Project brief',
  [FORM_KIND.FEEDBACK]: 'Feedback form',
  [FORM_KIND.SURVEY]: 'Survey',
  [FORM_KIND.APPROVAL]: 'Design approval',
  [FORM_KIND.CHANGE_REQUEST]: 'Change request',
})

export const QUESTIONNAIRE_STATUS = Object.freeze({
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
})

export const QUESTIONNAIRE_STATUSES = Object.freeze(
  Object.values(QUESTIONNAIRE_STATUS),
)

export const QUESTION_TYPE = Object.freeze({
  SHORT_TEXT: 'short_text',
  LONG_TEXT: 'long_text',
  EMAIL: 'email',
  PHONE: 'phone',
  NUMBER: 'number',
  DATE: 'date',
  DROPDOWN: 'dropdown',
  MULTIPLE_CHOICE: 'multiple_choice',
  CHECKBOXES: 'checkboxes',
  YES_NO: 'yes_no',
  RATING: 'rating',
  FILE_UPLOAD: 'file_upload',
  IMAGE_UPLOAD: 'image_upload',
  URL: 'url',
  COLOUR: 'colour',
  RICH_TEXT: 'rich_text',
})

export const QUESTION_TYPES = Object.freeze(Object.values(QUESTION_TYPE))

export const QUESTION_TYPE_LABELS = Object.freeze({
  [QUESTION_TYPE.SHORT_TEXT]: 'Short text',
  [QUESTION_TYPE.LONG_TEXT]: 'Long text',
  [QUESTION_TYPE.EMAIL]: 'Email',
  [QUESTION_TYPE.PHONE]: 'Phone',
  [QUESTION_TYPE.NUMBER]: 'Number',
  [QUESTION_TYPE.DATE]: 'Date',
  [QUESTION_TYPE.DROPDOWN]: 'Dropdown',
  [QUESTION_TYPE.MULTIPLE_CHOICE]: 'Multiple choice',
  [QUESTION_TYPE.CHECKBOXES]: 'Checkboxes',
  [QUESTION_TYPE.YES_NO]: 'Yes / No',
  [QUESTION_TYPE.RATING]: 'Rating',
  [QUESTION_TYPE.FILE_UPLOAD]: 'File upload',
  [QUESTION_TYPE.IMAGE_UPLOAD]: 'Image upload',
  [QUESTION_TYPE.URL]: 'URL',
  [QUESTION_TYPE.COLOUR]: 'Colour',
  [QUESTION_TYPE.RICH_TEXT]: 'Rich text',
})

export const VISIBILITY_OPERATOR = Object.freeze({
  ANSWERED: 'answered',
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
})

export const VISIBILITY_OPERATORS = Object.freeze(
  Object.values(VISIBILITY_OPERATOR),
)

export const VISIBILITY_OPERATOR_LABELS = Object.freeze({
  [VISIBILITY_OPERATOR.ANSWERED]: 'Has an answer',
  [VISIBILITY_OPERATOR.EQUALS]: 'Equals',
  [VISIBILITY_OPERATOR.NOT_EQUALS]: 'Does not equal',
  [VISIBILITY_OPERATOR.CONTAINS]: 'Contains',
})

const CHOICE_TYPES = new Set([
  QUESTION_TYPE.DROPDOWN,
  QUESTION_TYPE.MULTIPLE_CHOICE,
  QUESTION_TYPE.CHECKBOXES,
])

const FILE_TYPES = new Set([
  QUESTION_TYPE.FILE_UPLOAD,
  QUESTION_TYPE.IMAGE_UPLOAD,
])

/**
 * @param {Partial<{ id: string, name: string, url: string, mime: string, size: number, createdAt: string }>} [input]
 */
export function makeUploadedFile(input = {}) {
  return {
    id: input.id ?? createRecordId('file'),
    name: input.name ?? 'Untitled',
    url: input.url ?? '',
    mime: input.mime ?? '',
    size: Number(input.size ?? 0) || 0,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

/**
 * @param {Partial<{ id: string, label: string, value: string }>} [input]
 */
export function makeQuestionOption(input = {}) {
  const label = input.label ?? 'Option'
  return {
    id: input.id ?? createRecordId('opt'),
    label,
    value: input.value ?? label,
  }
}

/**
 * @param {Partial<{ enabled: boolean, questionId: string | null, operator: string, value: string }>} [input]
 */
export function makeVisibilityRule(input = {}) {
  return {
    enabled: Boolean(input.enabled),
    questionId: input.questionId ?? null,
    operator: VISIBILITY_OPERATORS.includes(input.operator)
      ? input.operator
      : VISIBILITY_OPERATOR.EQUALS,
    value: input.value ?? '',
  }
}

function defaultValueForType(type, value) {
  if (value == null) {
    if (type === QUESTION_TYPE.CHECKBOXES) return []
    if (FILE_TYPES.has(type)) return []
    if (type === QUESTION_TYPE.RATING) return 0
    if (type === QUESTION_TYPE.NUMBER) return ''
    return ''
  }
  if (type === QUESTION_TYPE.CHECKBOXES) {
    return Array.isArray(value) ? value.map(String) : []
  }
  if (FILE_TYPES.has(type)) {
    return Array.isArray(value) ? value.map((file) => makeUploadedFile(file)) : []
  }
  if (type === QUESTION_TYPE.RATING) return Number(value) || 0
  return value
}

/**
 * @param {Partial<object>} [input]
 */
export function makeQuestion(input = {}) {
  const type = QUESTION_TYPES.includes(input.type)
    ? input.type
    : QUESTION_TYPE.SHORT_TEXT
  const options = CHOICE_TYPES.has(type)
    ? (input.options ?? [{ label: 'Option 1' }, { label: 'Option 2' }]).map(
        makeQuestionOption,
      )
    : []

  return {
    id: input.id ?? createRecordId('q'),
    type,
    title: input.title ?? '',
    helperText: input.helperText ?? '',
    required: Boolean(input.required),
    sectionTitle: input.sectionTitle ?? '',
    defaultValue: defaultValueForType(type, input.defaultValue),
    internalNotes: input.internalNotes ?? '',
    options,
    visibility: makeVisibilityRule(input.visibility),
    ratingMax: Number(input.ratingMax) > 0 ? Number(input.ratingMax) : 5,
  }
}

/**
 * @param {Partial<{ id: string, questionId: string, value: unknown, updatedAt: string }>} [input]
 */
export function makeClientResponse(input = {}) {
  return {
    id: input.id ?? createRecordId('rsp'),
    questionId: input.questionId ?? '',
    value: input.value ?? '',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * @param {Partial<object>} [input]
 * @returns {object} ProposalQuestionnaire
 */
export function makeQuestionnaire(input = {}) {
  const timestamp = new Date().toISOString()
  const kind = FORM_KINDS.includes(input.kind) ? input.kind : FORM_KIND.DISCOVERY
  const status = QUESTIONNAIRE_STATUSES.includes(input.status)
    ? input.status
    : QUESTIONNAIRE_STATUS.DRAFT
  const questions = (input.questions ?? []).map(makeQuestion)

  return {
    id: input.id ?? createRecordId('qn'),
    proposalId: input.proposalId ?? null,
    templateId: input.templateId ?? null,
    kind,
    title: input.title ?? FORM_KIND_LABELS[kind],
    description: input.description ?? '',
    questions,
    responses: (input.responses ?? []).map(makeClientResponse),
    status,
    submittedAt: input.submittedAt ?? null,
    frozen: Boolean(input.frozen),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

export function isChoiceType(type) {
  return CHOICE_TYPES.has(type)
}

export function isFileType(type) {
  return FILE_TYPES.has(type)
}

function remapId(sourceId, map, prefix) {
  if (map.has(sourceId)) return map.get(sourceId)
  const next = createRecordId(prefix)
  map.set(sourceId, next)
  return next
}

function cloneQuestions(questions, questionMap, optionMap) {
  return (questions ?? []).map((question) => {
    const nextId = remapId(question.id, questionMap, 'q')
    return makeQuestion({
      ...question,
      id: nextId,
      options: (question.options ?? []).map((option) => {
        const optionId = remapId(option.id, optionMap, 'opt')
        return makeQuestionOption({ ...option, id: optionId })
      }),
      visibility: makeVisibilityRule({
        ...question.visibility,
        questionId: question.visibility?.questionId
          ? remapId(question.visibility.questionId, questionMap, 'q')
          : null,
      }),
    })
  })
}

/**
 * Copy a template questionnaire into a new template record.
 */
export function cloneQuestionnaireForTemplate(source, extras = {}) {
  const form = makeQuestionnaire(source ?? {})
  const questionMap = new Map()
  const optionMap = new Map()
  return makeQuestionnaire({
    ...form,
    id: createRecordId('qn'),
    proposalId: null,
    templateId: extras.templateId ?? null,
    frozen: false,
    status: QUESTIONNAIRE_STATUS.DRAFT,
    submittedAt: null,
    responses: [],
    questions: cloneQuestions(form.questions, questionMap, optionMap),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

function responsesFromDefaults(questions) {
  return questions
    .filter((question) => {
      const value = question.defaultValue
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'number') return value > 0
      return String(value ?? '').trim() !== ''
    })
    .map((question) =>
      makeClientResponse({
        questionId: question.id,
        value: question.defaultValue,
      }),
    )
}

/**
 * Deep-copy a template questionnaire onto a proposal. New IDs, empty or
 * default responses, frozen so later template edits cannot reach it.
 */
export function cloneQuestionnaireForProposal(source, extras = {}) {
  const form = makeQuestionnaire(source ?? {})
  const questionMap = new Map()
  const optionMap = new Map()
  const questions = cloneQuestions(form.questions, questionMap, optionMap)
  return makeQuestionnaire({
    ...form,
    id: createRecordId('qn'),
    proposalId: extras.proposalId ?? null,
    templateId: extras.templateId ?? form.templateId ?? null,
    frozen: true,
    status: QUESTIONNAIRE_STATUS.DRAFT,
    submittedAt: null,
    questions,
    responses: responsesFromDefaults(questions),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export function responsesByQuestionId(questionnaire) {
  const map = {}
  for (const response of questionnaire?.responses ?? []) {
    if (response.questionId) map[response.questionId] = response
  }
  return map
}

export function answerValue(response) {
  if (!response) return ''
  return response.value
}

export function isAnswered(question, value) {
  if (value == null || value === '') return false
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim() !== ''
}

export function upsertResponse(questionnaire, questionId, value) {
  const existing = (questionnaire.responses ?? []).find(
    (item) => item.questionId === questionId,
  )
  const next = makeClientResponse({
    id: existing?.id,
    questionId,
    value,
  })
  const rest = (questionnaire.responses ?? []).filter(
    (item) => item.questionId !== questionId,
  )
  return makeQuestionnaire({
    ...questionnaire,
    responses: [...rest, next],
    status:
      questionnaire.status === QUESTIONNAIRE_STATUS.SUBMITTED
        ? questionnaire.status
        : QUESTIONNAIRE_STATUS.IN_PROGRESS,
    updatedAt: new Date().toISOString(),
  })
}

export function isQuestionnaireSubmitted(questionnaire) {
  return questionnaire?.status === QUESTIONNAIRE_STATUS.SUBMITTED
}

export function hasQuestionnaire(questionnaire) {
  return Boolean(questionnaire?.questions?.length)
}

export function duplicateQuestion(question) {
  return makeQuestion({
    ...question,
    id: undefined,
    title: question.title ? `${question.title} (copy)` : '',
    options: (question.options ?? []).map((option) =>
      makeQuestionOption({ ...option, id: undefined }),
    ),
  })
}

export function moveQuestion(questions, index, offset) {
  const nextIndex = index + offset
  if (nextIndex < 0 || nextIndex >= questions.length) return questions
  const copy = [...questions]
  const [item] = copy.splice(index, 1)
  copy.splice(nextIndex, 0, item)
  return copy
}
