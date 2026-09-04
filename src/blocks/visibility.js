import { defaultBlockSettings } from '../models/contentBlock.js'
import { BLOCK_TYPE } from './ids.js'
import { isBlockDataEmpty } from './schemas.js'

export { defaultBlockSettings }

export function settingsToStyle(settings = {}) {
  const style = {}
  if (settings.background) style.backgroundColor = settings.background
  if (settings.color) style.color = settings.color
  if (Number.isFinite(settings.padding)) style.padding = `${settings.padding}px`
  if (Number.isFinite(settings.radius)) style.borderRadius = `${settings.radius}px`
  if (settings.border === false) style.border = '0'
  if (Number.isFinite(settings.letterSpacing)) {
    style.letterSpacing = `${settings.letterSpacing}em`
  }
  if (Number.isFinite(settings.lineHeight)) style.lineHeight = String(settings.lineHeight)
  return style
}

export function shouldRenderBlock(block, proposal = {}) {
  if (!block || block.enabled === false) return false
  const settings = block.settings ?? defaultBlockSettings()
  if (settings.visible === false) return false

  if (settings.condition === 'has_amount' && !(Number(proposal.amount) > 0)) {
    return false
  }
  if (settings.condition === 'has_client' && !proposal.clientName?.trim()) {
    return false
  }

  const hideEmpty = settings.hideWhenEmpty !== false
  if (
    hideEmpty &&
    block.type !== BLOCK_TYPE.COVER &&
    block.type !== BLOCK_TYPE.SIGNATURE &&
    isBlockDataEmpty(block.type, block.data)
  ) {
    return false
  }

  return true
}
