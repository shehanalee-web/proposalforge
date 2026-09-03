import { formatDate } from '../../utils/format.js'
import { signatoryFromBrand } from '../../blocks/brand.js'
import styles from './blocks.module.css'
import extra from '../../blocks/screen.module.css'

function SignatureBlock({ proposal, settings, brand }) {
  const studioName = signatoryFromBrand(brand, settings)
  const role = brand?.signature?.role?.trim() || 'Authorised representative'
  const signatureImage = brand?.signature?.imageUrl
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
          {signatureImage ? (
            <img src={signatureImage} alt="" className={extra.signatureMark} />
          ) : null}
          <p className={styles.signLine}>{studioName}</p>
          <p className={styles.signHint}>{role}</p>
        </div>
      </div>
    </section>
  )
}

export default SignatureBlock
