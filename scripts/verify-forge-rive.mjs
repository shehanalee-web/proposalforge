/**
 * H14 Phase 14.8 — Forge Rive contract + fallback shell verification.
 *
 * Never writes data/proposals.json. No .riv asset required.
 * No new persistence domain. Client living must not mount Forge/Rive.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATOR_CAPABILITIES } from '../src/generate/types.js'
import { KNOWLEDGE_CAPABILITIES } from '../src/knowledge/types.js'
import { LIVING_CAPABILITIES } from '../src/living/types.js'
import {
  FORGE_CAPABILITIES,
  FORGE_RIVE_ASSET_PATH,
  FORGE_RIVE_STATE,
  FORGE_RIVE_STATES,
  mapForgeStatusToRiveInputs,
  resolveForgePresentation,
  resolveForgePresentationState,
  resolveForgeRiveAsset,
  shouldUseForgeRive,
} from '../src/forge/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

let passed = 0
let failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

const proposalsBefore = proposalsSnapshot()

assert(
  '1. Rive contract capability is honest',
  FORGE_CAPABILITIES.riveContract === true &&
    FORGE_CAPABILITIES.rive === false &&
    FORGE_CAPABILITIES.clientForge === false &&
    FORGE_CAPABILITIES.llm === false &&
    LIVING_CAPABILITIES.rive === false &&
    LIVING_CAPABILITIES.forgeActions === true &&
    LIVING_CAPABILITIES.decisionSnapshots === true &&
    KNOWLEDGE_CAPABILITIES.forge === false &&
    GENERATOR_CAPABILITIES.forge === false,
)

assert(
  '2. Documented Rive states match H14 §17',
  FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.IDLE) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.LISTENING) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.THINKING) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.WORKING) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.SUCCESS) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.WARNING) &&
    FORGE_RIVE_STATES.includes(FORGE_RIVE_STATE.PRESENTING) &&
    FORGE_RIVE_STATES.length === 7,
)

const inputs = mapForgeStatusToRiveInputs(FORGE_RIVE_STATE.WORKING)
assert(
  '3. Product status maps to Rive inputs',
  inputs.state === FORGE_RIVE_STATE.WORKING &&
    inputs.isWorking === true &&
    inputs.isIdle === false &&
    mapForgeStatusToRiveInputs('unknown').state === FORGE_RIVE_STATE.IDLE,
)

assert(
  '4. .riv asset is optional and absent by default',
  resolveForgeRiveAsset() === null &&
    resolveForgeRiveAsset({ exists: false }) === null &&
    resolveForgeRiveAsset({ exists: true }) === FORGE_RIVE_ASSET_PATH &&
    shouldUseForgeRive({ assetUrl: FORGE_RIVE_ASSET_PATH, reducedMotion: false }) ===
      false,
)

assert(
  '5. Presentation state is deterministic from UI signals',
  resolveForgePresentationState({ error: 'x' }) === FORGE_RIVE_STATE.WARNING &&
    resolveForgePresentationState({ busy: true }) === FORGE_RIVE_STATE.WORKING &&
    resolveForgePresentationState({ resultMessage: 'Done' }) ===
      FORGE_RIVE_STATE.SUCCESS &&
    resolveForgePresentationState({ hasSuggestion: true }) ===
      FORGE_RIVE_STATE.PRESENTING &&
    resolveForgePresentationState({}) === FORGE_RIVE_STATE.IDLE,
)

const fallback = resolveForgePresentation({
  hasSummary: true,
  reducedMotion: false,
  assetExists: false,
})
assert(
  '6. Fallback shell is used when asset/capability missing',
  fallback.mode === 'fallback' &&
    fallback.assetUrl === null &&
    fallback.state === FORGE_RIVE_STATE.PRESENTING &&
    fallback.animate === true,
)

const reduced = resolveForgePresentation({
  busy: true,
  reducedMotion: true,
  assetExists: true,
  capabilities: { ...FORGE_CAPABILITIES, rive: true },
})
assert(
  '7. Reduced-motion forces non-Rive fallback and disables animation',
  reduced.mode === 'fallback' &&
    reduced.reducedMotion === true &&
    reduced.animate === false &&
    reduced.state === FORGE_RIVE_STATE.WORKING,
)

const withRive = resolveForgePresentation({
  busy: true,
  reducedMotion: false,
  assetExists: true,
  capabilities: { ...FORGE_CAPABILITIES, rive: true },
})
assert(
  '8. Rive mode only when capability + asset + motion allow',
  withRive.mode === 'rive' &&
    withRive.assetUrl === FORGE_RIVE_ASSET_PATH &&
    withRive.riveInputs.isWorking === true,
)

const shell = sourceOf('src', 'pages', 'History', 'ForgeAssistantShell.jsx')
const card = sourceOf('src', 'pages', 'History', 'ForgeActionsCard.jsx')
const shellCss = sourceOf('src', 'pages', 'History', 'ForgeAssistantShell.module.css')
assert(
  '9. Studio Forge card mounts the assistant shell',
  card.includes('ForgeAssistantShell') &&
    shell.includes('data-forge-assistant') &&
    shell.includes('resolveForgePresentation') &&
    shellCss.includes('prefers-reduced-motion'),
)

const portalApp = sourceOf('src', 'portal', 'PortalApp.jsx')
const livingProvider = sourceOf('src', 'living', 'LivingSessionProvider.jsx')
assert(
  '10. Client living route does not mount Forge Rive',
  !portalApp.includes('ForgeAssistantShell') &&
    !portalApp.includes('riveContract') &&
    !portalApp.includes('/api/forge') &&
    !portalApp.includes('FORGE_RIVE') &&
    !livingProvider.includes('ForgeAssistantShell') &&
    !livingProvider.includes('riveContract') &&
    LIVING_CAPABILITIES.rive === false,
)

assert(
  '11. No Rive runtime dependency or new persistence',
  !sourceOf('package.json').includes('@rive-app') &&
    !sourceOf('server', 'forgePlugin.js').includes('forge-rive') &&
    !sourceOf('src', 'forge', 'riveContract.js').includes('writeFileSync') &&
    !sourceOf('src', 'forge', 'riveContract.js').includes('proposals.json'),
)

assert('12. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`verify-forge-rive: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
