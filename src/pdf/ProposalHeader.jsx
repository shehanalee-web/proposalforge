import { View, Text } from '@react-pdf/renderer'
import { formatDate } from '../utils/format.js'
import { PROPOSAL_STATUS_LABELS } from '../models/proposal.js'
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
  const studioName = settings.studioName?.trim() || 'ProposalForge'
  const status = PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status
  const accent = brand?.colors?.accent

  return (
    <View style={styles.header}>
      <View style={styles.brandBand}>
        <View>
          <View
            style={[
              styles.brandMark,
              accent ? { backgroundColor: accent } : null,
            ]}
          />
          <Text style={styles.studioName}>{studioName}</Text>
          {settings.about ? (
            <Text style={styles.studioAbout}>{settings.about}</Text>
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
        <Meta label="Status" value={status} />
        <Meta label="Issued" value={formatDate(proposal.createdAt)} />
        <Meta label="Updated" value={formatDate(proposal.updatedAt)} />
        <Meta label="Valid until" value={formatDate(proposal.validUntil)} />
      </View>
    </View>
  )
}

export default ProposalHeader
