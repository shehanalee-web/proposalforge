import { useCallback, useMemo, useRef, useState } from 'react'
import { useProposalHealth } from './useProposalHealth.js'
import { applyImprovement, draftPlainText } from '../improve/apply.js'
import { makeImprovementDraft } from '../improve/draft.js'
import { generateImprovement } from '../improve/client.js'
import { isImproveAbort } from '../improve/errors.js'

/**
 * Live improvement drafts for each health finding. The active LLM is
 * selected on the server from environment config.
 *
 * @param {{
 *   proposal?: object,
 *   blocks?: object[],
 *   onApply?: (next: { blocks: object[], summary?: string | null }) => void,
 * }} args
 */
export function useProposalImprovements({ proposal, blocks, onApply } = {}) {
  const report = useProposalHealth(proposal, blocks)
  const [drafts, setDrafts] = useState({})
  const [previewCode, setPreviewCode] = useState(null)
  const [previewed, setPreviewed] = useState({})
  const [copiedCode, setCopiedCode] = useState(null)
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})
  const abortRefs = useRef({})
  const busyRef = useRef({})

  const findings = report.suggestions

  const previewDraft = useMemo(
    () => (previewCode ? drafts[previewCode] ?? null : null),
    [drafts, previewCode],
  )

  const cancel = useCallback((finding) => {
    const code = finding?.code
    if (!code) return
    abortRefs.current[code]?.abort()
    delete abortRefs.current[code]
    busyRef.current[code] = false
    setBusy((current) => ({ ...current, [code]: false }))
  }, [])

  const generate = useCallback(
    async (finding, options = {}) => {
      if (!finding?.code) return null
      const code = finding.code

      if (busyRef.current[code]) {
        cancel(finding)
        return null
      }

      const previous = drafts[code] ?? null
      const controller = new AbortController()
      abortRefs.current[code] = controller
      busyRef.current[code] = true
      setBusy((current) => ({ ...current, [code]: true }))
      setErrors((current) => ({ ...current, [code]: false }))
      setPreviewed((current) => ({ ...current, [code]: false }))

      try {
        const draft = await generateImprovement(
          {
            finding,
            proposal,
            blocks,
            options: {
              retry: Boolean(options.retry),
              companyTone: options.companyTone ?? '',
              brandVoice: options.brandVoice ?? '',
            },
          },
          {
            signal: controller.signal,
            onDelta(text) {
              if (previous) return
              setDrafts((current) => ({
                ...current,
                [code]: makeImprovementDraft({
                  findingId: finding.id,
                  findingCode: code,
                  title: finding.title,
                  previewTitle: finding.title,
                  previewBody: text,
                }),
              }))
            },
          },
        )
        setDrafts((current) => ({ ...current, [code]: draft }))
        setPreviewed((current) => ({ ...current, [code]: false }))
        setErrors((current) => ({ ...current, [code]: false }))
        return draft
      } catch (error) {
        if (isImproveAbort(error) || controller.signal.aborted) {
          if (!previous) {
            setDrafts((current) => {
              const next = { ...current }
              delete next[code]
              return next
            })
          }
          return null
        }
        setErrors((current) => ({ ...current, [code]: true }))
        return null
      } finally {
        delete abortRefs.current[code]
        busyRef.current[code] = false
        setBusy((current) => ({ ...current, [code]: false }))
      }
    },
    [blocks, cancel, drafts, proposal],
  )

  const preview = useCallback((finding) => {
    if (!finding?.code) return
    setPreviewed((current) => ({ ...current, [finding.code]: true }))
    setPreviewCode(finding.code)
  }, [])

  const closePreview = useCallback(() => setPreviewCode(null), [])

  const insert = useCallback(
    (finding) => {
      const draft = finding?.code ? drafts[finding.code] : null
      if (!draft || !previewed[finding.code] || busy[finding.code]) return false
      const next = applyImprovement(blocks, draft)
      onApply?.(next)
      setPreviewCode(null)
      return true
    },
    [blocks, busy, drafts, onApply, previewed],
  )

  const copy = useCallback(async (finding) => {
    const draft = finding?.code ? drafts[finding.code] : null
    if (!draft) return false
    const text = draftPlainText(draft)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    setCopiedCode(finding.code)
    window.setTimeout(() => setCopiedCode(null), 1800)
    return true
  }, [drafts])

  return {
    findings,
    drafts,
    previewDraft,
    previewed,
    copiedCode,
    busy,
    errors,
    generate,
    cancel,
    preview,
    closePreview,
    insert,
    copy,
  }
}
