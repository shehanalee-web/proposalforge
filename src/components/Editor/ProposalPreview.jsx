import ProposalContent from '../ProposalContent/ProposalContent.jsx'
import styles from './ProposalPreview.module.css'

function ProposalPreview({ proposal }) {
  if (!proposal) return null

  return (
    <div className={styles.preview} data-preview>
      <p className={styles.kicker}>Client preview</p>
      <ProposalContent
        proposal={proposal}
        includeCover
        showNotes={false}
        showTags={false}
        showSignature
      />
    </div>
  )
}

export default ProposalPreview
