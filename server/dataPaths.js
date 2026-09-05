import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERCEL_DATA_DIR = join('/tmp', 'proposalforge-data')
const VERCEL_UPLOADS_DIR = join('/tmp', 'proposalforge-uploads')

let seeded = false

export function projectRoot() {
  return ROOT
}

export function isServerlessRuntime() {
  return Boolean(process.env.VERCEL)
}

/**
 * Local Vite uses `data/` in the repo.
 * Vercel serverless filesystems are read-only except `/tmp`, so production
 * copies seed JSON into `/tmp` for the lifetime of one instance.
 */
export function resolveDataDir() {
  return isServerlessRuntime() ? VERCEL_DATA_DIR : join(ROOT, 'data')
}

export function resolveUploadsDir() {
  return isServerlessRuntime() ? VERCEL_UPLOADS_DIR : join(ROOT, 'public', 'uploads')
}

export function ensureRuntimeData() {
  const dataDir = resolveDataDir()
  mkdirSync(dataDir, { recursive: true })
  if (isServerlessRuntime() && !seeded) {
    const source = join(ROOT, 'data')
    if (existsSync(source)) {
      for (const name of readdirSync(source)) {
        if (!name.endsWith('.json')) continue
        const dest = join(dataDir, name)
        if (!existsSync(dest)) copyFileSync(join(source, name), dest)
      }
    }
    seeded = true
  }
  return dataDir
}

/**
 * Vercel catch-all functions sometimes receive `/followups` instead of
 * `/api/followups`. Existing plugins match on the `/api/...` contract.
 */
export function normalizeApiUrl(url) {
  const raw = String(url || '/')
  let parsed
  try {
    parsed = new URL(raw, 'http://proposalforge.local')
  } catch {
    return raw
  }

  const routed = parsed.searchParams.get('__pf')
  if (routed) {
    parsed.searchParams.delete('__pf')
    const query = parsed.searchParams.toString()
    let path = routed
    if (!path.startsWith('/')) path = `/${path}`
    if (!path.startsWith('/api/') && path !== '/api') path = `/api${path}`
    return `${path}${query ? `?${query}` : ''}`
  }

  const path = parsed.pathname
  const query = parsed.search
  if (path === '/api' || path.startsWith('/api/')) return `${path}${query}`
  const next = path.startsWith('/') ? path : `/${path}`
  return `/api${next}${query}`
}
