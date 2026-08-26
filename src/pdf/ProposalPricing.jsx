import { View, Text } from '@react-pdf/renderer'
import { formatCurrency } from '../utils/format.js'
import { getPricingRows, sumAmounts } from './pdfPricing.js'
import { styles } from './pdfStyles.js'

function ProposalPricing({ proposal }) {
  const rows = getPricingRows(proposal)
  const subtotal = sumAmounts(rows)
  const currency = proposal.currency

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>Investment</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.body, styles.colDesc]}>{row.description}</Text>
            <Text style={[styles.body, styles.colAmount]}>
              {formatCurrency(row.amount, currency)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(subtotal, currency)}
          </Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(subtotal, currency)}
          </Text>
        </View>
      </View>
    </View>
  )
}

export default ProposalPricing
