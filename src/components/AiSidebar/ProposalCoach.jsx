import { useId, useState } from 'react'
import { BUSINESS_PRIORITY_LABELS } from '../../intelligence/constants.js'
import {
  COACH_ACTION,
  COACH_ACTION_LABELS,
  COACH_MODES,
  COACH_MODE_LABELS,
} from '../../coach/index.js'
import { useProposalCoach } from '../../hooks/useProposalCoach.js'
import { useEditorWorkspace } from '../Editor/EditorWorkspaceContext.jsx'
import SidebarSection from './SidebarSection.jsx'
import styles from './ProposalCoach.module.css'

function openBlock(workspace, blockId) {
  if (!blockId) return
  workspace.toggleExpanded(blockId, true)
  workspace.setActiveBlockId(blockId)
  workspace.setInspectorOpen(true)
  workspace.scrollToBlock(blockId)
}

function priorityClass(priority) {
  if (priority === 'critical') return styles.critical
  if (priority === 'high') return styles.high
  if (priority === 'low') return styles.low
  return styles.medium
}

function CoachDetails({ item, expanded }) {
  if (!expanded) return null
  return (
    <div className={styles.details}>
      <p>
        <span className={styles.kicker}>Why ProposalForge flagged this</span>
        {item.flaggedBecause}
      </p>
      <p>
        <span className={styles.kicker}>Why it matters</span>
        {item.whyItMatters}
      </p>
      <p>
        <span className={styles.kicker}>What happens if ignored</span>
        {item.riskIfIgnored}
      </p>
      <p>
        <span className={styles.kicker}>What good looks like</span>
        {item.goodExample}
      </p>
      <p>
        <span className={styles.kicker}>Recommended next step</span>
        {item.recommendation}
      </p>
      <p className={styles.meta}>
        {item.sourceEngine}
        {item.findingType ? ` · ${item.findingType.replace(/_/g, ' ')}` : ''}
        {item.severity ? ` · ${item.severity}` : ''}
        {item.sectionLabel ? ` · ${item.sectionLabel}` : ''}
      </p>
    </div>
  )
}

function AiPanel({ item, replies, busy, errors, onAsk }) {
  const actions = [
    COACH_ACTION.ASK,
    COACH_ACTION.EXPLAIN_DEEPER,
    COACH_ACTION.ALTERNATIVES,
    COACH_ACTION.IMPROVE_SECTION,
    COACH_ACTION.SALES,
    COACH_ACTION.TECHNICAL,
  ]

  return (
    <div className={styles.ai}>
      <p className={styles.kicker}>AI Coach</p>
      <div className={styles.aiActions}>
        {actions.map((action) => {
          const key = `${item.id}:${action}`
          const pending = Boolean(busy[key])
          return (
            <button
              key={action}
              type="button"
              className={styles.action}
              onClick={() => onAsk(item, action)}
              aria-label={COACH_ACTION_LABELS[action]}
            >
              {pending ? 'Cancel' : COACH_ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>
      {actions.map((action) => {
        const key = `${item.id}:${action}`
        if (errors[key]) {
          return (
            <p key={key} className={styles.failed}>
              Generation failed. Try again.
            </p>
          )
        }
        if (!replies[key]) return null
        return (
          <p key={key} className={styles.reply}>
            {replies[key]}
          </p>
        )
      })}
    </div>
  )
}

function CoachCard({
  item,
  workspace,
  replies,
  busy,
  errors,
  onAsk,
  showAi,
  onToggleAi,
}) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()

  return (
    <article className={`${styles.card} ${priorityClass(item.priority)}`}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <span className={styles.priority}>
          {BUSINESS_PRIORITY_LABELS[item.priority] || item.priority}
        </span>
      </div>
      <p className={styles.copy}>{item.explanation}</p>
      <p className={styles.copy}>
        <span className={styles.kicker}>What to do</span>
        {item.recommendation}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={() => openBlock(workspace, item.blockId)}
          disabled={!item.blockId}
        >
          {item.nextAction}
        </button>
        <button
          type="button"
          className={styles.action}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Show less' : 'Learn More'}
        </button>
        {item.aiAvailable ? (
          <button
            type="button"
            className={styles.action}
            aria-expanded={showAi}
            onClick={onToggleAi}
          >
            {showAi ? 'Hide AI Coach' : 'Ask AI'}
          </button>
        ) : null}
      </div>
      <div id={detailsId} hidden={!open}>
        <CoachDetails item={item} expanded={open} />
      </div>
      {showAi && item.aiAvailable ? (
        <AiPanel
          item={item}
          replies={replies}
          busy={busy}
          errors={errors}
          onAsk={onAsk}
        />
      ) : null}
    </article>
  )
}

/**
 * Compact Proposal Coach. Consumes existing engine outputs; does not chat.
 */
function ProposalCoach({ proposal, blocks }) {
  const workspace = useEditorWorkspace()
  const {
    items,
    summary,
    mode,
    setMode,
    replies,
    busy,
    errors,
    ask,
  } = useProposalCoach(proposal, blocks)
  const [aiFor, setAiFor] = useState(null)
  const modeId = useId()
  const top = summary.topRecommendation
  const topOpenKey = top ? `summary:${top.id}` : ''
  const [summaryOpen, setSummaryOpen] = useState(false)

  function toggleAi(key, item) {
    if (!item?.aiAvailable) return
    if (aiFor === key) {
      setAiFor(null)
      return
    }
    setAiFor(key)
    ask(item, COACH_ACTION.ASK)
  }

  return (
    <SidebarSection
      title="Proposal Coach"
      icon="pen"
      badge={items.length || 'Ready'}
    >
      <div className={styles.root}>
        <div className={styles.modeRow}>
          <label htmlFor={modeId} className={styles.kicker}>
            Coaching mode
          </label>
          <select
            id={modeId}
            className={styles.select}
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {COACH_MODES.map((value) => (
              <option key={value} value={value}>
                {COACH_MODE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {top ? (
          <div className={`${styles.summary} ${priorityClass(top.priority)}`}>
            <p className={styles.kicker}>Top Recommendation</p>
            <p className={styles.headline}>{top.title}</p>
            <p className={styles.copy}>
              <span className={styles.kicker}>Why It Matters</span>
              {summary.whyItMatters}
            </p>
            <p className={styles.copy}>
              <span className={styles.kicker}>What To Do Next</span>
              {summary.nextAction}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={() => openBlock(workspace, top.blockId)}
                disabled={!top.blockId}
              >
                {top.nextAction}
              </button>
              <button
                type="button"
                className={styles.action}
                aria-expanded={summaryOpen}
                onClick={() => setSummaryOpen((value) => !value)}
              >
                {summaryOpen ? 'Show less' : 'Learn More'}
              </button>
              {top.aiAvailable ? (
                <button
                  type="button"
                  className={styles.action}
                  aria-expanded={aiFor === topOpenKey}
                  onClick={() => toggleAi(topOpenKey, top)}
                >
                  {aiFor === topOpenKey ? 'Hide AI Coach' : 'Ask AI'}
                </button>
              ) : null}
            </div>
            <CoachDetails item={top} expanded={summaryOpen} />
            {aiFor === topOpenKey && top.aiAvailable ? (
              <AiPanel
                item={top}
                replies={replies}
                busy={busy}
                errors={errors}
                onAsk={ask}
              />
            ) : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className={styles.list}>
            {items.map((item) => (
              <CoachCard
                key={item.id}
                item={item}
                workspace={workspace}
                replies={replies}
                busy={busy}
                errors={errors}
                onAsk={ask}
                showAi={aiFor === item.id}
                onToggleAi={() => toggleAi(item.id, item)}
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No outstanding coaching items on this draft.</p>
        )}
      </div>
    </SidebarSection>
  )
}

export default ProposalCoach
