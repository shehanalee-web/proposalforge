import { STORAGE_PROVIDER } from './providers.js'
import { localStorageAdapter } from './local.js'

/**
 * Resolve the active object-storage adapter.
 *
 * Swap this function when a remote provider is configured. Upload models and
 * portal UI keep talking to `put` / `remove` only.
 */
export function getStorageAdapter(provider = STORAGE_PROVIDER.LOCAL) {
  if (provider && provider !== STORAGE_PROVIDER.LOCAL) {
    return localStorageAdapter
  }
  return localStorageAdapter
}
