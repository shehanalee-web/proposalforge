import { useEffect, useState } from 'react'
import { makeEmailMessage } from '../models/emailDelivery.js'

/**
 * Latest outbound email for a proposal. Polls the local mail log so delivery
 * chips stay in sync with provider webhooks and click/open tracking.
 *
 * @param {string | null | undefined} proposalId
 * @param {boolean} [enabled]
 */
export function useLatestEmailMessage(proposalId, enabled = true) {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!proposalId || !enabled) {
      return undefined
    }

    let cancelled = false

    async function load() {
      try {
        const response = await fetch(
          `/api/email/messages?proposalId=${encodeURIComponent(proposalId)}`,
        )
        if (!response.ok) return
        const payload = await response.json()
        const records = Array.isArray(payload?.records) ? payload.records : []
        const latest = records
          .map((row) => makeEmailMessage(row))
          .sort((a, b) => String(b.sentAt || b.createdAt).localeCompare(String(a.sentAt || a.createdAt)))[0]
        if (!cancelled) setMessage(latest ?? null)
      } catch {
        /* local mail API unavailable */
      }
    }

    void load()
    const timer = window.setInterval(load, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [proposalId, enabled])

  return message
}
