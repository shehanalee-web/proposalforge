import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ACTIVITY_PAGE_SIZE,
  flattenActivityGroups,
  groupActivityEvents,
} from '../models/activityEvent.js'
import {
  filterActivityEvents,
  listProposalActivity,
  onActivityEvent,
} from '../services/activityService.js'

/**
 * Lazy, filterable activity feed for one proposal.
 *
 * @param {string | null | undefined} proposalId
 * @param {import('../models/proposal.js').Proposal | null} [proposal]
 * @param {boolean} [enabled]
 */
export function useProposalActivity(proposalId, proposal, enabled = true) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(ACTIVITY_PAGE_SIZE)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const proposalRef = useRef(proposal)

  useEffect(() => {
    proposalRef.current = proposal
  }, [proposal])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!proposalId || !enabled) return
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const next = await listProposalActivity(proposalId, proposalRef.current)
      setEvents(next)
    } catch (caught) {
      if (!silent) setError(caught)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [proposalId, enabled])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!proposalId || !enabled) return undefined
    const timer = window.setInterval(() => {
      void load({ silent: true })
    }, 4000)
    return () => window.clearInterval(timer)
  }, [proposalId, enabled, load])

  useEffect(() => {
    if (!proposalId || !enabled) return undefined
    return onActivityEvent((event) => {
      if (event.proposal_id !== proposalId) return
      setEvents((current) => {
        if (current.some((row) => row.id === event.id)) return current
        return [event, ...current]
      })
    })
  }, [proposalId, enabled])

  useEffect(() => {
    setVisibleCount(ACTIVITY_PAGE_SIZE)
    setExpandedIds(new Set())
  }, [filter, search, proposalId])

  const filtered = useMemo(
    () => filterActivityEvents(events, { filter, search }),
    [events, filter, search],
  )

  const groups = useMemo(() => groupActivityEvents(filtered), [filtered])
  const rows = useMemo(
    () => flattenActivityGroups(groups, expandedIds).slice(0, visibleCount),
    [groups, expandedIds, visibleCount],
  )
  const totalRows = useMemo(
    () => flattenActivityGroups(groups, expandedIds).length,
    [groups, expandedIds],
  )
  const hasMore = visibleCount < totalRows

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + ACTIVITY_PAGE_SIZE)
  }, [])

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return {
    events: filtered,
    groups,
    rows,
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
    hasMore,
    loadMore,
    expandedIds,
    toggleExpanded,
    refetch: load,
  }
}
