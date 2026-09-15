import { View, Text, Image } from '@react-pdf/renderer'
import { formatDate } from '../utils/format.js'
import { COVER_STYLE, HEADER_STYLE } from '../models/brandKit.js'
import { PROPOSAL_STATUS_LABELS } from '../models/proposal.js'
import { studioNameFromBrand } from '../blocks/brand.js'
import { resolvePdfLogo } from './pdfBrand.js'
import { formatProposalNumber } from './pdfFormat.js'
import { styles } from './pdfStyles.js'

function Meta({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

function ProposalHeader({ proposal, settings, brand }) {
  const headerStyle = brand?.headerStyle || HEADER_STYLE.STANDARD
  const fullBleed = brand?.coverStyle === COVER_STYLE.FULL_BLEED
  const showDarkBand =
    !fullBleed && headerStyle !== HEADER_STYLE.MINIMAL
  const centered = headerStyle === HEADER_STYLE.CENTERED
  const studioName = studioNameFromBrand(brand, settings)
  const about = brand?.description?.trim() || settings?.about?.trim()
  const status = PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status
  const accent = brand?.colors?.accent
  const logoUrl = showDarkBand ? resolvePdfLogo(brand, 'light') : ''
  const versionLabel = proposal.currentVersion
    ? `v${proposal.currentVersion}`
    : null

  const mark = logoUrl ? (
    <Image src={logoUrl} style={styles.logo} />
  ) : (
    <View
      style={[styles.brandMark, accent ? { backgroundColor: accent } : null]}
    />
  )

  return (
    <View style={styles.header}>
      {showDarkBand && centered ? (
        <View style={styles.headerCenteredBand}>
          {mark}
          <Text style={styles.headerCenteredStudio}>{studioName}</Text>
          {about ? (
            <Text style={styles.headerCenteredAbout}>{about}</Text>
          ) : null}
          <Text style={styles.headerCenteredLabel}>Proposal</Text>
          <Text style={styles.headerCenteredTitle}>{proposal.title}</Text>
        </View>
      ) : showDarkBand ? (
        <View style={styles.brandBand}>
          <View>
            {mark}
            <Text style={styles.studioName}>{studioName}</Text>
            {about ? (
              <Text style={styles.studioAbout}>{about}</Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.proposalLabel}>Proposal</Text>
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
          </View>
        </View>
      ) : about ? (
        <Text style={[styles.body, styles.muted]}>{about}</Text>
      ) : null}

      <View style={[styles.accentBar, accent ? { backgroundColor: accent } : null]} />

      <View style={styles.metaRow}>
        <Meta label="Number" value={formatProposalNumber(proposal.id)} />
        {versionLabel ? <Meta label="Version" value={versionLabel} /> : null}
        <Meta label="Status" value={status} />
        <Meta label="Issued" value={formatDate(proposal.createdAt)} />
        <Meta label="Updated" value={formatDate(proposal.updatedAt)} />
        <Meta label="Valid until" value={formatDate(proposal.validUntil)} />
      </View>
    </View>
  )
}

export default ProposalHeader
