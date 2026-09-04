import { useMemo, useState } from 'react'
import { getLayout } from '../../layouts/registry.js'
import { formatCurrency } from '../../utils/format.js'
import styles from './VersionCompare.module.css'

const EMPTY = ''
const LONG_TEXT = 80

function asText(value, key) {
  if (value == null || value === '') return EMPTY

  if (key === 'pricing') {
    return formatCurrency(value.amount, value.currency)
  }

  if (key === 'sections') {
    if (!value.length) return EMPTY

    return value
      .map((section, index) => {
        const heading = section.heading?.trim() || `Section ${index + 1}`
        const body = section.body?.trim() || ''
        return body ? `${heading}\n${body}` : heading
      })
      .join('\n\n')
  }

  if (key === 'items') {
    if (!value.length) return EMPTY

    return value
      .map((item) => {
        const description = item.description?.trim() || 'Item'
        return `${description} — ${formatCurrency(item.amount)}`
      })
      .join('\n')
  }

  if (key === 'layout') {
    return value ? getLayout(value).label : EMPTY
  }

  if (key === 'blocks' || key === 'blocksAdded' || key === 'blocksRemoved') {
    if (!value.length) return EMPTY

    return value
      .map((block) => {
        const state = block.enabled === false ? 'Off' : 'On'
        const heading =
          block.data?.heading?.trim() ||
          block.data?.kicker?.trim() ||
          block.data?.body?.trim()?.slice(0, 48) ||
          block.type
        return `${block.type} (${state}) — ${heading}`
      })
      .join('\n')
  }

  if (key === 'questionnaire') {
    if (!value) return EMPTY
    const status = value.status ? `Status: ${value.status}` : ''
    const questions = (value.questions ?? []).map(
      (question) => question.title?.trim() || question.id || 'Untitled question',
    )
    return [status, ...questions].filter(Boolean).join('\n')
  }

  if (key === 'responses') {
    if (!value.length) return EMPTY
    return value
      .map((response) => `${response.questionId}: ${JSON.stringify(response.value ?? null)}`)
      .join('\n')
  }

  if (key === 'uploads' || key === 'filesAdded' || key === 'filesRemoved') {
    if (!value.length) return EMPTY
    return value.map((file) => file.name || file.id || 'Untitled file').join('\n')
  }

  return String(value)
}

function isBlank(value) {
  return value == null || String(value).trim() === ''
}

function changeKind(row, left, right) {
  if (row.key === 'blocksAdded' || row.key === 'filesAdded') return 'added'
  if (row.key === 'blocksRemoved' || row.key === 'filesRemoved') return 'removed'
  if (isBlank(left) && !isBlank(right)) return 'added'
  if (!isBlank(left) && isBlank(right)) return 'removed'
  return 'changed'
}

function tokenize(value) {
  return String(value).split(/(\s+)/).filter((part) => part.length > 0)
}

function diffParts(left, right) {
  const a = tokenize(left)
  const b = tokenize(right)
  if (a.length * b.length > 16000) {
    return [
      { type: 'removed', text: left },
      { type: 'added', text: right },
    ]
  }

  const rows = a.length
  const cols = b.length
  const dp = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0))

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const parts = []
  let i = rows
  let j = cols
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      parts.push({ type: 'eq', text: a[i - 1] })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.push({ type: 'added', text: b[j - 1] })
      j -= 1
    } else {
      parts.push({ type: 'removed', text: a[i - 1] })
      i -= 1
    }
  }

  return parts.reverse()
}

function isLongParagraph(left, right) {
  return (
    left.length >= LONG_TEXT ||
    right.length >= LONG_TEXT ||
    left.includes('\n') ||
    right.includes('\n')
  )
}

function InlineDiff({ left, right }) {
  const parts = useMemo(() => diffParts(left, right), [left, right])

  return (
    <p className={styles.inline}>
      {parts.map((part, index) => (
        <span
          key={`${part.type}-${index}`}
          className={part.type === 'eq' ? undefined : styles[part.type]}
        >
          {part.text}
        </span>
      ))}
    </p>
  )
}

function VersionCompare({
  rows,
  leftLabel = 'Version A',
  rightLabel = 'Version B',
}) {
  const [showUnchanged, setShowUnchanged] = useState(false)
  const changedRows = rows.filter((row) => row.changed)
  const visible = showUnchanged ? rows : changedRows
  const identical = changedRows.length === 0

  return (
    <div className={styles.compare}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={showUnchanged}
          onChange={(event) => setShowUnchanged(event.target.checked)}
        />
        Show unchanged fields
      </label>

      {identical ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No differences between these versions</p>
          <p className={styles.emptyHint}>
            {showUnchanged
              ? 'These snapshots match. Unchanged fields are listed below for reference.'
              : 'These snapshots match. Turn on unchanged fields if you want to review the full document.'}
          </p>
        </div>
      ) : null}

      {identical && !showUnchanged ? null : (
        <div className={styles.fields}>
          <div className={`${styles.heading} ${styles.current}`}>{leftLabel}</div>
          <div className={`${styles.heading} ${styles.selected}`}>{rightLabel}</div>

          {visible.map((row) => {
            const left = asText(row.current, row.key)
            const right = asText(row.selected, row.key)
            const kind = row.changed ? changeKind(row, left, right) : 'same'
            const inline =
              row.changed &&
              kind === 'changed' &&
              isLongParagraph(left, right)

            return (
              <section
                key={row.key}
                className={`${styles.row} ${styles[kind] ?? ''}`}
              >
                <h4 className={styles.label}>{row.label}</h4>
                {inline ? (
                  <div className={styles.inlineWrap}>
                    <InlineDiff left={left} right={right} />
                  </div>
                ) : (
                  <>
                    <pre className={`${styles.value} ${styles.current}`}>
                      {left || '—'}
                    </pre>
                    <pre className={`${styles.value} ${styles.selected}`}>
                      {right || '—'}
                    </pre>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VersionCompare
