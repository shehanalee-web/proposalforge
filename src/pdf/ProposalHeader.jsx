import { View, Text, Image } from '@react-pdf/renderer'
import { formatDate } from '../utils/format.js'
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
  const studioName = studioNameFromBrand(brand, settings)
  const about = brand?.description?.trim() || settings?.about?.trim()
  const status = PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status
  const accent = brand?.colors?.accent
  const logoUrl = resolvePdfLogo(brand, 'dark')
  const versionLabel = proposal.currentVersion
    ? `v${proposal.currentVersion}`
    : null

  return (
    <View style={styles.header}>
      <View style={styles.brandBand}>
        <View>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logo} />
          ) : (
            <View
              style={[
                styles.brandMark,
                accent ? { backgroundColor: accent } : null,
              ]}
            />
          )}
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
