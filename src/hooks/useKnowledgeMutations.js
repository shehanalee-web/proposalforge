import { useCallback, useState } from 'react'
import {
  approveKnowledgeItemApi,
  archiveKnowledgeItemApi,
  createKnowledgeItemApi,
  restoreKnowledgeItemApi,
  saveProposalToKnowledgeApi,
  updateKnowledgeItemApi,
} from '../services/knowledgeService.js'
import { ValidationError } from '../services/errors.js'

function toFieldMap(errors) {
  const fields = {}
  for (const entry of errors ?? []) {
    fields[entry.field] = entry.message
  }
  return fields
}

export function useKnowledgeMutations() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const run = useCallback(async (task) => {
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      return await task()
    } catch (caught) {
      if (caught instanceof ValidationError) {
        setFieldErrors(toFieldMap(caught.errors))
      }
      setError(caught)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [])

  const create = useCallback((input) => run(() => createKnowledgeItemApi(input)), [run])
  const update = useCallback(
    (id, changes, companyId) => run(() => updateKnowledgeItemApi({ companyId, id, changes })),
    [run],
  )
  const approve = useCallback(
    (id, companyId, approvedBy) =>
      run(() => approveKnowledgeItemApi({ companyId, id, approvedBy })),
    [run],
  )
  const archive = useCallback(
    (id, companyId) => run(() => archiveKnowledgeItemApi({ companyId, id })),
    [run],
  )
  const restore = useCallback(
    (id, companyId) => run(() => restoreKnowledgeItemApi({ companyId, id })),
    [run],
  )
  const saveFromProposal = useCallback(
    (input) => run(() => saveProposalToKnowledgeApi(input)),
    [run],
  )

  return {
    create,
    update,
    approve,
    archive,
    restore,
    saveFromProposal,
    submitting,
    error,
    fieldErrors,
    reset,
  }
}
