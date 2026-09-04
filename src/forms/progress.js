import { isAnswered, responsesByQuestionId } from '../models/questionnaire.js'
import { listVisibleQuestions } from './visibility.js'

export function questionnaireProgress(questionnaire) {
  const byId = responsesByQuestionId(questionnaire)
  const visible = listVisibleQuestions(questionnaire, byId)
  const required = visible.filter((question) => question.required)
  const requiredAnswered = required.filter((question) =>
    isAnswered(question, byId[question.id]?.value),
  )
  const answered = visible.filter((question) =>
    isAnswered(question, byId[question.id]?.value),
  )

  const total = visible.length
  const percent = total === 0 ? 0 : Math.round((answered.length / total) * 100)

  return {
    total,
    answered: answered.length,
    required: required.length,
    requiredAnswered: requiredAnswered.length,
    percent,
    complete: required.length === 0 || requiredAnswered.length === required.length,
  }
}
