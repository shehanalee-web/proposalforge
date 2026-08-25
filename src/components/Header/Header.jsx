import { useLocation } from 'react-router'
import { NAV_ITEMS } from '../../navigation.js'
import styles from './Header.module.css'

function Header() {
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((item) => item.to === pathname)

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{current ? current.label : 'Dashboard'}</h1>
      <span className={styles.avatar} role="img" aria-label="Account">
        PF
      </span>
    </header>
  )
}

export default Header
