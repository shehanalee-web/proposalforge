import { useLocation } from 'react-router'
import { getPageTitle } from '../../navigation.js'
import { PATH } from '../../workspace/paths.js'
import { useCreateProposalDialog } from '../../hooks/useCreateProposalDialog.js'
import styles from './Header.module.css'

function Header() {
  const { pathname } = useLocation()
  const { openStart } = useCreateProposalDialog()
  const isCreateFlow =
    pathname === PATH.NEW_PROPOSAL || pathname === PATH.PROPOSAL_AI

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{getPageTitle(pathname)}</h1>
      <div className={styles.actions}>
        {isCreateFlow ? null : (
          <button type="button" className={styles.create} onClick={openStart}>
            Create proposal
          </button>
        )}
        <span className={styles.avatar} role="img" aria-label="Account">
          PF
        </span>
      </div>
    </header>
  )
}

export default Header
