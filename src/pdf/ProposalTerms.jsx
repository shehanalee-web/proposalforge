import { View, Text } from '@react-pdf/renderer'
import { formatDate } from '../utils/format.js'
import { resolvePaymentTerms, resolveTermsBody } from '../blocks/brand.js'
import { styles } from './pdfStyles.js'

function buildTerms(proposal) {
  const validUntil = formatDate(proposal.validUntil)

  return [
    {
      title: '1. Validity',
      body:
        validUntil === '—'
          ? 'This proposal remains valid for 30 days from the issue date unless a different period is agreed in writing.'
          : `This proposal is valid until ${validUntil}. After that date, fees, availability and scope are subject to review.`,
    },
    {
      title: '2. Scope of work',
      body: 'The studio will deliver the services described in this document. Work outside that scope — including extra rounds of revision, new deliverables, or changes in direction after approval — will be quoted separately before it begins.',
    },
    {
      title: '3. Fees and payment',
      body: 'Fees are quoted in the currency shown in the investment table and exclude third-party costs unless listed. A 40% deposit is due on acceptance, with the balance invoiced on delivery. Invoices are payable within 14 days. Late amounts may pause remaining work.',
    },
    {
      title: '4. Timeline',
      body: 'Dates in this proposal are estimates that start when the deposit clears and required materials are received. Client delay in feedback or assets extends the schedule by the same duration.',
    },
    {
      title: '5. Revisions',
      body: 'Each deliverable includes two rounds of consolidated feedback. Additional rounds, or feedback that reopens a previously approved stage, are billed at the studio’s standard hourly rate.',
    },
    {
      title: '6. Intellectual property',
      body: 'The studio retains ownership of all work until invoices are paid in full. On payment, the client receives a licence to use the final approved deliverables for the stated project. Unused concepts, working files and tools remain the studio’s property.',
    },
    {
      title: '7. Cancellation',
      body: 'Either party may cancel in writing. Work completed to date, plus any non-cancellable third-party costs, will be invoiced. The deposit is credited against that amount and is otherwise non-refundable once work has started.',
    },
    {
      title: '8. Confidentiality',
      body: 'Both parties will keep confidential information received in the course of this project private, and will not disclose it except to people who need it to perform the work or as required by law.',
    },
    {
      title: '9. Liability',
      body: 'The studio’s liability under this proposal is limited to the fees paid for the work giving rise to the claim. The studio is not liable for indirect or consequential loss, including lost profits or delay caused by third parties.',
    },
    {
      title: '10. Acceptance',
      body: 'Written confirmation, a signed copy of this proposal, or payment of the deposit constitutes acceptance of these terms. This document is the entire agreement for the described work unless a later contract says otherwise.',
    },
  ]
}

function ProposalTerms({ proposal, brand }) {
  const custom = resolveTermsBody(null, proposal, brand)
  const payment = resolvePaymentTerms(null, proposal, brand)

  if (custom) {
    const paragraphs = custom.split(/\n{2,}/)

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Terms & conditions</Text>
        {paragraphs.map((paragraph, index) => (
          <View key={index} style={styles.termItem}>
            <Text style={styles.termBody}>{paragraph.trim()}</Text>
          </View>
        ))}
        {payment ? (
          <View style={styles.termItem}>
            <Text style={styles.termTitle}>Payment terms</Text>
            <Text style={styles.termBody}>{payment}</Text>
          </View>
        ) : null}
      </View>
    )
  }

  const terms = buildTerms(proposal)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Terms & conditions</Text>
      {terms.map((term) => (
        <View key={term.title} style={styles.termItem} wrap={false}>
          <Text style={styles.termTitle}>{term.title}</Text>
          <Text style={styles.termBody}>{term.body}</Text>
        </View>
      ))}
      {payment ? (
        <View style={styles.termItem}>
          <Text style={styles.termTitle}>Payment terms</Text>
          <Text style={styles.termBody}>{payment}</Text>
        </View>
      ) : null}
    </View>
  )
}

export default ProposalTerms
