import { View, Text, Image, Link } from '@react-pdf/renderer'
import { formatCurrency } from '../utils/format.js'
import { getPricingRows, sumAmounts } from '../utils/proposalPricing.js'
import { studioNameFromBrand } from './brand.js'
import { BLOCK_TYPE } from './ids.js'
import { isBlockDataEmpty } from './schemas.js'
import { styles } from '../pdf/pdfStyles.js'

function titleStyle(brand) {
  const accent = brand?.colors?.accent
  return accent ? [styles.sectionTitle, { color: accent }] : styles.sectionTitle
}

function Section({ title, children, brand }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={titleStyle(brand)}>{title}</Text> : null}
      {children}
    </View>
  )
}

export function CoverPdf({ instance, proposal, brand, settings }) {
  const heading = instance.data.heading?.trim() || proposal.title
  const kicker = instance.data.kicker?.trim() || proposal.projectType
  const studioName = studioNameFromBrand(brand, settings)

  return (
    <View style={styles.section}>
      <Text style={titleStyle(brand)}>{studioName}</Text>
      {kicker ? <Text style={styles.projectType}>{kicker}</Text> : null}
      <Text style={styles.projectHeading}>{heading}</Text>
      {instance.data.subheading?.trim() ? (
        <Text style={styles.body}>{instance.data.subheading}</Text>
      ) : null}
    </View>
  )
}

export function ExecutiveSummaryPdf({ instance, brand }) {
  if (!instance.data.body?.trim()) return null

  return (
    <Section title="Executive summary" brand={brand}>
      <Text style={styles.body}>{instance.data.body}</Text>
    </Section>
  )
}

export function RichTextPdf({ instance }) {
  if (isBlockDataEmpty(BLOCK_TYPE.RICH_TEXT, instance.data)) return null

  return (
    <View style={styles.scopeBlock} wrap={false}>
      {instance.data.heading?.trim() ? (
        <Text style={styles.scopeHeading}>{instance.data.heading}</Text>
      ) : null}
      {instance.data.body?.trim() ? (
        <Text style={styles.body}>{instance.data.body}</Text>
      ) : null}
    </View>
  )
}

export function GalleryPdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter((item) => item.url?.trim())
  if (items.length === 0) return null

  return (
    <Section title="Gallery" brand={brand}>
      <View style={styles.galleryRow}>
        {items.slice(0, 6).map((item) => (
          <View key={item.id} style={styles.galleryItem}>
            <Image src={item.url} style={styles.galleryImage} />
            {item.caption ? (
              <Text style={styles.footerText}>{item.caption}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </Section>
  )
}

export function PricingPdf({ instance, proposal, brand }) {
  const fromBlock = instance.data.items ?? []
  const rows =
    fromBlock.length > 0
      ? fromBlock.map((item) => ({
          id: item.id,
          description: item.description,
          amount: Number(item.amount) || 0,
        }))
      : getPricingRows(proposal)
  const total = sumAmounts(rows)
  const currency = proposal.currency

  return (
    <Section title="Investment" brand={brand}>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.body, styles.colDesc]}>{row.description || '—'}</Text>
            <Text style={[styles.body, styles.colAmount]}>
              {formatCurrency(row.amount, currency)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.totals}>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(total, currency)}
          </Text>
        </View>
      </View>
    </Section>
  )
}

export function TimelinePdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.title?.trim() || item.body?.trim(),
  )
  if (items.length === 0) return null

  return (
    <Section title="Timeline" brand={brand}>
      {items.map((item) => (
        <View key={item.id} style={styles.scopeBlock} wrap={false}>
          <Text style={styles.scopeHeading}>
            {[item.date, item.title].filter(Boolean).join(' — ')}
          </Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </View>
      ))}
    </Section>
  )
}

export function DeliverablesPdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.title?.trim() || item.body?.trim(),
  )
  if (items.length === 0) return null

  return (
    <Section title="Deliverables" brand={brand}>
      {items.map((item) => (
        <View key={item.id} style={styles.scopeBlock} wrap={false}>
          {item.title ? <Text style={styles.scopeHeading}>{item.title}</Text> : null}
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </View>
      ))}
    </Section>
  )
}

export function SpecificationsPdf({ instance, brand }) {
  const rows = (instance.data.rows ?? []).filter(
    (row) => row.label?.trim() || row.value?.trim(),
  )
  if (rows.length === 0) return null

  return (
    <Section title="Specifications" brand={brand}>
      {rows.map((row) => (
        <View key={row.id} style={styles.tableRow}>
          <Text style={[styles.body, styles.colDesc]}>{row.label || '—'}</Text>
          <Text style={[styles.body, styles.colAmount]}>{row.value || '—'}</Text>
        </View>
      ))}
    </Section>
  )
}

export function TeamPdf({ instance, brand }) {
  const members = (instance.data.members ?? []).filter((member) => member.name?.trim())
  if (members.length === 0) return null

  return (
    <Section title="Team" brand={brand}>
      {members.map((member) => (
        <View key={member.id} style={styles.scopeBlock} wrap={false}>
          <Text style={styles.scopeHeading}>
            {member.role ? `${member.name} — ${member.role}` : member.name}
          </Text>
          {member.bio ? <Text style={styles.body}>{member.bio}</Text> : null}
        </View>
      ))}
    </Section>
  )
}

export function TestimonialsPdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter((item) => item.quote?.trim())
  if (items.length === 0) return null

  return (
    <Section title="Testimonials" brand={brand}>
      {items.map((item) => (
        <View key={item.id} style={styles.scopeBlock} wrap={false}>
          <Text style={styles.body}>“{item.quote}”</Text>
          <Text style={styles.muted}>
            {[item.authorName, item.authorRole, item.company]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ))}
    </Section>
  )
}

export function FaqPdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.question?.trim() || item.answer?.trim(),
  )
  if (items.length === 0) return null

  return (
    <Section title="FAQs" brand={brand}>
      {items.map((item) => (
        <View key={item.id} style={styles.scopeBlock} wrap={false}>
          <Text style={styles.scopeHeading}>{item.question}</Text>
          <Text style={styles.body}>{item.answer}</Text>
        </View>
      ))}
    </Section>
  )
}

export function TermsPdf({ instance, brand }) {
  if (!instance.data.body?.trim()) return null

  return (
    <Section title="Terms & conditions" brand={brand}>
      <Text style={styles.body}>{instance.data.body}</Text>
    </Section>
  )
}

export function SignaturePdf({ instance, proposal, brand, settings }) {
  const studioName = studioNameFromBrand(brand, settings)

  return (
    <View style={styles.section} wrap={false}>
      <Text style={titleStyle(brand)}>Acceptance</Text>
      <View style={styles.signatureRow}>
        <View style={styles.signatureCol}>
          <Text style={styles.metaLabel}>
            {instance.data.clientLabel || 'Client'}
          </Text>
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{proposal.clientName}</Text>
          </View>
          <Text style={styles.footerText}>Signature</Text>
        </View>
        <View style={styles.signatureCol}>
          <Text style={styles.metaLabel}>
            {instance.data.studioLabel || 'Studio'}
          </Text>
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{studioName}</Text>
          </View>
          <Text style={styles.footerText}>Authorised representative</Text>
        </View>
      </View>
    </View>
  )
}

export function AttachmentsPdf({ instance, brand }) {
  const items = (instance.data.items ?? []).filter(
    (item) => item.name?.trim() || item.url?.trim(),
  )
  if (items.length === 0) return null

  return (
    <Section title="Attachments" brand={brand}>
      {items.map((item) => (
        <Text key={item.id} style={styles.body}>
          {item.url ? (
            <Link src={item.url}>{item.name || item.url}</Link>
          ) : (
            item.name
          )}
        </Text>
      ))}
    </Section>
  )
}

export function CustomPdf({ instance, brand }) {
  if (isBlockDataEmpty(BLOCK_TYPE.CUSTOM, instance.data)) return null

  return (
    <Section title={instance.data.heading?.trim() || 'Custom'} brand={brand}>
      {instance.data.body?.trim() ? (
        <Text style={styles.body}>{instance.data.body}</Text>
      ) : null}
    </Section>
  )
}
