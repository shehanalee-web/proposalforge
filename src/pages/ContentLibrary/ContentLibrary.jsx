import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import {
  BLOCK_CATEGORIES,
  BLOCK_CATEGORY_LABELS,
  CONTENT_BLOCK_TYPE_LABELS,
  LIBRARY_BLOCK_STATUS,
  LIBRARY_BLOCK_STATUS_LABELS,
} from '../../models/contentBlock.js'
import { useLibraryBlocks } from '../../hooks/useLibraryBlocks.js'
import { useUpdateLibraryBlock } from '../../hooks/useUpdateLibraryBlock.js'
import { useDeleteLibraryBlock } from '../../hooks/useDeleteLibraryBlock.js'
import { PATH, contentBlockEditPath } from '../../workspace/paths.js'
import styles from './ContentLibrary.module.css'

const SORTS = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently used' },
  { id: 'used', label: 'Most used' },
  { id: 'name', label: 'A–Z' },
]

function ContentLibrary() {
  const { blocks, loading, error, refetch } = useLibraryBlocks()
  const { update } = useUpdateLibraryBlock()
  const { remove, submitting: deleting, error: deleteError } = useDeleteLibraryBlock()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('favorites')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = blocks.filter((block) => block.status !== LIBRARY_BLOCK_STATUS.ARCHIVED)

    if (category !== 'all') {
      list = list.filter((block) => block.category === category)
    }
    if (q) {
      list = list.filter((block) => {
        const hay = [block.name, block.description, block.tags.join(' '), CONTENT_BLOCK_TYPE_LABELS[block.type]]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    return [...list].sort((a, b) => {
      if (sort === 'recent') {
        return String(b.lastUsedAt ?? b.updatedAt).localeCompare(String(a.lastUsedAt ?? a.updatedAt))
      }
      if (sort === 'used') return (b.useCount ?? 0) - (a.useCount ?? 0)
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [blocks, query, category, sort])

  async function toggleFavorite(block) {
    setBusyId(block.id)
    await update(block.id, { favorite: !block.favorite })
    setBusyId(null)
    await refetch()
  }

  async function confirmDelete(id) {
    setBusyId(id)
    const deleted = await remove(id)
    setBusyId(null)
    setPendingDeleteId(null)
    if (deleted) await refetch()
  }

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Reusable blocks for every proposal. Insert them into a document —
          variables such as {'{{client_name}}'} fill in at preview time.
        </p>
        <Link to={PATH.NEW_CONTENT_BLOCK} className={styles.primary}>
          New block
        </Link>
      </div>

      <div className={styles.filters}>
        <label className={styles.search}>
          <Icon name="search" size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks, tags, types…"
            aria-label="Search proposal blocks"
          />
        </label>
        <div className={styles.chips} role="tablist" aria-label="Category">
          <button
            type="button"
            className={`${styles.chip} ${category === 'all' ? styles.chipOn : ''}`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {BLOCK_CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.chip} ${category === id ? styles.chipOn : ''}`}
              onClick={() => setCategory(id)}
            >
              {BLOCK_CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
        <div className={styles.sorts}>
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

      {deleteError ? (
        <p className={styles.banner} role="alert">
          {deleteError.message || 'Could not delete the block.'}
        </p>
      ) : null}

      {error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load blocks</p>
          <p className={styles.stateText}>{error.message}</p>
          <button type="button" className={styles.secondary} onClick={refetch}>
            Try again
          </button>
        </div>
      ) : loading && blocks.length === 0 ? (
        <div className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No blocks match</p>
          <p className={styles.stateText}>
            Create a reusable block, or clear filters to see the library.
          </p>
          <Link to={PATH.NEW_CONTENT_BLOCK} className={styles.primary}>
            New block
          </Link>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((block) => {
            const pendingDelete = pendingDeleteId === block.id
            const busy = busyId === block.id

            return (
              <li key={block.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <p className={styles.kicker}>
                    {BLOCK_CATEGORY_LABELS[block.category]} ·{' '}
                    {CONTENT_BLOCK_TYPE_LABELS[block.type]}
                  </p>
                  <button
                    type="button"
                    className={`${styles.star} ${block.favorite ? styles.starOn : ''}`}
                    onClick={() => toggleFavorite(block)}
                    disabled={busy}
                    aria-label={block.favorite ? 'Remove favorite' : 'Add favorite'}
                  >
                    <Icon name="star" size={15} />
                  </button>
                </div>
                <h2 className={styles.cardTitle}>{block.name}</h2>
                <p className={styles.cardBody}>
                  {block.description || 'No description'}
                </p>
                <p className={styles.meta}>
                  {LIBRARY_BLOCK_STATUS_LABELS[block.status]} · v{block.version}
                  {block.tags.length > 0 ? ` · ${block.tags.join(', ')}` : ''}
                  {` · used ${block.useCount ?? 0}`}
                </p>
                {pendingDelete ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => confirmDelete(block.id)}
                      disabled={busy || deleting}
                    >
                      {busy ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <Link to={contentBlockEditPath(block.id)} className={styles.primary}>
                      Edit
                    </Link>
                    <Link
                      to={`${PATH.NEW_CONTENT_BLOCK}?from=${encodeURIComponent(block.id)}`}
                      className={styles.secondary}
                    >
                      Duplicate
                    </Link>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setPendingDeleteId(block.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default ContentLibrary
