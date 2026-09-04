import { Fragment } from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatProposalNumber } from './pdfFormat.js'
import { styles } from './pdfStyles.js'
import ProposalHeader from './ProposalHeader.jsx'
import ProposalClient from './ProposalClient.jsx'
import ProposalFooter from './ProposalFooter.jsx'
import { PDF_BLOCK } from '../layouts/blocks/ids.js'
import { getLayout } from '../layouts/registry.js'
import { resolveBrand, studioNameFromBrand } from '../blocks/brand.js'
import { applyDesignToBrand } from '../theme/brandBridge.js'
import { readDesign } from '../theme/store.js'
import { resolveDesign } from '../theme/resolve.js'
import { placePdfSequence } from '../blocks/place.js'
import { getPdfRenderer } from '../blocks/pdfRegistry.js'
import { shouldRenderBlock } from '../blocks/visibility.js'
import { buildVariableContext, interpolateInstance } from '../blocks/variables.js'
import ProposalWatermark from './ProposalWatermark.jsx'

function NotesChrome({ proposal }) {
  if (!proposal.notes?.trim()) return null

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>Notes</Text>
      <Text style={styles.body}>{proposal.notes.trim()}</Text>
    </View>
  )
}

const PDF_CHROME = {
  [PDF_BLOCK.HEADER]: ProposalHeader,
  [PDF_BLOCK.CLIENT]: ProposalClient,
  [PDF_BLOCK.FOOTER]: ProposalFooter,
  [PDF_BLOCK.NOTES]: NotesChrome,
}

function renderChrome(id, props) {
  const Block = PDF_CHROME[id]
  return Block ? <Block key={id} {...props} /> : null
}

function ProposalDocument({ proposal, settings, kit }) {
  const resolvedBrand = resolveBrand(settings, kit)
  const design = resolveDesign(readDesign(proposal.id), proposal, resolvedBrand)
  const brand = applyDesignToBrand(resolvedBrand, design)
  const studioName = studioNameFromBrand(brand, settings)
  const layout = getLayout(proposal.layoutId)
  const context = { proposal, settings, brand }
  const variableContext = buildVariableContext({
    proposal,
    brand,
    tokens: design,
    settings,
  })
  const sequence = placePdfSequence(proposal.blocks, layout.pdf.sequence)
  const versionLabel = proposal.currentVersion ? ` v${proposal.currentVersion}` : ''
  const brandedPage = [
    styles.page,
    layout.orientation === 'landscape' ? styles.pageLandscape : null,
    brand.colors?.background ? { backgroundColor: brand.colors.background } : null,
    brand.colors?.text ? { color: brand.colors.text } : null,
  ].filter(Boolean)

  return (
    <Document
      title={proposal.title}
      author={studioName}
      subject={`${formatProposalNumber(proposal.id)}${versionLabel} — ${proposal.title}`}
      creator="ProposalForge"
    >
      <Page
        size={layout.pdf.size}
        orientation={layout.pdf.orientation}
        style={brandedPage}
        wrap
      >
        <ProposalWatermark proposal={proposal} brand={brand} />
        {sequence.map((step, index) => {
          const chrome = (step.chrome ?? []).map((id) => renderChrome(id, context))
          const content = (step.instances ?? [])
            .filter((instance) => shouldRenderBlock(instance, proposal))
            .map((instance) => {
              const Pdf = getPdfRenderer(instance.type)
              return (
                <Pdf
                  key={instance.id}
                  instance={interpolateInstance(instance, variableContext)}
                  {...context}
                />
              )
            })

          if (step.type === 'row') {
            const cells = [...chrome, ...content].filter(Boolean)

            return (
              <View key={`${step.type}-${index}`} style={styles.pageRow}>
                {cells.map((node, cellIndex) => (
                  <View key={node.key ?? `cell-${cellIndex}`} style={styles.pageRowCol}>
                    {node}
                  </View>
                ))}
              </View>
            )
          }

          return (
            <Fragment key={`${step.type}-${index}`}>
              {chrome}
              {content}
            </Fragment>
          )
        })}
      </Page>
    </Document>
  )
}

export default ProposalDocument
