import { EMAIL_PATTERN } from '../models/ids.js'
import {
  isAnswered,
  QUESTION_TYPE,
  responsesByQuestionId,
} from '../models/questionnaire.js'
import { listVisibleQuestions } from './visibility.js'

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim())
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * @returns {{ questionId: string, message: string }[]}
 */
export function validateQuestionnaire(questionnaire) {
  const byId = responsesByQuestionId(questionnaire)
  const visible = listVisibleQuestions(questionnaire, byId)
  const errors = []

  for (const question of visible) {
    const value = byId[question.id]?.value
    const filled = isAnswered(question, value)

    if (question.required && !filled) {
      errors.push({
        questionId: question.id,
        message: 'This question is required.',
      })
      continue
    }

    if (!filled) continue

    if (question.type === QUESTION_TYPE.EMAIL && !isValidEmail(value)) {
      errors.push({ questionId: question.id, message: 'Enter a valid email.' })
    }

    if (question.type === QUESTION_TYPE.URL && !isValidUrl(value)) {
      errors.push({ questionId: question.id, message: 'Enter a valid URL.' })
    }

    if (
      question.type === QUESTION_TYPE.NUMBER &&
      value !== '' &&
      Number.isNaN(Number(value))
    ) {
      errors.push({ questionId: question.id, message: 'Enter a number.' })
    }
  }

  return errors
}
