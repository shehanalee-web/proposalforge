/**
 * Storage providers for proposal files.
 *
 * Phase 8D ships a local adapter. S3, R2, Azure and GCS stay registered so a
 * later milestone can swap the adapter without changing upload models or UI.
 */

export const STORAGE_PROVIDER = Object.freeze({
  LOCAL: 'local',
  S3: 's3',
  R2: 'cloudflare_r2',
  AZURE: 'azure_blob',
  GCS: 'google_cloud',
})

export const STORAGE_PROVIDERS = Object.freeze(Object.values(STORAGE_PROVIDER))

export const STORAGE_PROVIDER_LABELS = Object.freeze({
  [STORAGE_PROVIDER.LOCAL]: 'Local',
  [STORAGE_PROVIDER.S3]: 'Amazon S3',
  [STORAGE_PROVIDER.R2]: 'Cloudflare R2',
  [STORAGE_PROVIDER.AZURE]: 'Azure Blob',
  [STORAGE_PROVIDER.GCS]: 'Google Cloud Storage',
})
