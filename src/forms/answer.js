import {
  isAnswered,
  isFileType,
  QUESTION_TYPE,
} from '../models/questionnaire.js'

export function formatAnswer(question, value) {
  if (!isAnswered(question, value)) return '—'

  if (question.type === QUESTION_TYPE.YES_NO) {
    return value === 'yes' ? 'Yes' : 'No'
  }

  if (question.type === QUESTION_TYPE.RATING) {
    return `${value} / ${question.ratingMax ?? 5}`
  }

  if (question.type === QUESTION_TYPE.CHECKBOXES) {
    const labels = new Map(
      (question.options ?? []).map((option) => [option.value, option.label]),
    )
    return value.map((entry) => labels.get(entry) ?? entry).join(', ')
  }

  if (
    question.type === QUESTION_TYPE.DROPDOWN ||
    question.type === QUESTION_TYPE.MULTIPLE_CHOICE
  ) {
    const match = (question.options ?? []).find((option) => option.value === value)
    return match?.label ?? String(value)
  }

  if (isFileType(question.type)) {
    return value.map((file) => file.name || 'Untitled').join(', ')
  }

  return String(value)
}
