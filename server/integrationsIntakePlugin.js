/**
 * H16.2 — Persist automation intake receipts (+ thin accepted events).
 *
 * Not an outbox, worker, or delivery system. Never writes proposals.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import {
  configureAutomationIntakeStore,
  replaceAutomationIntakeLedger,
  serializeAutomationIntakeLedger,
  startAutomationEventIntake,
} from '../src/integrations/index.js'

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/**
 * Load/persist `data/automation-intake.json` and start living → intake subscription.
 */
export function integrationsIntakePlugin() {
  const dataDir = ensureRuntimeData()
  const intakeFile = join(dataDir, 'automation-intake.json')
  let ready = false

  function persist(ledger) {
    writeJson(intakeFile, {
      receipts: Array.isArray(ledger?.receipts) ? ledger.receipts : [],
      events: Array.isArray(ledger?.events) ? ledger.events : [],
    })
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(intakeFile, null)
    if (stored && typeof stored === 'object') {
      replaceAutomationIntakeLedger(stored)
    } else {
      replaceAutomationIntakeLedger({ receipts: [], events: [] })
      persist(serializeAutomationIntakeLedger())
    }
    configureAutomationIntakeStore({ persist })
    startAutomationEventIntake()
    ready = true
  }

  async function handle(req, res, next) {
    // No public HTTP surface in H16.2 — plugin only boots persistence + subscription.
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
    name: 'proposalforge-integrations-intake',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
