import CommercialDocument from '../../components/CommercialBuilder/CommercialDocument.jsx'
import { getProposalCommercials } from '../../utils/commercialTotals.js'
import styles from './blocks.module.css'

function PricingTable({ proposal }) {
  const commercials = getProposalCommercials(proposal)

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Investment</h3>
      <CommercialDocument
        modules={commercials.modules}
        notes={commercials.notes}
        currency={proposal.currency}
      />
    </section>
  )
}

export default PricingTable
