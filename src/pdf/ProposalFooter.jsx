import { View, Text } from '@react-pdf/renderer'
import { FOOTER_STYLE, PAGE_NUMBER_POSITION } from '../models/brandKit.js'
import { styles } from './pdfStyles.js'

function contactLine(brand, settings) {
  const studio =
    brand?.companyName?.trim() ||
    brand?.contact?.legalName?.trim() ||
    settings?.studioName?.trim()
  const email = brand?.contact?.email?.trim() || settings?.contactEmail?.trim()
  const phone = brand?.contact?.phone?.trim()
  const website = brand?.contact?.website?.trim()
  const address = brand?.contact?.address?.trim()
  const footerStyle = brand?.footerStyle || FOOTER_STYLE.STANDARD

  if (footerStyle === FOOTER_STYLE.MINIMAL) {
    return studio || 'ProposalForge'
  }

  if (footerStyle === FOOTER_STYLE.CONTACT) {
    return [studio, email, phone, website, address].filter(Boolean).join('  ·  ')
  }

  return [studio, email, phone].filter(Boolean).join('  ·  ')
}

function ProposalFooter({ settings, brand }) {
  const contact = contactLine(brand, settings)
  const accent = brand?.colors?.accent
  const position = brand?.pageNumberPosition || PAGE_NUMBER_POSITION.FOOTER_RIGHT
  const showPages = position !== PAGE_NUMBER_POSITION.HIDDEN
  const centerPages = position === PAGE_NUMBER_POSITION.FOOTER_CENTER

  return (
    <View style={styles.footer} fixed>
      <View style={[styles.footerRule, accent ? { backgroundColor: accent } : null]} />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{contact || 'ProposalForge'}</Text>
        {showPages && centerPages ? (
          <Text
            style={[styles.footerText, styles.footerCenter]}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        ) : null}
        {showPages && !centerPages ? (
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        ) : null}
      </View>
    </View>
  )
}

export default ProposalFooter
