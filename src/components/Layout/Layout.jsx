import { Outlet } from 'react-router'
import Sidebar from '../Sidebar/Sidebar.jsx'
import Header from '../Header/Header.jsx'
import styles from './Layout.module.css'

function Layout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
