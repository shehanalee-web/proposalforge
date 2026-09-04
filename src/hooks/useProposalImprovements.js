import { useCallback, useMemo, useState } from 'react'
import { useProposalHealth } from './useProposalHealth.js'
import {
  applyImprovement,
  draftPlainText,
  getImproveProvider,
} from '../improve/index.js'

/**
 * Live improvement drafts for each health finding. Generate is deterministic
 * until a networked provider is registered.
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

  const findings = report.suggestions
  const provider = getImproveProvider()

  const previewDraft = useMemo(
    () => (previewCode ? drafts[previewCode] ?? null : null),
    [drafts, previewCode],
  )

  const generate = useCallback(
    (finding) => {
      if (!finding?.code || !provider) return null
      const draft = provider.generate({ finding, proposal, blocks })
      setDrafts((current) => ({ ...current, [finding.code]: draft }))
      setPreviewed((current) => ({ ...current, [finding.code]: false }))
      return draft
    },
    [blocks, proposal, provider],
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
      if (!draft || !previewed[finding.code]) return false
      const next = applyImprovement(blocks, draft)
      onApply?.(next)
      setPreviewCode(null)
      return true
    },
    [blocks, drafts, onApply, previewed],
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
    generate,
    preview,
    closePreview,
    insert,
    copy,
  }
}
