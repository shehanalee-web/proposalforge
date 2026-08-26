import { NavLink } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import { listNavGroups } from '../../workspace/registry.js'
import styles from './Sidebar.module.css'

function Sidebar() {
  const groups = listNavGroups()

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
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                    }
                  >
                    <Icon name={item.icon} className={styles.icon} />
                    <span className={styles.label}>{item.label}</span>
                  </NavLink>
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
