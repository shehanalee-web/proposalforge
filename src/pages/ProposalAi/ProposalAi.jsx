import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import {
  collectedSections,
  hasPricing,
  isDraftReady,
} from '../../models/proposalDraft.js'
import {
  createWizardSession,
  isConversationComplete,
  replyToUser,
} from '../../services/aiWizard.js'
import { formatCurrency } from '../../utils/format.js'
import { proposalFromDraft } from '../../utils/proposalFromDraft.js'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './ProposalAi.module.css'

const PLACEHOLDER = '—'
const THINKING_MS = 550
const AUTO_CREATE_MS = 800

function displayValue(value) {
  const text = String(value ?? '').trim()
  return text || PLACEHOLDER
}

function PreviewCard({ draft, ready, generating, complete, error, onGenerate }) {
  const sections = collectedSections(draft)
  const price = hasPricing(draft)
    ? formatCurrency(draft.pricing.amount, draft.pricing.currency)
    : PLACEHOLDER
  const client = draft.client || draft.company

  return (
    <aside className={styles.preview} aria-label="Proposal preview">
      <div className={styles.card}>
        <p className={styles.cardKicker}>Live preview</p>
        <h2 className={styles.cardTitle}>{displayValue(draft.title)}</h2>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Client</dt>
            <dd>{displayValue(client)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Project type</dt>
            <dd>{displayValue(draft.projectType)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Estimated price</dt>
            <dd>{price}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Timeline</dt>
            <dd>{displayValue(draft.timeline)}</dd>
          </div>
        </dl>

        <div className={styles.sections}>
          <p className={styles.sectionsLabel}>Sections collected</p>
          {sections.length === 0 ? (
            <p className={styles.sectionsEmpty}>
              Answers will land here as we go.
            </p>
          ) : (
            <ul className={styles.chips}>
              {sections.map((section) => (
                <li key={section} className={styles.chip}>
                  {section}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.generate}
        onClick={onGenerate}
        disabled={!ready || generating}
      >
        {generating ? 'Generating…' : 'Generate Proposal'}
      </button>
      <p className={styles.generateHint}>
        {generating || complete
          ? 'Creating the proposal and opening the editor…'
          : ready
            ? 'You can generate now, or finish the remaining questions and we will open the editor automatically.'
            : 'A few more answers and this will unlock.'}
      </p>
    </aside>
  )
}

function ProposalAi() {
  const navigate = useNavigate()
  const { create, submitting, error } = useCreateProposal()
  const [session, setSession] = useState(createWizardSession)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)
  const timerRef = useRef(0)
  const autoRef = useRef(false)
  const draftRef = useRef(session.draft)

  const ready = isDraftReady(session.draft)
  const complete = isConversationComplete(session)
  const requestError =
    error?.message || (error ? 'Could not create the proposal.' : null)

  useEffect(() => {
    draftRef.current = session.draft
  }, [session.draft])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [session.messages, thinking])

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current)
  }, [])

  async function createFromDraft(draft = draftRef.current) {
    const created = await create(proposalFromDraft(draft))

    if (created) {
      navigate(proposalEditPath(created.id), { replace: true })
      return created
    }

    autoRef.current = false
    return null
  }

  function send(text) {
    const value = text.trim()
    if (!value || thinking || submitting) return

    setInput('')
    setSession((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: value,
        },
      ],
    }))
    setThinking(true)

    timerRef.current = window.setTimeout(() => {
      let finished = false
      let finishedDraft = draftRef.current

      setSession((current) => {
        const next = replyToUser(current, value, { includeUser: false })
        finished = isConversationComplete(next)
        finishedDraft = next.draft
        return next
      })
      setThinking(false)

      if (finished && !autoRef.current) {
        autoRef.current = true
        timerRef.current = window.setTimeout(() => {
          createFromDraft(finishedDraft)
        }, AUTO_CREATE_MS)
      }
    }, THINKING_MS)
  }

  function handleSubmit(event) {
    event.preventDefault()
    send(input)
  }

  async function handleGenerate() {
    if (!ready || submitting) return
    autoRef.current = true
    await createFromDraft()
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <Icon name="spark" size={16} />
          </span>
          <div>
            <p className={styles.kicker}>Create proposal</p>
            <h1 className={styles.heading}>AI Proposal Wizard</h1>
          </div>
        </div>
        <Link to={PATH.DASHBOARD} className={styles.close}>
          Back
        </Link>
      </header>

      <div className={styles.stage}>
        <section className={styles.chat} aria-label="AI conversation">
          <div className={styles.transcript}>
            <div className={styles.messages} aria-live="polite">
              {session.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? `${styles.bubble} ${styles.bubbleUser}`
                      : `${styles.bubble} ${styles.bubbleAssistant}`
                  }
                >
                  <p className={styles.bubbleRole}>
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </p>
                  <p className={styles.bubbleText}>{message.text}</p>
                </div>
              ))}
              {thinking ? (
                <div
                  className={`${styles.bubble} ${styles.bubbleAssistant}`}
                  aria-label="Assistant is typing"
                >
                  <p className={styles.bubbleRole}>Assistant</p>
                  <p className={styles.typing}>
                    <span />
                    <span />
                    <span />
                  </p>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <form className={styles.composer} onSubmit={handleSubmit}>
            <label className={styles.srOnly} htmlFor="wizard-reply">
              Reply
            </label>
            <textarea
              id="wizard-reply"
              className={styles.input}
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send(input)
                }
              }}
              placeholder="Answer in a sentence…"
              autoComplete="off"
              autoFocus
              disabled={thinking || submitting || complete}
            />
            <button
              type="submit"
              className={styles.send}
              disabled={!input.trim() || thinking || submitting || complete}
            >
              Send
            </button>
          </form>
        </section>

        <PreviewCard
          draft={session.draft}
          ready={ready}
          generating={submitting}
          complete={complete}
          error={requestError}
          onGenerate={handleGenerate}
        />
      </div>
    </div>
  )
}

export default ProposalAi
