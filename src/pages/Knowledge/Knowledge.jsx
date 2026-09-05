import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import { useCompanyKnowledge } from '../../hooks/useCompanyKnowledge.js'
import { useKnowledgeMutations } from '../../hooks/useKnowledgeMutations.js'
import { searchKnowledgeItems } from '../../knowledge/search.js'
import {
  DEFAULT_COMPANY_ID,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_LIST_PAGE_SIZE,
  KNOWLEDGE_SOURCE_LABELS,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TYPE_LABELS,
} from '../../knowledge/types.js'
import { PATH, knowledgeEditPath, knowledgePath } from '../../workspace/paths.js'
import styles from './Knowledge.module.css'

const SORTS = [
  { id: 'updated', label: 'Updated' },
  { id: 'title', label: 'A–Z' },
  { id: 'status', label: 'Status' },
]

const STATUS_FILTERS = ['all', ...Object.values(KNOWLEDGE_STATUS)]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function Knowledge() {
  const { id } = useParams()
  const navigate = useNavigate()
  const companyId = DEFAULT_COMPANY_ID
  const { items, loading, error, refetch } = useCompanyKnowledge({
    companyId,
    includeArchived: true,
  })
  const { approve, archive, restore, submitting, error: actionError } = useKnowledgeMutations()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated')
  const [page, setPage] = useState(0)

  const visible = useMemo(() => {
    let list = items
    if (category !== 'all') {
      list = list.filter((item) => item.category === category)
    }
    if (status !== 'all') {
      list = list.filter((item) => item.status === status)
    } else {
      list = list.filter((item) => item.status !== KNOWLEDGE_STATUS.ARCHIVED)
    }

    const q = query.trim()
    if (q) {
      const ranked = searchKnowledgeItems(list, q, { includeArchived: true, limit: 100 })
      list = ranked.map((row) => row.item)
    } else {
      list = [...list].sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'status') return a.status.localeCompare(b.status) || a.title.localeCompare(b.title)
        return String(b.updatedAt).localeCompare(String(a.updatedAt))
      })
    }

    return list
  }, [items, query, category, status, sort])

  const pageCount = Math.max(1, Math.ceil(visible.length / KNOWLEDGE_LIST_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = visible.slice(
    safePage * KNOWLEDGE_LIST_PAGE_SIZE,
    safePage * KNOWLEDGE_LIST_PAGE_SIZE + KNOWLEDGE_LIST_PAGE_SIZE,
  )
  const selected = items.find((item) => item.id === id) ?? null
  const detailOpen = Boolean(id)

  async function handleApprove(item) {
    const updated = await approve(item.id, companyId, 'studio')
    if (updated) await refetch()
  }

  async function handleArchive(item) {
    const updated = await archive(item.id, companyId)
    if (updated) {
      await refetch()
      if (id === item.id) navigate(PATH.KNOWLEDGE)
    }
  }

  async function handleRestore(item) {
    const updated = await restore(item.id, companyId)
    if (updated) await refetch()
  }

  return (
    <section className={`${styles.page} ${detailOpen ? styles.pageDetail : ''}`}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Approved, reusable company knowledge. Drafts stay visible here and never enter
          AI context until they are approved.
        </p>
        <Link to={PATH.NEW_KNOWLEDGE} className={styles.primary}>
          New knowledge
        </Link>
      </div>

      <div className={styles.filters}>
        <label className={styles.search}>
          <Icon name="search" size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
            placeholder="Search title, content, tags…"
            aria-label="Search company knowledge"
          />
        </label>
        <div className={styles.chips} role="group" aria-label="Category">
          <button
            type="button"
            className={`${styles.chip} ${category === 'all' ? styles.chipOn : ''}`}
            onClick={() => {
              setCategory('all')
              setPage(0)
            }}
          >
            All categories
          </button>
          {KNOWLEDGE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${category === value ? styles.chipOn : ''}`}
              onClick={() => {
                setCategory(value)
                setPage(0)
              }}
            >
              {KNOWLEDGE_CATEGORY_LABELS[value]}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Status">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${status === value ? styles.chipOn : ''}`}
              onClick={() => {
                setStatus(value)
                setPage(0)
              }}
            >
              {value === 'all' ? 'Active' : KNOWLEDGE_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        <div className={styles.sorts} role="group" aria-label="Sort">
          {SORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.sort} ${sort === item.id ? styles.sortOn : ''}`}
              onClick={() => setSort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {actionError ? (
        <p className={styles.banner} role="alert">
          {actionError.message || 'Could not update knowledge.'}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.listPane}>
          {error ? (
            <div className={styles.state}>
              <p className={styles.stateTitle}>Could not load knowledge</p>
              <p className={styles.stateText}>{error.message}</p>
              <button type="button" className={styles.secondary} onClick={refetch}>
                Try again
              </button>
            </div>
          ) : loading && items.length === 0 ? (
            <div className={styles.skeleton} aria-hidden="true">
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
            </div>
          ) : paged.length === 0 ? (
            <div className={styles.state}>
              <p className={styles.stateTitle}>No knowledge matches</p>
              <p className={styles.stateText}>
                Create a record, or clear filters. Saving from a proposal always starts as a draft.
              </p>
              <Link to={PATH.NEW_KNOWLEDGE} className={styles.primary}>
                New knowledge
              </Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {paged.map((item) => {
                const active = item.id === id
                return (
                  <li key={item.id}>
                    <Link
                      to={knowledgePath(item.id)}
                      className={`${styles.card} ${active ? styles.cardOn : ''}`}
                    >
                      <p className={styles.kicker}>
                        {KNOWLEDGE_TYPE_LABELS[item.type]} · {KNOWLEDGE_CATEGORY_LABELS[item.category]}
                      </p>
                      <h2 className={styles.cardTitle}>{item.title}</h2>
                      <p className={styles.meta}>
                        <span>{KNOWLEDGE_STATUS_LABELS[item.status]}</span>
                        {' · '}
                        <span>{KNOWLEDGE_SOURCE_LABELS[item.source] ?? item.source}</span>
                        {' · '}
                        <span>Updated {formatDate(item.updatedAt)}</span>
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {visible.length > KNOWLEDGE_LIST_PAGE_SIZE ? (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.secondary}
                disabled={safePage === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous
              </button>
              <p className={styles.pageLabel}>
                Page {safePage + 1} of {pageCount}
              </p>
              <button
                type="button"
                className={styles.secondary}
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        <aside className={styles.detail} aria-live="polite">
          {selected ? (
            <article className={styles.panel}>
              <div className={styles.detailHead}>
                <Link to={PATH.KNOWLEDGE} className={styles.back}>
                  Back to list
                </Link>
                <p className={styles.kicker}>
                  {KNOWLEDGE_TYPE_LABELS[selected.type]} · {KNOWLEDGE_CATEGORY_LABELS[selected.category]}
                </p>
                <h2 className={styles.detailTitle}>{selected.title}</h2>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Status</dt>
                  <dd>{KNOWLEDGE_STATUS_LABELS[selected.status]}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{KNOWLEDGE_SOURCE_LABELS[selected.source] ?? selected.source}</dd>
                </div>
                <div>
                  <dt>Approval</dt>
                  <dd>
                    {selected.status === KNOWLEDGE_STATUS.APPROVED
                      ? `Approved${selected.approvedBy ? ` by ${selected.approvedBy}` : ''}`
                      : 'Not approved'}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(selected.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Usage</dt>
                  <dd>
                    {selected.usageCount} use{selected.usageCount === 1 ? '' : 's'}
                    {selected.lastUsedAt ? ` · last ${formatDate(selected.lastUsedAt)}` : ''}
                  </dd>
                </div>
              </dl>
              {selected.tags.length > 0 ? (
                <p className={styles.tags}>Tags: {selected.tags.join(', ')}</p>
              ) : null}
              {selected.metadata?.possibleDuplicate ? (
                <p className={styles.warn} role="status">
                  Possible duplicate. Review related records before approving.
                </p>
              ) : null}
              {selected.metadata?.demo ? (
                <p className={styles.hint}>Demo content. Safe to edit or archive.</p>
              ) : null}
              <pre className={styles.content}>{selected.content}</pre>
              <div className={styles.actions}>
                <Link to={knowledgeEditPath(selected.id)} className={styles.primary}>
                  Edit
                </Link>
                {selected.status !== KNOWLEDGE_STATUS.APPROVED &&
                selected.status !== KNOWLEDGE_STATUS.ARCHIVED ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={submitting}
                    onClick={() => handleApprove(selected)}
                  >
                    Approve
                  </button>
                ) : null}
                {selected.status !== KNOWLEDGE_STATUS.ARCHIVED ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={submitting}
                    onClick={() => handleArchive(selected)}
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={submitting}
                    onClick={() => handleRestore(selected)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </article>
          ) : (
            <div className={styles.panelMuted}>
              <p className={styles.stateTitle}>Select a record</p>
              <p className={styles.stateText}>
                Open an item to review content, source and approval state. Only approved
                knowledge is eligible for future AI context.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

export default Knowledge
