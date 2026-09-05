import { useCallback, useMemo, useRef, useState } from 'react'
import { useProposalHealth } from './useProposalHealth.js'
import { useProposalIntelligence } from './useProposalIntelligence.js'
import { useProposalConsistency } from './useProposalConsistency.js'
import { analyzeProposalCoaching, COACH_ACTION, COACH_MODE } from '../coach/index.js'
import { generateCoachAdvice } from '../coach/client.js'
import { resolveCompanyVoice, sectionTextFor } from '../coach/context.js'
import { isImproveAbort } from '../improve/errors.js'

/**
 * Deterministic coaching plus explicit AI Coach requests.
 *
 * @param {object} [proposal]
 * @param {object[]} [blocks]
 */
export function useProposalCoach(proposal, blocks) {
  const health = useProposalHealth(proposal, blocks)
  const intelligence = useProposalIntelligence(proposal, blocks)
  const consistency = useProposalConsistency(proposal, blocks)
  const [mode, setMode] = useState(COACH_MODE.PROFESSIONAL)
  const [replies, setReplies] = useState({})
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})
  const abortRefs = useRef({})
  const busyRef = useRef({})

  const report = useMemo(
    () =>
      analyzeProposalCoaching({
        proposal,
        health,
        diagnostics: health.suggestions,
        intelligence,
        consistency,
        mode,
      }),
    [proposal, health, intelligence, consistency, mode],
  )

  const voice = useMemo(() => resolveCompanyVoice(proposal ?? {}), [proposal])

  const ask = useCallback(
    async (item, action = COACH_ACTION.ASK) => {
      if (!item?.id || !item.aiAvailable) return null
      const key = `${item.id}:${action}`
      if (busyRef.current[key]) {
        abortRefs.current[key]?.abort()
        delete abortRefs.current[key]
        busyRef.current[key] = false
        setBusy((current) => ({ ...current, [key]: false }))
        return null
      }

      const controller = new AbortController()
      abortRefs.current[key] = controller
      busyRef.current[key] = true
      setBusy((current) => ({ ...current, [key]: true }))
      setErrors((current) => ({ ...current, [key]: false }))

      try {
        const text = await generateCoachAdvice(
          {
            item,
            action,
            mode,
            proposal,
            blocks,
            sectionText: sectionTextFor(blocks ?? proposal?.blocks, item.section, {
              code: item.findingType,
              blockType: item.blockType,
            }),
            intelligenceNote: intelligence?.insights?.executivePriority?.headline ?? '',
            consistencyNote:
              item.findingSource === 'consistency' ? item.explanation : '',
            options: {
              companyTone: voice.companyTone,
              brandVoice: voice.brandVoice,
            },
          },
          { signal: controller.signal },
        )
        setReplies((current) => ({ ...current, [key]: text }))
        setErrors((current) => ({ ...current, [key]: false }))
        return text
      } catch (error) {
        if (isImproveAbort(error) || controller.signal.aborted) return null
        setErrors((current) => ({ ...current, [key]: true }))
        return null
      } finally {
        delete abortRefs.current[key]
        busyRef.current[key] = false
        setBusy((current) => ({ ...current, [key]: false }))
      }
    },
    [blocks, intelligence, mode, proposal, voice.brandVoice, voice.companyTone],
  )

  return {
    ...report,
    mode,
    setMode,
    hasVoice: voice.hasVoice,
    companyTone: voice.companyTone,
    brandVoice: voice.brandVoice,
    replies,
    busy,
    errors,
    ask,
  }
}
