import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon/Icon.jsx'
import { useEditorWorkspace } from '../../components/Editor/EditorWorkspaceContext.jsx'
import { useDragAutoscroll } from '../../hooks/useDragAutoscroll.js'
import {
  addBlock,
  duplicateBlock,
  makeBlock,
  reorderBlocks,
  removeBlock,
  setBlockEnabled,
  updateBlockData,
} from '../instance.js'
import { DEFAULT_CURRENCY } from '../../models/proposal.js'
import AddBlockPicker from './AddBlockPicker.jsx'
import BlockFields from './BlockFields.jsx'
import BlockHeader from './BlockHeader.jsx'
import BlockInsertSlot from './BlockInsertSlot.jsx'
import BlockMiniToolbar from './BlockMiniToolbar.jsx'
import styles from './BlockEditor.module.css'

const DRAG_TYPE = 'application/x-pf-block'

function setDragGhost(event, source) {
  const ghost = source.cloneNode(true)
  ghost.style.cssText =
    'position:absolute;top:-9999px;left:-9999px;width:280px;opacity:0.88;transform:rotate(1deg);pointer-events:none;box-shadow:0 18px 40px rgba(0,0,0,.35)'
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 24, 18)
  requestAnimationFrame(() => ghost.remove())
}

function BlockEditor({
  blocks,
  onChange,
  disabled = false,
  currency = DEFAULT_CURRENCY,
}) {
  const list = blocks ?? []
  const {
    previewMode,
    activeBlockId,
    setActiveBlockId,
    scrollToBlock,
    expandedIds,
    setExpandedIds,
    toggleExpanded,
    collapseAll,
  } = useEditorWorkspace()

  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const listRef = useRef(null)
  const seededExpand = useRef(false)
  useDragAutoscroll(Boolean(dragId))

  useEffect(() => {
    if (seededExpand.current || list.length === 0) return
    seededExpand.current = true
    setExpandedIds(new Set(list.filter((b) => b.enabled).map((b) => b.id)))
  }, [list, setExpandedIds])

  function update(next) {
    onChange(next)
  }

  function handleToggle(id) {
    toggleExpanded(id)
  }

  const handleAdd = useCallback(
    (type) => {
      const next = addBlock(list, type)
      const created = next[next.length - 1]
      setExpandedIds((prev) => new Set(prev).add(created.id))
      setActiveBlockId(created.id)
      update(next)
      requestAnimationFrame(() => scrollToBlock(created.id))
    },
    [list], // eslint-disable-line react-hooks/exhaustive-deps
  )

  function handleAddAtIndex(type, index) {
    const created = makeBlock({ type, enabled: true })
    const next = [...list]
    next.splice(index, 0, created)
    setExpandedIds((prev) => new Set(prev).add(created.id))
    setActiveBlockId(created.id)
    update(next)
  }

  function handleDuplicate(id) {
    const next = duplicateBlock(list, id)
    const original = list.findIndex((b) => b.id === id)
    if (original >= 0 && next[original + 1]) {
      setExpandedIds((prev) => new Set(prev).add(next[original + 1].id))
      setActiveBlockId(next[original + 1].id)
    }
    update(next)
  }

  function handleRemove(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    update(removeBlock(list, id))
  }

  function handleMove(index, offset) {
    const to = index + offset
    if (to < 0 || to >= list.length) return
    const id = list[index].id
    update(reorderBlocks(list, index, to))
    setActiveBlockId(id)
  }

  function handleToggleEnabled(id, enabled) {
    update(setBlockEnabled(list, id, enabled))
    if (enabled) setExpandedIds((prev) => new Set(prev).add(id))
  }

  function handleGripDragStart(event, block, index) {
    if (disabled) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: block.id, index }))
    const card = event.currentTarget.closest('[data-block-card]')
    if (card) setDragGhost(event, card)
    setDragId(block.id)
  }

  function handleDragOver(event, index) {
    if (![...event.dataTransfer.types].includes(DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget({ index, position })
  }

  function handleDrop(event, index) {
    event.preventDefault()
    const raw = event.dataTransfer.getData(DRAG_TYPE)
    if (!raw || !dropTarget) {
      handleDragEnd()
      return
    }
    const { index: fromIndex } = JSON.parse(raw)
    let toIndex = dropTarget.position === 'after' ? index + 1 : index
    if (fromIndex < toIndex) toIndex -= 1
    if (fromIndex !== toIndex) update(reorderBlocks(list, fromIndex, toIndex))
    handleDragEnd()
  }

  function handleDragEnd() {
    setDragId(null)
    setDropTarget(null)
  }

  useEffect(() => {
    const root = listRef.current
    if (!root) return undefined
    const cards = [...root.querySelectorAll('[data-block-id]')]
    if (cards.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.dataset?.blockId) {
          setActiveBlockId(visible.target.dataset.blockId)
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0.2, 0.5, 0.8] },
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [list, setActiveBlockId])

  if (previewMode) return null

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} data-editor-chrome>
        <div className={styles.toolbarCopy}>
          <h3 className={styles.heading}>Blocks</h3>
          <p className={styles.hint}>
            Hover a block for actions ·{' '}
            <kbd className={styles.kbd}>J</kbd>/<kbd className={styles.kbd}>K</kbd> to move ·{' '}
            <kbd className={styles.kbd}>Ctrl</kbd>
            <kbd className={styles.kbd}>K</kbd> to jump
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.ghost}
            onClick={collapseAll}
            disabled={disabled}
          >
            Collapse all
          </button>
          <AddBlockPicker onAdd={handleAdd} disabled={disabled} />
        </div>
      </div>

      <ol
        className={styles.list}
        ref={listRef}
        onDragOver={(event) => {
          if ([...event.dataTransfer.types].includes(DRAG_TYPE)) event.preventDefault()
        }}
      >
        {list.map((block, index) => {
          const expanded = expandedIds.has(block.id)
          const isDragging = dragId === block.id
          const isActive = activeBlockId === block.id
          const dropBefore =
            dropTarget?.index === index && dropTarget.position === 'before'
          const dropAfter =
            dropTarget?.index === index && dropTarget.position === 'after'

          return (
            <Fragment key={block.id}>
              <BlockInsertSlot
                onAdd={(type) => handleAddAtIndex(type, index)}
                disabled={disabled}
              />
              <li
                data-block-card
                data-block-id={block.id}
                tabIndex={0}
                className={[
                  styles.card,
                  !block.enabled && styles.cardDisabled,
                  isDragging && styles.cardDragging,
                  isActive && styles.cardActive,
                  dropBefore && styles.dropBefore,
                  dropAfter && styles.dropAfter,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={handleDragEnd}
                onFocus={() => setActiveBlockId(block.id)}
                onMouseDown={() => setActiveBlockId(block.id)}
              >
                <BlockMiniToolbar
                  block={block}
                  index={index}
                  total={list.length}
                  disabled={disabled}
                  onMove={(offset) => handleMove(index, offset)}
                  onDuplicate={() => handleDuplicate(block.id)}
                  onHide={() => handleToggleEnabled(block.id, !block.enabled)}
                  onDelete={() => handleRemove(block.id)}
                />

                <BlockHeader
                  block={block}
                  expanded={expanded}
                  disabled={disabled}
                  onToggle={() => handleToggle(block.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleToggle(block.id)
                    }
                  }}
                  gripProps={{
                    draggable: !disabled,
                    onDragStart: (event) => handleGripDragStart(event, block, index),
                    onDragEnd: handleDragEnd,
                  }}
                />

                <div
                  className={`${styles.cardBodyWrap} ${expanded ? styles.cardBodyOpen : ''}`}
                  aria-hidden={!expanded}
                >
                  <div className={styles.cardBody}>
                    <fieldset className={styles.fields} disabled={disabled}>
                      <BlockFields
                        block={block}
                        disabled={disabled}
                        currency={currency}
                        onData={(data) =>
                          update(updateBlockData(list, block.id, data))
                        }
                      />
                    </fieldset>
                  </div>
                </div>
              </li>
            </Fragment>
          )
        })}
        {list.length > 0 ? (
          <BlockInsertSlot onAdd={handleAdd} disabled={disabled} />
        ) : null}
      </ol>

      {list.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="blockCustom" size={32} />
          <p className={styles.emptyTitle}>No blocks yet</p>
          <p className={styles.emptyText}>
            Add your first block to start building this proposal.
          </p>
          <AddBlockPicker onAdd={handleAdd} disabled={disabled} />
        </div>
      ) : null}
    </div>
  )
}

export default BlockEditor
