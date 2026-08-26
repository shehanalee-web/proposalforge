import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatProposalNumber } from './pdfFormat.js'
import { styles } from './pdfStyles.js'
import ProposalHeader from './ProposalHeader.jsx'
import ProposalClient from './ProposalClient.jsx'
import ProposalPricing from './ProposalPricing.jsx'
import ProposalTerms from './ProposalTerms.jsx'
import ProposalFooter from './ProposalFooter.jsx'

function ProjectDescription({ proposal }) {
  const sections = proposal.sections ?? []

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Project description</Text>
      <Text style={styles.projectHeading}>{proposal.title}</Text>
      {proposal.projectType ? (
        <Text style={styles.projectType}>{proposal.projectType}</Text>
      ) : null}

      {proposal.summary ? (
        <Text style={styles.body}>{proposal.summary}</Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.id} style={styles.scopeBlock} wrap={false}>
          <Text style={styles.scopeHeading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  )
}

function ProposalDocument({ proposal, settings }) {
  const studioName = settings.studioName?.trim() || 'ProposalForge'

  return (
    <Document
      title={proposal.title}
      author={studioName}
      subject={`${formatProposalNumber(proposal.id)} — ${proposal.title}`}
      creator="ProposalForge"
    >
      <Page size="A4" style={styles.page} wrap>
        <ProposalHeader proposal={proposal} settings={settings} />
        <ProposalClient proposal={proposal} />
        <ProjectDescription proposal={proposal} />
        <ProposalPricing proposal={proposal} />
        <ProposalTerms proposal={proposal} />
        <ProposalFooter settings={settings} />
      </Page>
    </Document>
  )
}

export default ProposalDocument
