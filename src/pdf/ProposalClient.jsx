import { View, Text } from '@react-pdf/renderer'
import { styles } from './pdfStyles.js'

function ProposalClient({ proposal }) {
  return (
    <View style={styles.section}>
      <View style={styles.clientGrid}>
        <View style={styles.clientColumn}>
          <Text style={styles.sectionTitle}>Prepared for</Text>
          <Text style={styles.clientName}>
            {proposal.clientName || '—'}
          </Text>
          {proposal.company ? (
            <Text style={styles.body}>{proposal.company}</Text>
          ) : null}
          {proposal.clientEmail ? (
            <Text style={styles.muted}>{proposal.clientEmail}</Text>
          ) : null}
        </View>

        <View style={styles.clientColumn}>
          <Text style={styles.sectionTitle}>Project type</Text>
          <Text style={styles.body}>{proposal.projectType || '—'}</Text>
        </View>
      </View>
    </View>
  )
}

export default ProposalClient
