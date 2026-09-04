import Icon from '../components/Icon/Icon.jsx'
import { listPortalModules, PORTAL_MODULE, PORTAL_MODULE_STATUS } from '../models/portalModules.js'
import { hasCapability } from '../models/portalPermissions.js'
import { isQuestionnaireSubmitted } from '../models/questionnaire.js'
import { questionnaireProgress } from '../forms/progress.js'
import { countOpenThreads } from '../collaboration/threads.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalAside.module.css'

function moduleBadge(module, live, proposal) {
  if (live && module.id === PORTAL_MODULE.QUESTIONNAIRE) {
    return isQuestionnaireSubmitted(proposal.questionnaire) ? 'Submitted' : 'Open'
  }
  if (live && module.id === PORTAL_MODULE.COMMENTS) {
    const open = countOpenThreads(proposal.comments, { clientVisibleOnly: true })
    return open > 0 ? `${open} open` : 'Open'
  }
  if (module.status === PORTAL_MODULE_STATUS.LIVE) return 'Not on this proposal'
  return 'Coming later'
}

function PortalModules({ onOpenModule }) {
  const { capabilities, proposal } = usePortal()
  const modules = listPortalModules()
  const liveIds = modules.filter(
    (module) =>
      module.status === PORTAL_MODULE_STATUS.LIVE &&
      hasCapability(capabilities, module.capability),
  )
  const soon = modules.filter((module) => !liveIds.includes(module))

  return (
    <>
      {liveIds.length > 0 ? (
        <section className={styles.panel} aria-labelledby="portal-tools-heading">
          <header className={styles.head}>
            <p className={styles.kicker} id="portal-tools-heading">
              Client tools
            </p>
          </header>
          <ul className={styles.modules}>
            {liveIds.map((module) => {
              const progress = questionnaireProgress(proposal.questionnaire)
              return (
                <li key={module.id}>
                  <button
                    type="button"
                    className={`${styles.module} ${styles.moduleLive}`}
                    data-ready="true"
                    onClick={() => onOpenModule?.(module.id)}
                  >
                    <span className={styles.moduleIcon}>
                      <Icon name={module.icon} size={15} />
                    </span>
                    <div>
                      <p className={styles.moduleTitle}>{module.label}</p>
                      <p className={styles.moduleCopy}>{module.description}</p>
                      {module.id === PORTAL_MODULE.QUESTIONNAIRE ? (
                        <p className={styles.moduleCopy}>
                          {progress.percent}% complete
                        </p>
                      ) : null}
                    </div>
                    <span className={styles.soon}>{moduleBadge(module, true, proposal)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {soon.length > 0 ? (
      <section className={styles.panel} aria-labelledby="portal-modules-heading">
        <header className={styles.head}>
          <p className={styles.kicker} id="portal-modules-heading">
            Coming next
          </p>
        </header>
        <p className={styles.hint}>
          These stay on the page as placeholders. Later milestones plug in without
          changing this portal.
        </p>
        <ul className={styles.modules}>
          {soon.map((module) => (
            <li key={module.id}>
              <article
                className={styles.module}
                data-ready="false"
                aria-disabled="true"
              >
                <span className={styles.moduleIcon}>
                  <Icon name={module.icon} size={15} />
                </span>
                <div>
                  <p className={styles.moduleTitle}>{module.label}</p>
                  <p className={styles.moduleCopy}>{module.description}</p>
                </div>
                <span className={styles.soon}>
                  {moduleBadge(module, false, proposal)}
                </span>
              </article>
            </li>
          ))}
        </ul>
      </section>
      ) : null}
    </>
  )
}

export default PortalModules
