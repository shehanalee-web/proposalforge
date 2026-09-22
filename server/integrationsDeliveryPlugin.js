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
import { readFileSync } from 'node:fs'
import { assertStorageWritable, flushAndNext, ignoreUnavailableWrite, readJsonText, writeJson } from './runtimeStore.js'
import {
  configureDeliveryOutcomeStore,
  parsePersistedDeliveryOutcomeSnapshot,
  replaceDeliveryOutcomes,
  serializeDeliveryOutcomes,
} from '../src/integrations/index.js'

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
  let ready = false

  function persist(bag) {
    assertStorageWritable()
    return writeJson('delivery-outcomes.json', {
      outcomes: Array.isArray(bag?.outcomes) ? bag.outcomes : [],
    })
  }

  async function ensureStore() {
    if (ready) return
    const raw = await readJsonText('delivery-outcomes.json')
    if (raw == null) {
      replaceDeliveryOutcomes({ outcomes: [] })
      await ignoreUnavailableWrite(() => persist(serializeDeliveryOutcomes()))
    } else {
      replaceDeliveryOutcomes(parsePersistedDeliveryOutcomeSnapshot(raw))
    }
    configureDeliveryOutcomeStore({ persist })
    ready = true
  }

  async function handle(_req, _res, next) {
    await ensureStore()
    return flushAndNext(next)
  }

  function attach(server) {
    void ensureStore()
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
