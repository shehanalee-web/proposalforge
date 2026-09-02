import { NavLink, useLocation } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import { listNavGroups } from '../../workspace/registry.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'
import { PATH } from '../../workspace/paths.js'
import { useCreateProposalDialog } from '../../hooks/useCreateProposalDialog.js'
import styles from './Sidebar.module.css'

function Sidebar() {
  const groups = listNavGroups()
  const { pathname } = useLocation()
  const { openStart } = useCreateProposalDialog()
  const createActive = pathname === PATH.NEW_PROPOSAL

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.mark}>
          <Icon name="logo" size={16} />
        </span>
        <span className={styles.wordmark}>ProposalForge</span>
      </div>

      <nav className={styles.navWrap} aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group.id} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.nav}>
              {group.modules.map((item) => (
                <li key={item.id}>
                  {item.id === WORKSPACE_MODULE.CREATE_PROPOSAL ? (
                    <button
                      type="button"
                      aria-label={item.label}
                      className={[
                        styles.link,
                        styles.linkCreate,
                        createActive ? styles.linkActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={openStart}
                    >
                      <Icon name={item.icon} className={styles.icon} />
                      <span className={styles.label}>{item.label}</span>
                    </button>
                  ) : (
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      aria-label={item.label}
                      className={({ isActive }) => {
                        const classes = [styles.link]
                        if (isActive) classes.push(styles.linkActive)
                        return classes.join(' ')
                      }}
                    >
                      <Icon name={item.icon} className={styles.icon} />
                      <span className={styles.label}>{item.label}</span>
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
