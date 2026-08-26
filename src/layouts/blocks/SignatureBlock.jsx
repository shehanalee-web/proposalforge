import { formatDate } from '../../utils/format.js'
import styles from './blocks.module.css'

function SignatureBlock({ proposal, settings }) {
  const studioName = settings?.studioName?.trim() || 'ProposalForge'
  const accepted = Boolean(proposal.acceptedAt)

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Acceptance</h3>
      <div className={styles.signature}>
        <div className={styles.signCol}>
          <p className={styles.metaLabel}>Client</p>
          <p className={styles.signLine}>
            {accepted ? proposal.clientName || 'Accepted' : ''}
          </p>
          <p className={styles.signHint}>
            {accepted
              ? `Signed ${formatDate(proposal.acceptedAt)}`
              : 'Signature'}
          </p>
        </div>
        <div className={styles.signCol}>
          <p className={styles.metaLabel}>Studio</p>
          <p className={styles.signLine}>{studioName}</p>
          <p className={styles.signHint}>Authorised representative</p>
        </div>
      </div>
    </section>
  )
}

export default SignatureBlock
