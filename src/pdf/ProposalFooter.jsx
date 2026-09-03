import { View, Text } from '@react-pdf/renderer'
import { styles } from './pdfStyles.js'

function ProposalFooter({ settings, brand }) {
  const studio = brand?.companyName?.trim() || brand?.contact?.legalName?.trim() || settings?.studioName?.trim()
  const email = brand?.contact?.email?.trim() || settings?.contactEmail?.trim()
  const phone = brand?.contact?.phone?.trim()
  const contact = [studio, email, phone].filter(Boolean).join('  ·  ')
  const accent = brand?.colors?.accent

  return (
    <View style={styles.footer} fixed>
      <View style={[styles.footerRule, accent ? { backgroundColor: accent } : null]} />
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
