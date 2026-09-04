import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon/Icon.jsx'
import {
  ACTIVITY_FILTER_LABELS,
  ACTIVITY_FILTERS,
  activityAuthor,
  activityChanges,
  activityDescription,
  activityIconName,
} from '../../models/activityEvent.js'
import { exportActivity } from '../../services/activityService.js'
import { useProposalActivity } from '../../hooks/useProposalActivity.js'
import { formatActivityStamp, formatRelativeTime } from '../../utils/format.js'
import styles from './ActivityPanel.module.css'

const ROW_HEIGHT = 62
const OVERSCAN = 8

function asDisplay(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function ActivityPanel({ proposal, onClose }) {
  const {
    events,
    rows,
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
    hasMore,
    loadMore,
    toggleExpanded,
    refetch,
  } = useProposalActivity(proposal?.id, proposal, Boolean(proposal))

  const [selectedId, setSelectedId] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [range, setRange] = useState({ start: 0, end: 24 })
  const scrollerRef = useRef(null)

  const selectedIndex = useMemo(
    () => rows.findIndex((row) => row.id === selectedId),
    [rows, selectedId],
  )
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0
  const activeId = rows[activeIndex]?.id ?? null

  const activateRow = useCallback(
    (row) => {
      if (!row) return
      if (row.kind === 'group') {
        toggleExpanded(row.id)
        return
      }
      setDetailEvent(row.event)
    },
    [toggleExpanded],
  )

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return undefined

    function updateRange() {
      if (!rows.length) return
      const start = Math.max(0, Math.floor(node.scrollTop / ROW_HEIGHT) - OVERSCAN)
      const visible = Math.ceil(node.clientHeight / ROW_HEIGHT) + OVERSCAN * 2
      const end = Math.min(rows.length, start + Math.max(visible, 12))
      setRange({ start, end })
      if (hasMore && node.scrollTop + node.clientHeight > node.scrollHeight - 160) {
        loadMore()
      }
    }

    updateRange()
    node.addEventListener('scroll', updateRange, { passive: true })
    return () => node.removeEventListener('scroll', updateRange)
  }, [rows.length, loadMore, hasMore])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (detailEvent) {
          setDetailEvent(null)
          return
        }
        onClose()
        return
      }

      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!rows.length) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const current = selectedIndex < 0 ? 0 : selectedIndex
        const next = Math.min(rows.length - 1, Math.max(0, current + delta))
        setSelectedId(rows[next].id)
        const node = scrollerRef.current
        if (node) {
          const top = next * ROW_HEIGHT
          if (top < node.scrollTop) node.scrollTop = top
          if (top + ROW_HEIGHT > node.scrollTop + node.clientHeight) {
            node.scrollTop = top - node.clientHeight + ROW_HEIGHT
          }
        }
        return
      }

      if (event.key === 'Enter' && rows[activeIndex]) {
        event.preventDefault()
        activateRow(rows[activeIndex])
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activateRow, activeIndex, detailEvent, onClose, rows, selectedIndex])

  async function handleExport(format) {
    if (exporting) return
    setExporting(true)
    try {
      await exportActivity(events, format, proposal)
    } finally {
      setExporting(false)
    }
  }

  const slice = rows.slice(range.start, range.end)
  const listHeight = Math.max(rows.length, 1) * ROW_HEIGHT

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposal-activity-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="proposal-activity-title" className={styles.title}>
              Activity
            </h2>
            <p className={styles.intro}>
              Every important action on this proposal, newest first.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.filters} role="tablist" aria-label="Activity filters">
          {ACTIVITY_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`${styles.filter} ${filter === id ? styles.filterOn : ''}`}
              onClick={() => setFilter(id)}
            >
              {ACTIVITY_FILTER_LABELS[id]}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Icon name="search" size={14} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities"
              aria-label="Search activities"
            />
          </label>
          <div className={styles.export}>
            <button
              type="button"
              className={styles.ghost}
              disabled={exporting || !events.length}
              onClick={() => handleExport('csv')}
            >
              CSV
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={exporting || !events.length}
              onClick={() => handleExport('pdf')}
            >
              PDF
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={exporting || !events.length}
              onClick={() => handleExport('json')}
            >
              JSON
            </button>
          </div>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error.message || 'Could not load activity.'}{' '}
            <button type="button" className={styles.textButton} onClick={refetch}>
              Try again
            </button>
          </p>
        ) : null}

        {detailEvent ? (
          <DetailDrawer event={detailEvent} onBack={() => setDetailEvent(null)} />
        ) : (
          <div
            ref={scrollerRef}
            className={styles.scroller}
            tabIndex={0}
            role="listbox"
            aria-label="Proposal activity"
            aria-activedescendant={activeId ? `activity-${activeId}` : undefined}
          >
            {loading && !rows.length ? (
              <p className={styles.empty}>Loading activity…</p>
            ) : null}
            {!loading && !rows.length ? (
              <p className={styles.empty}>No activity matches these filters.</p>
            ) : null}
            <div className={styles.virtual} style={{ height: listHeight }}>
              {slice.map((row, index) => {
                const absolute = range.start + index
                const selected = row.id === activeId
                const event = row.event
                const title = row.kind === 'group' ? row.group.title : event.event_title
                const description =
                  row.kind === 'group' ? row.group.description : activityDescription(event)
                const author = row.kind === 'group' ? row.group.author : activityAuthor(event)
                const createdAt = row.kind === 'group' ? row.group.created_at : event.created_at

                return (
                  <button
                    key={row.id}
                    id={`activity-${row.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${styles.row} ${selected ? styles.rowSelected : ''} ${row.kind === 'child' ? styles.rowChild : ''}`}
                    style={{ top: absolute * ROW_HEIGHT, height: ROW_HEIGHT }}
                    onClick={() => {
                      setSelectedId(row.id)
                      activateRow(row)
                    }}
                  >
                    <span
                      className={`${styles.rail} ${styles[`tone_${event.event_type}`] ?? ''}`}
                      aria-hidden="true"
                    >
                      <span className={styles.dot} />
                      {absolute < rows.length - 1 ? <span className={styles.line} /> : null}
                    </span>
                    <span className={`${styles.icon} ${styles[`tone_${event.event_type}`] ?? ''}`}>
                      <Icon name={activityIconName(event)} size={14} />
                    </span>
                    <span className={styles.body}>
                      <span className={styles.rowTitle}>{title}</span>
                      <span className={styles.rowDetail}>{description}</span>
                      <span className={styles.rowMeta}>
                        <span>{author}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={createdAt} title={formatActivityStamp(createdAt)}>
                          {formatRelativeTime(createdAt)}
                        </time>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            {hasMore ? (
              <p className={styles.more} aria-hidden="true">
                Loading more…
              </p>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  )
}

function DetailDrawer({ event, onBack }) {
  const changes = activityChanges(event)

  return (
    <div className={styles.drawer}>
      <button type="button" className={styles.back} onClick={onBack}>
        Back to activity
      </button>
      <div className={styles.drawerHead}>
        <span className={`${styles.icon} ${styles[`tone_${event.event_type}`] ?? ''}`}>
          <Icon name={activityIconName(event)} size={16} />
        </span>
        <div>
          <h3 className={styles.drawerTitle}>{event.event_title}</h3>
          <p className={styles.rowDetail}>{activityDescription(event)}</p>
        </div>
      </div>
      <dl className={styles.metaList}>
        <div>
          <dt>User</dt>
          <dd>{activityAuthor(event)}</dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{formatActivityStamp(event.created_at)}</dd>
        </div>
      </dl>
      {changes.length ? (
        <div className={styles.changes}>
          <p className={styles.changesLabel}>Changed</p>
          <ul>
            {changes.map((change) => (
              <li key={change.field}>
                <span className={styles.changeLabel}>{change.label}</span>
                <span className={styles.changeValues}>
                  <span className={styles.previous}>{asDisplay(change.previous)}</span>
                  <span aria-hidden="true">→</span>
                  <span className={styles.next}>{asDisplay(change.next)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default ActivityPanel
