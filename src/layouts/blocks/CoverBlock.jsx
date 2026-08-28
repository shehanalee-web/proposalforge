import Icon from '../../components/Icon/Icon.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { formatDate } from '../../utils/format.js'
import { LAYOUT_ID } from '../ids.js'
import { resolveCoverImage, resolveLogoUrl, studioNameFromBrand } from '../../blocks/brand.js'
import styles from './blocks.module.css'
import extra from '../../blocks/screen.module.css'

function MetaItem({ label, children }) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{children}</dd>
    </div>
  )
}

function CoverBlock({ proposal, settings, brand, layout, status }) {
  const studioName = studioNameFromBrand(brand, settings)
  const landscape = layout.id === LAYOUT_ID.LANDSCAPE
  const coverClass = landscape
    ? `${styles.cover} ${styles.coverLandscape}`
    : styles.cover
  const logoUrl = resolveLogoUrl(brand, 'light')
  const coverImage = resolveCoverImage(null, brand)

  return (
    <header className={coverClass}>
      <div className={styles.coverMain}>
        <div className={styles.brand}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className={extra.logo} />
          ) : (
            <span className={styles.mark}>
              <Icon name="logo" size={18} />
            </span>
          )}
          <span className={styles.studio}>{studioName}</span>
        </div>

        <p className={styles.kicker}>{proposal.projectType}</p>
        <h1 className={styles.coverTitle}>{proposal.title}</h1>
        {coverImage ? (
          <img src={coverImage} alt="" className={extra.coverImage} />
        ) : null}
      </div>

      <dl className={styles.meta}>
        <MetaItem label="Client">{proposal.clientName || '—'}</MetaItem>
        <MetaItem label="Status">
          <StatusBadge status={status ?? proposal.status} />
        </MetaItem>
        <MetaItem label="Date">{formatDate(proposal.createdAt)}</MetaItem>
        <MetaItem label="Valid until">{formatDate(proposal.validUntil)}</MetaItem>
      </dl>
    </header>
  )
}

export default CoverBlock
