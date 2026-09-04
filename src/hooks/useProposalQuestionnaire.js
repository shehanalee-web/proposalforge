import { useCallback, useEffect, useRef, useState } from 'react'
import { validateQuestionnaire } from '../forms/validate.js'
import {
  isQuestionnaireSubmitted,
  upsertResponse,
} from '../models/questionnaire.js'
import { ValidationError } from '../services/errors.js'
import {
  savePortalQuestionnaire,
  submitPortalQuestionnaire,
} from '../services/portalService.js'

const SAVE_MS = 400

function errorsByQuestion(errors = []) {
  const map = {}
  for (const entry of errors) {
    const key = entry.questionId ?? entry.field
    if (key) map[key] = entry.message
  }
  return map
}

/**
 * Client-side draft of a proposal questionnaire with debounced autosave.
 */
export function useProposalQuestionnaire({ token, questionnaire, onProposalChange }) {
  const [local, setLocal] = useState(questionnaire)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const timer = useRef(0)
  const pending = useRef(null)
  const persistRef = useRef(async () => {})
  const submitted = isQuestionnaireSubmitted(local)

  const persist = useCallback(
    async (responses) => {
      if (!token || isQuestionnaireSubmitted(local)) return
      setSaving(true)
      setError(null)
      try {
        const result = await savePortalQuestionnaire(token, responses)
        pending.current = null
        setSavedAt(new Date().toISOString())
        onProposalChange?.(result.proposal)
      } catch (caught) {
        setError(caught)
      } finally {
        setSaving(false)
      }
    },
    [token, local, onProposalChange],
  )
  persistRef.current = persist

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
    }
  }, [])

  function setAnswer(questionId, value) {
    if (submitted) return
    setLocal((current) => {
      const next = upsertResponse(current, questionId, value)
      pending.current = next.responses
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        persistRef.current?.(next.responses)
      }, SAVE_MS)
      return next
    })
    setFieldErrors((current) => {
      if (!current[questionId]) return current
      const next = { ...current }
      delete next[questionId]
      return next
    })
  }

  async function flush() {
    window.clearTimeout(timer.current)
    if (pending.current) {
      await persistRef.current?.(pending.current)
    }
  }

  async function submit() {
    if (submitted || submitting) return false
    const latest = pending.current
      ? { ...local, responses: pending.current }
      : local
    await flush()
    const errors = validateQuestionnaire(latest)
    if (errors.length > 0) {
      setFieldErrors(errorsByQuestion(errors))
      setError(new ValidationError('Please complete the required questions.', errors))
      return false
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await submitPortalQuestionnaire(token)
      setLocal(result.proposal.questionnaire)
      onProposalChange?.(result.proposal)
      return true
    } catch (caught) {
      if (caught instanceof ValidationError) {
        setFieldErrors(errorsByQuestion(caught.errors))
      }
      setError(caught)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return {
    questionnaire: local,
    setAnswer,
    saving,
    savedAt,
    submitting,
    error,
    fieldErrors,
    submit,
    flush,
    submitted,
  }
}
