import { formatDate } from '../utils/format.js'
import { useProposalTheme } from './ProposalThemeContext.jsx'
import styles from './DocumentChrome.module.css'

export function DocumentHeader({ proposal, brand }) {
  const { tokens } = useProposalTheme()
  const chrome = tokens.chrome
  if (!chrome.showLogo && !chrome.showCompany && !chrome.showNumber && !chrome.showConfidential) {
    return null
  }

  const logo =
    tokens.branding.logoLight ||
    tokens.branding.logo ||
    brand?.logos?.light ||
    brand?.logos?.primary ||
    ''

  return (
    <header
      className={styles.header}
      data-sticky={chrome.showLogo || chrome.showCompany ? tokens.page.stickyHeader : undefined}
    >
      <div className={styles.brand}>
        {chrome.showLogo && logo ? <img src={logo} alt="" className={styles.logo} /> : null}
        {chrome.showCompany ? (
          <p className={styles.company}>
            {tokens.metadata.preparedBy || brand?.companyName || 'ProposalForge'}
          </p>
        ) : null}
      </div>
      <div className={styles.meta}>
        {chrome.showNumber && tokens.metadata.number ? (
          <span>{tokens.metadata.number}</span>
        ) : null}
        {chrome.showConfidential && tokens.metadata.confidential ? (
          <span className={styles.badge}>Confidential</span>
        ) : null}
      </div>
    </header>
  )
}

export function DocumentFooter({ proposal }) {
  const { tokens } = useProposalTheme()
  const chrome = tokens.chrome
  if (
    !chrome.showFooterNotes &&
    !chrome.showExpiry &&
    !chrome.showPageNumbers &&
    !chrome.showConfidential
  ) {
    return null
  }

  return (
    <footer
      className={styles.footer}
      style={{ justifyContent: chrome.footerAlign }}
    >
      {chrome.showFooterNotes ? (
        <p>Prepared for {tokens.metadata.preparedFor || proposal?.clientName || 'the client'}</p>
      ) : null}
      {chrome.showExpiry && (tokens.metadata.expiryDate || proposal?.validUntil) ? (
        <p>Valid until {formatDate(tokens.metadata.expiryDate || proposal.validUntil)}</p>
      ) : null}
      {chrome.showPageNumbers ? <p>Page</p> : null}
    </footer>
  )
}
