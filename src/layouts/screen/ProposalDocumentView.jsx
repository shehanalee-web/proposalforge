import { SCREEN_BLOCK } from '../blocks/ids.js'
import { getScreenBlock } from '../blocks/blockRegistry.js'
import { getLayout } from '../registry.js'
import { useSettings } from '../../hooks/useSettings.js'
import { brandToCssVars, resolveBrand } from '../../blocks/brand.js'
import { BLOCK_TYPE } from '../../blocks/ids.js'
import { placeBlocks } from '../../blocks/place.js'
import { getScreenRenderer } from '../../blocks/screenRegistry.js'
import styles from './ProposalDocumentView.module.css'

function shouldRenderChrome(id, options) {
  if (id === SCREEN_BLOCK.NOTES && !options.showNotes) return false
  if (id === SCREEN_BLOCK.TAGS && !options.showTags) return false
  if (id === SCREEN_BLOCK.SIGNATURE && !options.showSignature) return false
  return true
}

function shouldRenderInstance(instance, options) {
  if (instance.type === BLOCK_TYPE.COVER && !options.includeCover) return false
  if (instance.type === BLOCK_TYPE.SIGNATURE && !options.showSignature) return false
  return true
}

function ProposalDocumentView({
  proposal,
  settings = null,
  includeCover = false,
  showNotes = true,
  showTags = true,
  showSignature = true,
  status,
}) {
  const { settings: loadedSettings } = useSettings()
  const resolvedSettings = settings ?? loadedSettings
  const layout = getLayout(proposal.layoutId)
  const brand = resolveBrand(resolvedSettings)
  const options = { includeCover, showNotes, showTags, showSignature }
  const context = {
    proposal,
    settings: resolvedSettings,
    brand,
    layout,
    status,
  }

  const placed = placeBlocks(proposal.blocks, layout.screen.regions)

  return (
    <div
      className={styles.document}
      data-layout={layout.id}
      data-orientation={layout.orientation}
      style={brandToCssVars(brand)}
    >
      {placed.map((region) => {
        const instances = region.instances.filter((instance) =>
          shouldRenderInstance(instance, options),
        )
        const chrome = (region.chrome ?? [])
          .filter((id) => shouldRenderChrome(id, options))
          .map((id) => {
            const Block = getScreenBlock(id)
            return Block ? { id, Block } : null
          })
          .filter(Boolean)

        if (instances.length === 0 && chrome.length === 0) return null

        const regionClass =
          region.columns === 2 ? `${styles.region} ${styles.split}` : styles.region

        return (
          <div key={region.id} className={regionClass}>
            {instances.map((instance) => {
              const Screen = getScreenRenderer(instance.type)
              return <Screen key={instance.id} instance={instance} {...context} />
            })}
            {chrome.map(({ id, Block }) => (
              <Block key={id} {...context} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default ProposalDocumentView
