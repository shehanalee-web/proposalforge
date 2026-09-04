import { useSettings } from '../hooks/useSettings.js'
import { useBrandKit } from '../hooks/useBrandKit.js'
import { brandToCssVars, resolveBrand } from '../blocks/brand.js'
import { BLOCK_TYPE } from '../blocks/ids.js'
import { placeBlocks } from '../blocks/place.js'
import { getScreenRenderer } from '../blocks/screenRegistry.js'
import { getLayout } from '../layouts/registry.js'
import { applyDesignToBrand } from '../theme/brandBridge.js'
import { DocumentFooter, DocumentHeader } from '../theme/DocumentChrome.jsx'
import DocumentSurface from '../theme/DocumentSurface.jsx'
import { useProposalTheme } from '../theme/ProposalThemeContext.jsx'
import { shouldRenderBlock, settingsToStyle } from '../blocks/visibility.js'
import { buildVariableContext, interpolateInstance } from '../blocks/variables.js'
import ViewerSection from './ViewerSection.jsx'
import ViewerGallery from './ViewerGallery.jsx'
import AttachmentList from './AttachmentList.jsx'
import styles from './ViewerDocument.module.css'

function rendererFor(type) {
  if (type === BLOCK_TYPE.GALLERY) return ViewerGallery
  if (type === BLOCK_TYPE.ATTACHMENTS) return AttachmentList
  return getScreenRenderer(type)
}

function ViewerDocument({ proposal, status, readOnly = false }) {
  const { settings } = useSettings()
  const { kit } = useBrandKit()
  const { tokens, cssVars } = useProposalTheme()
  const layout = getLayout(proposal.layoutId)
  const brand = applyDesignToBrand(resolveBrand(settings, kit), tokens)
  const variableContext = buildVariableContext({ proposal, brand, tokens, settings })
  const context = { proposal, settings, brand, layout, status }
  const placed = placeBlocks(proposal.blocks ?? [], layout.screen.regions)

  return (
    <DocumentSurface
      className={styles.document}
      as="article"
      data-readonly={readOnly ? 'true' : undefined}
    >
      <div
        data-layout={layout.id}
        style={{ ...brandToCssVars(brand), ...cssVars }}
      >
        <DocumentHeader proposal={proposal} brand={brand} />
        {placed.map((region) => {
          const instances = region.instances.filter((instance) =>
            shouldRenderBlock(instance, proposal),
          )
          if (instances.length === 0) return null
          const regionClass =
            region.columns === 2 ? `${styles.region} ${styles.split}` : styles.region

          return (
            <div key={region.id} className={regionClass}>
              {instances.map((instance) => {
                const Screen = rendererFor(instance.type)
                const live = interpolateInstance(instance, variableContext)
                return (
                  <ViewerSection key={instance.id} id={instance.id}>
                    <div style={settingsToStyle(instance.settings)}>
                      <Screen instance={live} {...context} />
                    </div>
                  </ViewerSection>
                )
              })}
            </div>
          )
        })}
        <DocumentFooter proposal={proposal} />
      </div>
    </DocumentSurface>
  )
}

export default ViewerDocument
