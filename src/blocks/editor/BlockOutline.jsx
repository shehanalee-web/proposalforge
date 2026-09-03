import { useMemo, useState } from 'react'
import Icon from '../../components/Icon/Icon.jsx'
import { useEditorWorkspace } from '../../components/Editor/EditorWorkspaceContext.jsx'
import { getBlockMeta } from './blockMeta.js'
import styles from './BlockOutline.module.css'

const DRAG_TYPE = 'application/x-pf-block'

function BlockOutline({
  blocks,
  onReorder,
  disabled = false,
}) {
  const {
    outlineOpen,
    activeBlockId,
    scrollToBlock,
    searchQuery,
    setSearchQuery,
    searchRef,
    previewMode,
  } = useEditorWorkspace()
  const [dropIndex, setDropIndex] = useState(-1)

  const list = blocks ?? []
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((block) => {
      const meta = getBlockMeta(block.type)
      return (
        meta.short.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q)
      )
    })
  }, [list, searchQuery])

  if (!outlineOpen || previewMode) return null

  function handleDragStart(event, index) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ index }))
  }

  function handleDragOver(event, index) {
    if (![...event.dataTransfer.types].includes(DRAG_TYPE)) return
    event.preventDefault()
    setDropIndex(index)
  }

  function handleDrop(event, toIndex) {
    event.preventDefault()
    const raw = event.dataTransfer.getData(DRAG_TYPE)
    setDropIndex(-1)
    if (!raw) return
    const { index: fromIndex } = JSON.parse(raw)
    if (fromIndex === toIndex) return
    onReorder?.(fromIndex, toIndex)
  }

  return (
    <nav className={styles.outline} aria-label="Proposal outline">
      <div className={styles.head}>
        <p className={styles.title}>Outline</p>
        <span className={styles.count}>{list.length}</span>
      </div>

      <label className={styles.search}>
        <Icon name="search" size={13} />
        <input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Jump to section…"
          aria-label="Search blocks"
        />
      </label>

      <ol className={styles.list}>
        {filtered.map((block) => {
          const meta = getBlockMeta(block.type)
          const index = list.findIndex((item) => item.id === block.id)
          const active = activeBlockId === block.id

          return (
            <li
              key={block.id}
              className={[
                styles.item,
                active && styles.itemActive,
                !block.enabled && styles.itemHidden,
                dropIndex === index && styles.itemDrop,
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!disabled}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={() => setDropIndex(-1)}
            >
              <button
                type="button"
                className={styles.row}
                onClick={() => scrollToBlock(block.id)}
              >
                <Icon name={meta.icon} size={13} />
                <span className={styles.label}>{meta.short}</span>
                {!block.enabled ? (
                  <span className={styles.hidden}>Hidden</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default BlockOutline
