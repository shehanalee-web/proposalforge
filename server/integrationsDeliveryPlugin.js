/**
 * H16.16 Slice 16.3 — Persist rejected delivery outcomes.
 *
 * JSON boot only. No HTTP routes, transport, OAuth, workers, or send.
 * Never writes proposals.json. Not an outbox.
 *
 * Missing file → empty ledger. Malformed/corrupt file fails closed and is
 * not overwritten. Vite constructs this plugin at config load; productionApi
 * constructs it on first dispatch, same as the other integration plugins.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import {
  configureDeliveryOutcomeStore,
  parsePersistedDeliveryOutcomeSnapshot,
  replaceDeliveryOutcomes,
  serializeDeliveryOutcomes,
} from '../src/integrations/index.js'

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/**
 * @param {string} file
 * @returns {{ outcomes: object[] } | null} null when the file does not exist
 */
export function readDeliveryOutcomesFile(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
  return parsePersistedDeliveryOutcomeSnapshot(raw)
}

/**
 * Load/persist the rejected delivery outcome ledger at boot.
 */
export function integrationsDeliveryPlugin() {
  const dataDir = ensureRuntimeData()
  const outcomesFile = join(dataDir, 'delivery-outcomes.json')
  let ready = false

  function persist(bag) {
    writeJson(outcomesFile, {
      outcomes: Array.isArray(bag?.outcomes) ? bag.outcomes : [],
    })
  }

  function ensureStore() {
    if (ready) return
    const stored = readDeliveryOutcomesFile(outcomesFile)
    if (stored == null) {
      replaceDeliveryOutcomes({ outcomes: [] })
      persist(serializeDeliveryOutcomes())
    } else {
      replaceDeliveryOutcomes(stored)
    }
    configureDeliveryOutcomeStore({ persist })
    ready = true
  }

  ensureStore()

  async function handle(_req, _res, next) {
    ensureStore()
    return next()
  }

  function attach(server) {
    ensureStore()
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-integrations-delivery',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
