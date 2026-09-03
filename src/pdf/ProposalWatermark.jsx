import { Text, View } from '@react-pdf/renderer'
import { resolvePdfWatermark } from './pdfBrand.js'
import { styles } from './pdfStyles.js'

function ProposalWatermark({ proposal, brand }) {
  const label = resolvePdfWatermark(proposal, brand)

  if (!label) return null

  return (
    <View style={styles.watermark} fixed>
      <Text style={styles.watermarkText}>{label}</Text>
    </View>
  )
}

export default ProposalWatermark
