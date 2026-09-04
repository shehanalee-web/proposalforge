import { VISIBILITY_OPERATOR } from '../models/questionnaire.js'

function asText(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

/**
 * Evaluate a stored visibility rule. The builder persists the rule now so
 * later workflows can reuse it without a schema change.
 */
export function isQuestionVisible(question, responsesById = {}) {
  const rule = question?.visibility
  if (!rule?.enabled || !rule.questionId) return true

  const answer = responsesById[rule.questionId]?.value
  const text = asText(answer)

  switch (rule.operator) {
    case VISIBILITY_OPERATOR.ANSWERED:
      return text.trim() !== ''
    case VISIBILITY_OPERATOR.EQUALS:
      return text === String(rule.value ?? '')
    case VISIBILITY_OPERATOR.NOT_EQUALS:
      return text !== String(rule.value ?? '')
    case VISIBILITY_OPERATOR.CONTAINS:
      return text.toLowerCase().includes(String(rule.value ?? '').toLowerCase())
    default:
      return true
  }
}

export function listVisibleQuestions(questionnaire, responsesById) {
  return (questionnaire?.questions ?? []).filter((question) =>
    isQuestionVisible(question, responsesById),
  )
}
