export { ProposalThemeProvider, useProposalTheme } from './ProposalThemeContext.jsx'
export { THEME_PRESETS, listThemes, getTheme } from './registry.js'
export { makeTokens, MOTION_PRESETS, FONT_OPTIONS, stackFor } from './tokens.js'
export {
  resolveDesign,
  applyThemeId,
  patchDesign,
  tokensToCssVars,
  seedFromProposal,
  seedFromBrand,
} from './resolve.js'
export { readDesign, writeDesign, subscribeDesign, exportDesign, importDesign } from './store.js'
export { applyDesignToBrand } from './brandBridge.js'
export { default as DocumentSurface } from './DocumentSurface.jsx'
export { DocumentHeader, DocumentFooter } from './DocumentChrome.jsx'
