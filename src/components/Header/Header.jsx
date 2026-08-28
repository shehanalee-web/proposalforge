import { Link, useLocation } from 'react-router'
import { getPageTitle } from '../../navigation.js'
import { PATH } from '../../workspace/paths.js'
import styles from './Header.module.css'

function Header() {
  const { pathname } = useLocation()
  const isCreateFlow = pathname === PATH.NEW_PROPOSAL

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{getPageTitle(pathname)}</h1>
      <div className={styles.actions}>
        {isCreateFlow ? null : (
          <Link to={PATH.NEW_PROPOSAL} className={styles.create}>
            Create proposal
          </Link>
        )}
        <span className={styles.avatar} role="img" aria-label="Account">
          PF
        </span>
      </div>
    </header>
  )
}

export default Header
