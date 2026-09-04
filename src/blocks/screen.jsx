import Icon from '../components/Icon/Icon.jsx'
import StatusBadge from '../components/StatusBadge/StatusBadge.jsx'
import { useProposalTheme } from '../theme/ProposalThemeContext.jsx'
import { formatDate } from '../utils/format.js'
import { LAYOUT_ID } from '../layouts/ids.js'
import {
  getCommercialModules,
} from '../utils/commercialTotals.js'
import CommercialDocument from '../components/CommercialBuilder/CommercialDocument.jsx'
import {
  resolveCoverImage,
  resolveLogoUrl,
  resolvePaymentTerms,
  resolveTeamMembers,
  resolveTermsBody,
  resolveTestimonials,
  signatoryFromBrand,
  studioNameFromBrand,
} from './brand.js'
import { BLOCK_TYPE } from './ids.js'
import { isBlockDataEmpty } from './schemas.js'
import styles from '../layouts/blocks/blocks.module.css'
import extra from './screen.module.css'

function BlockFrame({ title, children }) {
  return (
    <section className={styles.block}>
      {title ? <h3 className={styles.blockTitle}>{title}</h3> : null}
      {children}
    </section>
  )
}

function MetaItem({ label, children }) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{children}</dd>
    </div>
  )
}

export function CoverScreen({ instance, proposal, brand, settings, layout, status }) {
  const data = instance.data
  const { tokens } = useProposalTheme()
  const studioName = studioNameFromBrand(brand, settings)
  const landscape = layout?.id === LAYOUT_ID.LANDSCAPE
  const cover = tokens.cover
  const coverClass = [
    styles.cover,
    landscape && styles.coverLandscape,
    cover.layout === 'split' && styles.coverSplit,
    cover.layout === 'full-bleed' && styles.coverBleed,
    cover.layout === 'minimal' && styles.coverMinimal,
    cover.imagePosition === 'top' && styles.coverImageTop,
    cover.imagePosition === 'background' && styles.coverImageBg,
    cover.gradient && styles.coverGradient,
    cover.pattern === 'dots' && styles.coverDots,
    cover.pattern === 'grid' && styles.coverGrid,
  ]
    .filter(Boolean)
    .join(' ')
  const heading = data.heading?.trim() || proposal.title
  const kicker = data.kicker?.trim() || proposal.projectType
  const logoUrl = resolveLogoUrl(brand, 'light')
  const coverImage = resolveCoverImage(instance, brand)

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

        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.coverTitle}>{heading}</h1>
        {data.subheading?.trim() ? (
          <p className={styles.body}>{data.subheading}</p>
        ) : null}
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

export function ExecutiveSummaryScreen({ instance }) {
  const body = instance.data.body?.trim()
  if (!body) return null

  return (
    <BlockFrame title="Executive summary">
      <p className={`${styles.body} ${styles.prewrap}`}>{body}</p>
    </BlockFrame>
  )
}

export function RichTextScreen({ instance }) {
  if (isBlockDataEmpty(BLOCK_TYPE.RICH_TEXT, instance.data)) return null

  return (
    <BlockFrame title={instance.data.heading?.trim() || 'Details'}>
      {instance.data.body?.trim() ? (
        <p className={`${styles.body} ${styles.prewrap}`}>{instance.data.body}</p>
      ) : null}
    </BlockFrame>
  )
}

export function GalleryScreen({ instance }) {
  const items = (instance.data.items ?? []).filter((item) => item.url?.trim())
  if (items.length === 0) return null

  return (
    <BlockFrame title="Gallery">
      <ul className={styles.gallery}>
        {items.map((item, index) => (
          <li key={item.id} className={styles.galleryItem}>
            <div className={styles.galleryFrame}>
              <img src={item.url} alt={item.caption || `Proposal image ${index + 1}`} />
            </div>
            {item.caption ? <p className={styles.galleryCaption}>{item.caption}</p> : null}
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

export function PricingScreen({ instance, proposal }) {
  const modules = getCommercialModules(instance, proposal)

  return (
    <BlockFrame title="Investment">
      <CommercialDocument
        modules={modules}
        notes={instance.data.notes}
        currency={proposal.currency}
      />
    </BlockFrame>
  )
}

export function TimelineScreen({ instance }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.title?.trim() || item.body?.trim(),
  )
  if (items.length === 0) return null

  return (
    <BlockFrame title="Timeline">
      <ol className={extra.stack}>
        {items.map((item) => (
          <li key={item.id} className={extra.stackItem}>
            {item.date ? <p className={styles.kicker}>{item.date}</p> : null}
            {item.title ? <h4 className={styles.sectionHeading}>{item.title}</h4> : null}
            {item.body ? <p className={styles.body}>{item.body}</p> : null}
          </li>
        ))}
      </ol>
    </BlockFrame>
  )
}

export function DeliverablesScreen({ instance }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.title?.trim() || item.body?.trim(),
  )
  if (items.length === 0) return null

  return (
    <BlockFrame title="Deliverables">
      <ul className={extra.stack}>
        {items.map((item) => (
          <li key={item.id} className={extra.stackItem}>
            {item.title ? <h4 className={styles.sectionHeading}>{item.title}</h4> : null}
            {item.body ? <p className={styles.body}>{item.body}</p> : null}
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

export function SpecificationsScreen({ instance }) {
  const rows = (instance.data.rows ?? []).filter(
    (row) => row.label?.trim() || row.value?.trim(),
  )
  if (rows.length === 0) return null

  return (
    <BlockFrame title="Specifications">
      <table className={styles.items}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label || '—'}</th>
              <td>{row.value || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BlockFrame>
  )
}

export function TeamScreen({ instance, brand }) {
  const members = resolveTeamMembers(instance, brand)
  if (members.length === 0) return null

  return (
    <BlockFrame title="Team">
      <ul className={extra.people}>
        {members.map((member) => (
          <li key={member.id} className={extra.person}>
            {member.photoUrl?.trim() ? (
              <img src={member.photoUrl} alt="" className={extra.portrait} />
            ) : null}
            <p className={styles.sectionHeading}>{member.name}</p>
            {member.role ? <p className={styles.kicker}>{member.role}</p> : null}
            {member.bio ? <p className={styles.body}>{member.bio}</p> : null}
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

export function TestimonialsScreen({ instance, brand }) {
  const items = resolveTestimonials(instance, brand)
  if (items.length === 0) return null

  return (
    <BlockFrame title="Testimonials">
      <ul className={extra.stack}>
        {items.map((item) => (
          <li key={item.id} className={extra.quote}>
            {item.portraitUrl?.trim() ? (
              <img src={item.portraitUrl} alt="" className={extra.portrait} />
            ) : null}
            <p className={styles.body}>“{item.quote}”</p>
            <p className={styles.galleryCaption}>
              {[item.authorName, item.authorRole, item.company]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

export function FaqScreen({ instance }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.question?.trim() || item.answer?.trim(),
  )
  if (items.length === 0) return null

  return (
    <BlockFrame title="FAQs">
      <dl className={extra.stack}>
        {items.map((item) => (
          <div key={item.id} className={extra.stackItem}>
            <dt className={styles.sectionHeading}>{item.question}</dt>
            <dd className={styles.body}>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </BlockFrame>
  )
}

export function TermsScreen({ instance, proposal, brand }) {
  const body = resolveTermsBody(instance, proposal, brand)
  const payment = resolvePaymentTerms(instance, proposal, brand)
  if (!body && !payment) return null

  return (
    <BlockFrame title="Terms & conditions">
      {body ? <p className={`${styles.body} ${styles.prewrap}`}>{body}</p> : null}
      {payment ? (
        <>
          <h3 className={styles.blockTitle}>Payment terms</h3>
          <p className={`${styles.body} ${styles.prewrap}`}>{payment}</p>
        </>
      ) : null}
    </BlockFrame>
  )
}

export function SignatureScreen({ instance, proposal, brand, settings }) {
  const studioName = signatoryFromBrand(brand, settings)
  const role = brand?.signature?.role?.trim() || 'Authorised representative'
  const signatureImage = brand?.signature?.imageUrl

  return (
    <section className={styles.signature}>
      <div className={styles.signCol}>
        <h3 className={styles.blockTitle}>{instance.data.clientLabel || 'Client'}</h3>
        <p className={styles.signLine}>{proposal.clientName}</p>
        <p className={styles.signHint}>Signature</p>
      </div>
      <div className={styles.signCol}>
        <h3 className={styles.blockTitle}>{instance.data.studioLabel || 'Studio'}</h3>
        {signatureImage ? (
          <img src={signatureImage} alt="" className={extra.signatureMark} />
        ) : null}
        <p className={styles.signLine}>{studioName}</p>
        <p className={styles.signHint}>{role}</p>
      </div>
    </section>
  )
}

export function AttachmentsScreen({ instance }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.name?.trim() || item.url?.trim(),
  )
  if (items.length === 0) return null

  return (
    <BlockFrame title="Attachments">
      <ul className={extra.stack}>
        {items.map((item) => (
          <li key={item.id}>
            {item.url ? (
              <a href={item.url} className={extra.file} target="_blank" rel="noreferrer">
                {item.name || item.url}
              </a>
            ) : (
              <span>{item.name}</span>
            )}
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

export function CustomScreen({ instance }) {
  if (isBlockDataEmpty(BLOCK_TYPE.CUSTOM, instance.data)) return null

  return (
    <BlockFrame title={instance.data.heading?.trim() || 'Custom'}>
      {instance.data.body?.trim() ? (
        <p className={`${styles.body} ${styles.prewrap}`}>{instance.data.body}</p>
      ) : null}
    </BlockFrame>
  )
}
