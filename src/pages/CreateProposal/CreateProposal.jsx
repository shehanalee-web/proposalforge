import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../../components/Icon/Icon.jsx'
import SearchBar from '../../components/ServiceBrowser/SearchBar.jsx'
import IndustryFilter from '../../components/ServiceBrowser/IndustryFilter.jsx'
import EmptyState from '../../components/ServiceBrowser/EmptyState.jsx'
import ServiceCount from '../../components/ServiceBrowser/ServiceCount.jsx'
import { BRAND_FONTS } from '../../models/brandKit.js'
import { findTemplateForService } from '../../models/service.js'
import { MOCK_WORKSPACES } from '../../data/mockWorkspaces.js'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { useCreateProposal } from '../../hooks/useCreateProposal.js'
import { useServices } from '../../hooks/useServices.js'
import { useTemplates } from '../../hooks/useTemplates.js'
import { proposalFromTemplate } from '../../utils/proposalFromTemplate.js'
import { filterServices } from '../../utils/serviceDiscovery.js'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './CreateProposal.module.css'

const STEPS = [
  { id: 1, label: 'Workspace' },
  { id: 2, label: 'Brand Kit' },
  { id: 3, label: 'Service' },
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
  const { services, loading: servicesLoading, error: servicesError, refetch: refetchServices } =
    useServices()
  const { create, submitting, error } = useCreateProposal()

  const [step, setStep] = useState(1)
  const [workspaceId, setWorkspaceId] = useState(null)
  const [creatingServiceId, setCreatingServiceId] = useState(null)
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceIndustry, setServiceIndustry] = useState('')
  /* Index of the keyboard-focused service card (-1 = none). */
  const [focusedCard, setFocusedCard] = useState(-1)
  const cardGridRef = useRef(null)

  const visibleServices = useMemo(
    () =>
      filterServices(services, {
        search: serviceQuery,
        industry: serviceIndustry,
      }),
    [services, serviceQuery, serviceIndustry],
  )

  /* Reset focused card whenever the visible set changes. */
  const prevVisibleLen = useRef(visibleServices.length)
  if (prevVisibleLen.current !== visibleServices.length) {
    prevVisibleLen.current = visibleServices.length
    setFocusedCard(-1)
  }

  const clearFilters = useCallback(() => {
    setServiceQuery('')
    setServiceIndustry('')
  }, [])

  function handleCardGridKeyDown(event) {
    const count = visibleServices.length
    if (count === 0) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = focusedCard < count - 1 ? focusedCard + 1 : 0
      setFocusedCard(next)
      cardGridRef.current?.querySelectorAll('[data-service-card]')[next]?.focus()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = focusedCard > 0 ? focusedCard - 1 : count - 1
      setFocusedCard(prev)
      cardGridRef.current?.querySelectorAll('[data-service-card]')[prev]?.focus()
    }
  }

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

  async function selectService(service) {
    if (submitting) return

    setCreatingServiceId(service.id)

    const template = findTemplateForService(templates, service)
    const extras = template ? proposalFromTemplate(template, service) : {}
    const created = await create({
      ...extras,
      title: extras.title || `${service.name} proposal`,
      clientName: extras.clientName?.trim() || DEFAULT_CLIENT_NAME,
      projectType: service.name,
      serviceIds: [service.id],
      summary:
        extras.summary ||
        service.defaultDescription ||
        service.description,
    })

    if (created) {
      navigate(proposalEditPath(created.id))
      return
    }

    setCreatingServiceId(null)
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>New document</p>
          <p className={styles.lede}>
            Choose the workspace and company identity, then generate a draft
            with AI or pick a service.
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
        servicesError ? (
          <div className={styles.state}>
            <p className={styles.stateTitle}>Could not load services</p>
            <p className={styles.stateText}>
              {servicesError.message ||
                'The Service Library is required to start a proposal.'}
            </p>
            <button type="button" className={styles.retry} onClick={refetchServices}>
              Try again
            </button>
          </div>
        ) : (servicesLoading && services.length === 0) ||
          (templatesLoading && templates.length === 0) ? (
          <div className={styles.typeGrid} aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={styles.skeletonCard} />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className={styles.state}>
            <p className={styles.stateTitle}>No services yet</p>
            <p className={styles.stateText}>
              Add an offering in the Service Library, then come back to create
              a proposal from it.
            </p>
            <Link to={PATH.SERVICES} className={styles.retry}>
              Open services
            </Link>
          </div>
        ) : (
          <div className={styles.serviceStep}>
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
            </div>

            <div className={styles.browser}>
              {/* Section header */}
              <div className={styles.browserHeader}>
                <div className={styles.browserHeading}>
                  <p className={styles.browserTitle}>Browse Services</p>
                  <p className={styles.browserDesc}>
                    Choose a proposal template or search by industry.
                  </p>
                </div>
                <ServiceCount count={visibleServices.length} />
              </div>

              {/* Toolbar: search + industry */}
              <div className={styles.browserToolbar} role="search">
                <SearchBar
                  value={serviceQuery}
                  onChange={setServiceQuery}
                />
                <IndustryFilter
                  value={serviceIndustry}
                  onChange={setServiceIndustry}
                />
              </div>

              {/* Results */}
              {visibleServices.length === 0 ? (
                <EmptyState onClear={clearFilters} />
              ) : (
                <div
                  className={styles.typeGrid}
                  ref={cardGridRef}
                  onKeyDown={handleCardGridKeyDown}
                >
                  {visibleServices.map((service, index) => {
                    const creating = creatingServiceId === service.id
                    const busy = submitting && creating

                    return (
                      <button
                        key={service.id}
                        type="button"
                        data-service-card
                        className={styles.typeCard}
                        style={
                          service.accent
                            ? { '--type-accent': service.accent }
                            : undefined
                        }
                        onClick={() => selectService(service)}
                        onFocus={() => setFocusedCard(index)}
                        disabled={submitting}
                        aria-busy={busy || undefined}
                      >
                        <span className={styles.typeIcon} aria-hidden="true">
                          <Icon name={service.icon || 'services'} size={22} />
                        </span>
                        <span className={styles.typeTitle}>{service.name}</span>
                        <span className={styles.typeText}>
                          {service.description}
                        </span>
                        <span className={styles.typeHint}>
                          {busy ? 'Creating…' : 'Create proposal'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      ) : null}
    </section>
  )
}

export default CreateProposal
