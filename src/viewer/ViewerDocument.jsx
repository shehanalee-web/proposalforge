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
import ViewerSection from './ViewerSection.jsx'
import ViewerGallery from './ViewerGallery.jsx'
import AttachmentList from './AttachmentList.jsx'
import styles from './ViewerDocument.module.css'

function rendererFor(type) {
  if (type === BLOCK_TYPE.GALLERY) return ViewerGallery
  if (type === BLOCK_TYPE.ATTACHMENTS) return AttachmentList
  return getScreenRenderer(type)
}

function ViewerDocument({ proposal, status }) {
  const { settings } = useSettings()
  const { kit } = useBrandKit()
  const { tokens, cssVars } = useProposalTheme()
  const layout = getLayout(proposal.layoutId)
  const brand = applyDesignToBrand(resolveBrand(settings, kit), tokens)
  const context = { proposal, settings, brand, layout, status }
  const placed = placeBlocks(proposal.blocks ?? [], layout.screen.regions)

  return (
    <DocumentSurface className={styles.document} as="article">
      <div
        data-layout={layout.id}
        style={{ ...brandToCssVars(brand), ...cssVars }}
      >
        <DocumentHeader proposal={proposal} brand={brand} />
        {placed.map((region) => {
          if (region.instances.length === 0) return null
          const regionClass =
            region.columns === 2 ? `${styles.region} ${styles.split}` : styles.region

          return (
            <div key={region.id} className={regionClass}>
              {region.instances.map((instance) => {
                const Screen = rendererFor(instance.type)
                return (
                  <ViewerSection key={instance.id} id={instance.id}>
                    <Screen instance={instance} {...context} />
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
