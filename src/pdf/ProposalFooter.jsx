import { View, Text } from '@react-pdf/renderer'
import { styles } from './pdfStyles.js'

function ProposalFooter({ settings }) {
  const contact = [settings.studioName, settings.contactEmail]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join('  ·  ')

  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {contact || 'ProposalForge'}
        </Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </View>
  )
}

export default ProposalFooter
