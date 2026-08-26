import { useLocation } from 'react-router'
import { getPageTitle } from '../../navigation.js'
import styles from './Header.module.css'

function Header() {
  const { pathname } = useLocation()

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{getPageTitle(pathname)}</h1>
      <span className={styles.avatar} role="img" aria-label="Account">
        PF
      </span>
    </header>
  )
}

export default Header
