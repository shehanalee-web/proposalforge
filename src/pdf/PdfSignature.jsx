import { View, Text } from '@react-pdf/renderer'
import { formatDate } from '../utils/format.js'
import { styles } from './pdfStyles.js'

function PdfSignature({ proposal, settings }) {
  const studioName = settings.studioName?.trim() || 'ProposalForge'
  const accepted = Boolean(proposal.acceptedAt)

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>Acceptance</Text>
      <View style={styles.signatureRow}>
        <View style={styles.signatureCol}>
          <Text style={styles.metaLabel}>Client</Text>
          <View style={styles.signatureLine}>
            {accepted ? (
              <Text style={styles.body}>{proposal.clientName || 'Accepted'}</Text>
            ) : null}
          </View>
          <Text style={styles.footerText}>
            {accepted ? `Signed ${formatDate(proposal.acceptedAt)}` : 'Signature'}
          </Text>
        </View>
        <View style={styles.signatureCol}>
          <Text style={styles.metaLabel}>Studio</Text>
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{studioName}</Text>
          </View>
          <Text style={styles.footerText}>Authorised representative</Text>
        </View>
      </View>
    </View>
  )
}

export default PdfSignature
