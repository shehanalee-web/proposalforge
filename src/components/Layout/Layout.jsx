import { Outlet } from 'react-router'
import Sidebar from '../Sidebar/Sidebar.jsx'
import Header from '../Header/Header.jsx'
import { CreateProposalProvider } from '../CreateProposal/CreateProposalContext.jsx'
import CreateProposalDialog from '../CreateProposal/CreateProposalDialog.jsx'
import StartProposalDialog from '../CreateProposal/StartProposalDialog.jsx'
import ActivityToasts from '../Activity/ActivityToasts.jsx'
import { bindNotificationPersistence } from '../../services/notificationService.js'
import styles from './Layout.module.css'

bindNotificationPersistence()

function Layout() {
  return (
    <CreateProposalProvider>
      <div className={styles.shell}>
        <Sidebar />
        <Header />
        <main className={styles.main}>
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
      <StartProposalDialog />
      <CreateProposalDialog />
      <ActivityToasts />
    </CreateProposalProvider>
  )
}

export default Layout
