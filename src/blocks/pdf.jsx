import { View, Text, Image, Link } from '@react-pdf/renderer'
import {
  computeCommercials,
  formatMoney,
  getCommercialModules,
} from '../utils/commercialTotals.js'
import { TAX_MODE } from '../models/brandKit.js'
import { RECURRING_INTERVAL_LABELS } from '../models/commercial.js'
import {
  resolveCoverImage,
  resolvePaymentTerms,
  resolveTeamMembers,
  resolveTermsBody,
  resolveTestimonials,
  signatoryFromBrand,
  studioNameFromBrand,
} from './brand.js'
import { resolvePdfLogo } from '../pdf/pdfBrand.js'
import { BLOCK_TYPE } from './ids.js'
import { isBlockDataEmpty } from './schemas.js'
import { styles } from '../pdf/pdfStyles.js'
import { toAbsoluteUrl } from '../utils/publicUrl.js'

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
  const coverImage = resolveCoverImage(instance, brand)
  const logoUrl = resolvePdfLogo(brand, 'light')

  return (
    <View style={styles.section}>
      {logoUrl ? <Image src={logoUrl} style={styles.coverLogo} /> : null}
      <Text style={titleStyle(brand)}>{studioName}</Text>
      {kicker ? <Text style={styles.projectType}>{kicker}</Text> : null}
      <Text style={styles.projectHeading}>{heading}</Text>
      {instance.data.subheading?.trim() ? (
        <Text style={styles.body}>{instance.data.subheading}</Text>
      ) : null}
      {coverImage ? (
        <Image src={coverImage} style={styles.coverImage} />
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
  const modules = getCommercialModules(instance, proposal)
  const totals = computeCommercials(modules)
  const currency = proposal.currency
  const money = (value) => formatMoney(value, currency)

  function lineLabel(line) {
    const qty = Number(line.quantity) || 0
    const unit = line.unit?.trim()
    const extras = [
      qty !== 1 ? `× ${qty}` : null,
      unit || null,
      line.included === false ? 'optional' : null,
    ].filter(Boolean)
    const base = line.description || '—'
    return extras.length > 0 ? `${base} (${extras.join(' · ')})` : base
  }

  return (
    <Section title="Investment" brand={brand}>
      {totals.tableSections.map((section) => {
        const lines = section.lines.filter(
          (line) => line.description?.trim() || line.total > 0,
        )
        if (lines.length === 0) return null

        return (
          <View key={section.id} style={styles.table}>
            {section.title ? (
              <Text style={styles.scopeHeading}>{section.title}</Text>
            ) : null}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
            </View>
            {lines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={[styles.body, styles.colDesc]}>{lineLabel(line)}</Text>
                <Text style={[styles.body, styles.colAmount]}>
                  {money(line.total)}
                </Text>
              </View>
            ))}
          </View>
        )
      })}

      {totals.addonSections.map((section) => {
        const lines = section.lines.filter(
          (line) => line.description?.trim() || line.total > 0,
        )
        if (lines.length === 0) return null

        return (
          <View key={section.id} style={styles.table}>
            <Text style={styles.scopeHeading}>
              {section.title || 'Optional add-ons'}
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
            </View>
            {lines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={[styles.body, styles.colDesc]}>{lineLabel(line)}</Text>
                <Text style={[styles.body, styles.colAmount]}>
                  {money(line.total)}
                </Text>
              </View>
            ))}
          </View>
        )
      })}

      {totals.recurring.length > 0 ? (
        <View style={styles.table}>
          <Text style={styles.scopeHeading}>Recurring services</Text>
          {totals.recurring.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.body, styles.colDesc]}>
                {item.description || '—'}
              </Text>
              <Text style={[styles.body, styles.colAmount]}>
                {money(item.total)} / {item.intervalLabel}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{money(totals.subtotal)}</Text>
        </View>
        {totals.includedAddons > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Included add-ons</Text>
            <Text style={styles.totalValue}>{money(totals.includedAddons)}</Text>
          </View>
        ) : null}
        {totals.discounts.map((discount) => (
          <View key={discount.id} style={styles.totalRow}>
            <Text style={styles.totalLabel}>{discount.title}</Text>
            <Text style={styles.totalValue}>−{money(discount.amount)}</Text>
          </View>
        ))}
        {totals.taxAmount > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {totals.taxLabel}
              {totals.taxRate ? ` (${totals.taxRate}%)` : ''}
              {totals.taxMode === TAX_MODE.INCLUSIVE ? ' included' : ''}
            </Text>
            <Text style={styles.totalValue}>{money(totals.taxAmount)}</Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{money(totals.grandTotal)}</Text>
        </View>
        {totals.optionalAddons > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Optional add-ons</Text>
            <Text style={styles.totalValue}>{money(totals.optionalAddons)}</Text>
          </View>
        ) : null}
        {Object.entries(totals.recurringByInterval).map(([interval, amount]) => (
          <View key={interval} style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Then / {RECURRING_INTERVAL_LABELS[interval] ?? interval}
            </Text>
            <Text style={styles.totalValue}>{money(amount)}</Text>
          </View>
        ))}
      </View>

      {totals.milestones.length > 0 ? (
        <View style={styles.table}>
          <Text style={styles.scopeHeading}>Payment schedule</Text>
          {totals.milestones.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.body, styles.colDesc]}>
                {item.title || '—'}
                {item.due ? ` · ${item.due}` : ''}
                {` (${item.percent}%)`}
              </Text>
              <Text style={[styles.body, styles.colAmount]}>
                {money(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {instance.data.notes?.trim() ? (
        <Text style={styles.body}>{instance.data.notes}</Text>
      ) : null}
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
  const members = resolveTeamMembers(instance, brand)
  if (members.length === 0) return null

  return (
    <Section title="Team" brand={brand}>
      {members.map((member) => (
        <View key={member.id} style={styles.scopeBlock} wrap={false}>
          {member.photoUrl?.trim() ? (
            <Image src={member.photoUrl} style={styles.portrait} />
          ) : null}
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
  const items = resolveTestimonials(instance, brand)
  if (items.length === 0) return null

  return (
    <Section title="Testimonials" brand={brand}>
      {items.map((item) => (
        <View key={item.id} style={styles.scopeBlock} wrap={false}>
          {item.portraitUrl?.trim() ? (
            <Image src={item.portraitUrl} style={styles.portrait} />
          ) : null}
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

export function TermsPdf({ instance, proposal, brand }) {
  const body = resolveTermsBody(instance, proposal, brand)
  const payment = resolvePaymentTerms(instance, proposal, brand)
  if (!body && !payment) return null

  return (
    <Section title="Terms & conditions" brand={brand}>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {payment ? (
        <View style={styles.scopeBlock}>
          <Text style={styles.scopeHeading}>Payment terms</Text>
          <Text style={styles.body}>{payment}</Text>
        </View>
      ) : null}
    </Section>
  )
}

export function SignaturePdf({ instance, proposal, brand, settings }) {
  const studioName = signatoryFromBrand(brand, settings)
  const role = brand?.signature?.role?.trim() || 'Authorised representative'
  const signatureImage = brand?.signature?.imageUrl

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
          {signatureImage ? (
            <Image src={signatureImage} style={styles.signatureMark} />
          ) : null}
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{studioName}</Text>
          </View>
          <Text style={styles.footerText}>{role}</Text>
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
            <Link src={toAbsoluteUrl(item.url)}>{item.name || item.url}</Link>
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
