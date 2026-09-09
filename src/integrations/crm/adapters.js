/**
 * H16.6 — Built-in CRM adapters: null_crm and mock_crm.
 *
 * mock_crm is in-process only: no network, no OAuth, no vendor SDK.
 * There is no HubSpot / Salesforce / Pipedrive adapter in this milestone.
 */

import { createHash } from 'node:crypto'
import { registerCrmAdapter } from './adapter.js'
import { CRM_FAILURE_CODES, CRM_PROVIDER_ID, CRM_RECORD_TYPE } from './types.js'

/** @type {Map<string, { externalId: string, recordType: string, fields: object, revision: number }>} */
const mockRecords = new Map()

/** @type {{ failureCode: string, retryable: boolean, message: string } | null} */
let mockFailure = null

function mockRecordKey(mutation) {
  const identity = mutation.externalKey || mutation.idempotencyKey || ''
  return `${mutation.companyId}|${mutation.connectionId}|${mutation.recordType}|${identity}`
}

function deterministicExternalId(recordType, key) {
  const digest = createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 12)
  return `mock_${recordType}_${digest}`
}

export function resetMockCrmRecords() {
  mockRecords.clear()
  mockFailure = null
}

/**
 * Test seam: force the next mock mutation to fail with a bounded code.
 *
 * @param {{ failureCode: string, retryable?: boolean, message?: string } | null} failure
 */
export function setMockCrmFailureForTests(failure) {
  if (!failure || !CRM_FAILURE_CODES.includes(failure.failureCode)) {
    mockFailure = null
    return null
  }
  mockFailure = {
    failureCode: failure.failureCode,
    retryable: failure.retryable === true,
    message: String(failure.message ?? 'Mock CRM failure.'),
  }
  return mockFailure
}

export function clearMockCrmFailureForTests() {
  mockFailure = null
}

/**
 * Inspect the in-memory fake record store (verification only).
 *
 * @param {object} mutation
 */
export function getMockCrmRecord(mutation) {
  const found = mockRecords.get(mockRecordKey(mutation))
  return found ? { ...found, fields: { ...found.fields } } : null
}

export function listMockCrmRecords() {
  return [...mockRecords.values()].map((item) => ({ ...item, fields: { ...item.fields } }))
}

function createNullCrmAdapter() {
  return Object.freeze({
    providerId: CRM_PROVIDER_ID.NULL,
    isEnabled() {
      return false
    },
    describe() {
      return Object.freeze({
        providerId: CRM_PROVIDER_ID.NULL,
        kind: 'crm',
        enabled: false,
        vendorNeutral: true,
        network: false,
        oauth: false,
        vendorSdk: false,
        operations: Object.freeze([]),
      })
    },
    applyMutation() {
      return Object.freeze({
        ok: false,
        externalId: null,
        failureCode: 'provider_disabled',
        retryable: false,
        result: Object.freeze({}),
        message: 'The null CRM adapter never executes mutations.',
      })
    },
  })
}

function createMockCrmAdapter() {
  return Object.freeze({
    providerId: CRM_PROVIDER_ID.MOCK,
    isEnabled(connection) {
      if (!connection || connection.providerId !== CRM_PROVIDER_ID.MOCK) return false
      return connection.enabled === true
    },
    describe() {
      return Object.freeze({
        providerId: CRM_PROVIDER_ID.MOCK,
        kind: 'crm',
        enabled: true,
        vendorNeutral: true,
        network: false,
        oauth: false,
        vendorSdk: false,
        inProcess: true,
        operations: Object.freeze([
          'upsert_contact',
          'upsert_company',
          'upsert_deal',
          'create_note',
        ]),
      })
    },
    applyMutation(mutation) {
      if (mockFailure) {
        const forced = mockFailure
        mockFailure = null
        return Object.freeze({
          ok: false,
          externalId: null,
          failureCode: forced.failureCode,
          retryable: forced.retryable,
          result: Object.freeze({}),
          message: forced.message,
        })
      }

      const key = mockRecordKey(mutation)
      const externalId = deterministicExternalId(mutation.recordType, key)
      const existing = mockRecords.get(key)

      // Notes are create-only; contacts/companies/deals upsert by natural key.
      const isNote = mutation.recordType === CRM_RECORD_TYPE.NOTE
      if (existing && !isNote) {
        const merged = { ...existing.fields, ...mutation.fields }
        const same = JSON.stringify(merged) === JSON.stringify(existing.fields)
        mockRecords.set(key, {
          externalId,
          recordType: mutation.recordType,
          fields: merged,
          revision: same ? existing.revision : existing.revision + 1,
        })
      } else if (!existing) {
        mockRecords.set(key, {
          externalId,
          recordType: mutation.recordType,
          fields: { ...mutation.fields },
          revision: 1,
        })
      }

      return Object.freeze({
        ok: true,
        externalId,
        failureCode: null,
        retryable: false,
        result: Object.freeze({
          recordType: mutation.recordType,
          created: !existing,
          externalKey: mutation.externalKey,
          fieldCount: Object.keys(mutation.fields).length,
        }),
        message: null,
      })
    },
  })
}

export function registerBuiltInCrmAdapters() {
  registerCrmAdapter(createNullCrmAdapter())
  registerCrmAdapter(createMockCrmAdapter())
}

registerBuiltInCrmAdapters()

export { createMockCrmAdapter, createNullCrmAdapter }
