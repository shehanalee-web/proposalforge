import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import { BRAND_FONTS } from '../../models/brandKit.js'
import {
  findTemplateForType,
  PROPOSAL_TYPES,
} from '../../models/proposalType.js'
import { MOCK_WORKSPACES } from '../../data/mockWorkspaces.js'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import { useTemplates } from '../../hooks/useTemplates.js'
import { proposalFromTemplate } from '../../utils/proposalFromTemplate.js'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './CreateProposal.module.css'

const STEPS = [
  { id: 1, label: 'Workspace' },
  { id: 2, label: 'Brand Kit' },
  { id: 3, label: 'Proposal type' },
]

const DEFAULT_CLIENT_NAME = 'New client'

function initialsFrom(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'PF'

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function fontLabel(fontFamily) {
  return BRAND_FONTS.find((font) => font.id === fontFamily)?.label ?? 'Inter'
}

function Stepper({ step, onSelect }) {
  return (
    <ol className={styles.stepper} aria-label="Creation steps">
      {STEPS.map((entry, index) => {
        const state =
          entry.id === step ? 'current' : entry.id < step ? 'done' : 'upcoming'
        const clickable = entry.id < step

        return (
          <li key={entry.id} className={styles.stepItem}>
            {index > 0 ? <span className={styles.stepRule} aria-hidden="true" /> : null}
            <button
              type="button"
              className={`${styles.step} ${
                state === 'current'
                  ? styles.stepCurrent
                  : state === 'done'
                    ? styles.stepDone
                    : ''
              }`}
              onClick={() => clickable && onSelect(entry.id)}
              disabled={!clickable}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles.stepIndex}>
                {state === 'done' ? <Icon name="check" size={14} /> : entry.id}
              </span>
              <span className={styles.stepLabel}>{entry.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function CreateProposal() {
  const navigate = useNavigate()
  const { kit, loading: kitLoading, error: kitError, refetch } = useBrandKit()
  const { templates, loading: templatesLoading } = useTemplates()
  const { create, submitting, error } = useCreateProposal()

  const [step, setStep] = useState(1)
  const [workspaceId, setWorkspaceId] = useState(null)
  const [creatingTypeId, setCreatingTypeId] = useState(null)

  const workspace = MOCK_WORKSPACES[0]
  const workspaceName = kit?.companyName?.trim() || workspace.name
  const logoUrl = kit?.logos?.primary?.url
  const requestError = error?.message || (error ? 'Could not create the proposal.' : null)

  function selectWorkspace() {
    setWorkspaceId(workspace.id)
    setStep(2)
  }

  function selectBrandKit() {
    setStep(3)
  }

  async function selectType(type) {
    if (submitting) return

    setCreatingTypeId(type.id)

    const template = findTemplateForType(templates, type)
    const extras = template ? proposalFromTemplate(template) : {}
    const created = await create({
      ...extras,
      title: extras.title || `${type.label} proposal`,
      clientName: extras.clientName?.trim() || DEFAULT_CLIENT_NAME,
      projectType: type.projectType,
      summary: extras.summary || type.description,
    })

    if (created) {
      navigate(proposalEditPath(created.id))
      return
    }

    setCreatingTypeId(null)
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>New document</p>
          <h2 className={styles.title}>Create a proposal</h2>
          <p className={styles.lede}>
            Choose the workspace and company identity, then generate a draft
            with AI or pick a proposal type.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link to={PATH.PROPOSAL_AI} className={styles.aiLink}>
            <Icon name="spark" size={16} />
            Generate with AI
          </Link>
          <Link to={PATH.DASHBOARD} className={styles.cancel}>
            Cancel
          </Link>
        </div>
      </header>

      <Stepper step={step} onSelect={setStep} />

      {workspaceId && step > 1 ? (
        <p className={styles.context}>
          <span>{workspaceName}</span>
          {step > 2 ? (
            <>
              <span className={styles.contextDot} aria-hidden="true">
                ·
              </span>
              <span>Company identity</span>
            </>
          ) : null}
        </p>
      ) : null}

      {requestError && step === 3 ? (
        <p className={styles.banner} role="alert">
          {requestError}
        </p>
      ) : null}

      {step === 1 ? (
        kitLoading ? (
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonCard} />
          </div>
        ) : (
          <div className={styles.choiceGrid}>
            <button
              type="button"
              className={`${styles.choice} ${styles.choiceWide}`}
              onClick={selectWorkspace}
            >
              <span className={styles.choiceMark} aria-hidden="true">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className={styles.choiceLogo} />
                ) : (
                  initialsFrom(workspaceName)
                )}
              </span>
              <span className={styles.choiceBody}>
                <span className={styles.choiceKicker}>Current workspace</span>
                <span className={styles.choiceTitle}>{workspaceName}</span>
                <span className={styles.choiceText}>{workspace.summary}</span>
              </span>
              <span className={styles.choiceHint}>Select</span>
            </button>
          </div>
        )
      ) : null}

      {step === 2 ? (
        kitError ? (
          <div className={styles.state}>
            <p className={styles.stateTitle}>Could not load Brand Kit</p>
            <p className={styles.stateText}>
              {kitError.message || 'Company identity is required to continue.'}
            </p>
            <button type="button" className={styles.retry} onClick={refetch}>
              Try again
            </button>
          </div>
        ) : kitLoading || !kit ? (
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonCard} />
          </div>
        ) : (
          <div className={styles.choiceGrid}>
            <button
              type="button"
              className={`${styles.choice} ${styles.choiceWide}`}
              onClick={selectBrandKit}
            >
              <span className={styles.choiceMark} aria-hidden="true">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className={styles.choiceLogo} />
                ) : (
                  initialsFrom(kit.companyName)
                )}
              </span>
              <span className={styles.choiceBody}>
                <span className={styles.choiceKicker}>Company identity</span>
                <span className={styles.choiceTitle}>
                  {kit.companyName || 'Untitled company'}
                </span>
                <span className={styles.choiceText}>
                  {kit.description ||
                    'Logos, colours and contact details inherited by every proposal.'}
                </span>
                <span className={styles.swatches} aria-hidden="true">
                  {[kit.colors?.primary, kit.colors?.secondary, kit.colors?.accent]
                    .filter(Boolean)
                    .map((color) => (
                      <span
                        key={color}
                        className={styles.swatch}
                        style={{ background: color }}
                      />
                    ))}
                  <span className={styles.swatchMeta}>
                    {fontLabel(kit.typography?.fontFamily)}
                    {kit.contact?.email ? ` · ${kit.contact.email}` : ''}
                  </span>
                </span>
              </span>
              <span className={styles.choiceHint}>Select</span>
            </button>
          </div>
        )
      ) : null}

      {step === 3 ? (
        templatesLoading && templates.length === 0 ? (
          <div className={styles.typeGrid} aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <div className={styles.typeGrid}>
            <button
              type="button"
              className={`${styles.choice} ${styles.choiceWide} ${styles.aiChoice}`}
              onClick={() => navigate(PATH.PROPOSAL_AI)}
            >
              <span className={styles.choiceMark} aria-hidden="true">
                <Icon name="spark" size={22} />
              </span>
              <span className={styles.choiceBody}>
                <span className={styles.choiceKicker}>AI wizard</span>
                <span className={styles.choiceTitle}>Generate with AI</span>
                <span className={styles.choiceText}>
                  Answer a few questions. We’ll draft the proposal, then open
                  the editor with it filled in.
                </span>
              </span>
              <span className={styles.choiceHint}>Start chat</span>
            </button>
            {PROPOSAL_TYPES.map((type) => {
              const creating = creatingTypeId === type.id
              const busy = submitting && creating

              return (
                <button
                  key={type.id}
                  type="button"
                  className={styles.typeCard}
                  style={{ '--type-accent': type.accent }}
                  onClick={() => selectType(type)}
                  disabled={submitting}
                  aria-busy={busy || undefined}
                >
                  <span className={styles.typeIcon} aria-hidden="true">
                    <Icon name={type.icon} size={22} />
                  </span>
                  <span className={styles.typeTitle}>{type.label}</span>
                  <span className={styles.typeText}>{type.description}</span>
                  <span className={styles.typeHint}>
                    {busy ? 'Creating…' : 'Create proposal'}
                  </span>
                </button>
              )
            })}
          </div>
        )
      ) : null}
    </section>
  )
}

export default CreateProposal
