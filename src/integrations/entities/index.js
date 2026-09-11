/**
 * H16.10 — Activity entity registry + subject resolution.
 *
 * Slice 10.1: schema + in-memory store.
 * Slice 10.2: resolveActivityEntity / assertActivityEntityAccess.
 * Timeline and authoring HTTP wiring are later slices. No CRM adapter import.
 */

export {
  ACTIVITY_ENTITY_SCHEMA_VERSION,
  ACTIVITY_ENTITY_KIND,
  ACTIVITY_ENTITY_KINDS,
  ACTIVITY_ENTITY_LIMITS,
  ACTIVITY_ENTITY_NOT_FOUND,
  ACTIVITY_ENTITY_FORBIDDEN,
  ACTIVITY_ENTITY_FORBIDDEN_FIELDS,
} from './types.js'

export { makeActivityEntity, cloneActivityEntity } from './schema.js'

export {
  resetActivityEntityStore,
  allActivityEntities,
  upsertActivityEntity,
  getActivityEntity,
  listActivityEntities,
} from './store.js'

export { resolveActivityEntity, assertActivityEntityAccess } from './resolve.js'
