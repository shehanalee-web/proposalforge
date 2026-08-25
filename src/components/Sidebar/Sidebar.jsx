import { NavLink } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import { NAV_ITEMS } from '../../navigation.js'
import styles from './Sidebar.module.css'

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.mark}>
          <Icon name="logo" size={16} />
        </span>
        <span className={styles.wordmark}>ProposalForge</span>
      </div>

      <nav aria-label="Main navigation">
        <ul className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
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
      </nav>
    </aside>
  )
}

export default Sidebar
