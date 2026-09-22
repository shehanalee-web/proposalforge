/**
 * H16.2 — Persist automation intake receipts (+ thin accepted events).
 *
 * Not an outbox, worker, or delivery system. Never writes proposals.json.
 */
import { assertStorageWritable, flushAndNext, ignoreUnavailableWrite, readJson, writeJson } from './runtimeStore.js'
import {
  configureAutomationIntakeStore,
  replaceAutomationIntakeLedger,
  serializeAutomationIntakeLedger,
  startAutomationEventIntake,
} from '../src/integrations/index.js'

/**
 * Load/persist `data/automation-intake.json` and start living → intake subscription.
 */
export function integrationsIntakePlugin() {
  let ready = false

  function persist(ledger) {
    assertStorageWritable()
    return writeJson('automation-intake.json', {
      receipts: Array.isArray(ledger?.receipts) ? ledger.receipts : [],
      events: Array.isArray(ledger?.events) ? ledger.events : [],
    })
  }

  async function ensureStore() {
    if (ready) return
    const stored = await readJson('automation-intake.json', null)
    if (stored && typeof stored === 'object') {
      replaceAutomationIntakeLedger(stored)
    } else {
      replaceAutomationIntakeLedger({ receipts: [], events: [] })
      await ignoreUnavailableWrite(() => persist(serializeAutomationIntakeLedger()))
    }
    configureAutomationIntakeStore({ persist })
    startAutomationEventIntake()
    ready = true
  }

  async function handle(req, res, next) {
    // No public HTTP surface in H16.2 — plugin only boots persistence + subscription.
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
    name: 'proposalforge-integrations-intake',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
