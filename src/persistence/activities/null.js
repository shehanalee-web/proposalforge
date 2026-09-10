/**
 * H16.8 — Null ActivityRepository (Slice 8.2).
 *
 * Default adapter. describe/health are readable; every read and write throws.
 * durable: false. Not a JSON store.
 */

import { ForbiddenError } from '../../services/errors.js'
import { ACTIVITY_REPOSITORY_ID, ACTIVITY_REPOSITORY_MODE } from './types.js'

const DISABLED = 'Activity persistence is not enabled.'

function refuse() {
  throw new ForbiddenError(DISABLED)
}

export function createNullActivityRepository() {
  return {
    id: ACTIVITY_REPOSITORY_ID.NULL,

    describe() {
      return {
        id: ACTIVITY_REPOSITORY_ID.NULL,
        durable: false,
        mode: ACTIVITY_REPOSITORY_MODE.NULL,
      }
    },

    async health() {
      return {
        ok: false,
        durable: false,
        migrated: null,
        message: DISABLED,
      }
    },

    async create() {
      refuse()
    },

    async get() {
      refuse()
    },

    async list() {
      refuse()
    },

    async update() {
      refuse()
    },

    async archive() {
      refuse()
    },
  }
}
