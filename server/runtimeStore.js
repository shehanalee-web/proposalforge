import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isServerlessRuntime, projectRoot, resolveDataDir, resolveUploadsDir } from './dataPaths.js'

const JSON_TOKEN_NAME = 'BLOB_READ_WRITE_TOKEN'
const MEDIA_TOKEN_NAME = 'BLOB_MEDIA_READ_WRITE_TOKEN'
const SEED_JSON_FILES = new Set(['proposals.json', 'assets.json'])

export class StorageUnavailableError extends Error {
  constructor(message = 'Durable storage is not configured.') {
    super(message)
    this.name = 'StorageUnavailableError'
    this.status = 503
  }
}

/** @type {null | { put: Function, get: Function, del: Function, list?: Function }} */
let testJsonDriver = null
/** @type {null | { put: Function, get: Function, del: Function, list?: Function }} */
let testMediaDriver = null
const blobSeeded = new Set()
/** @type {Set<Promise<unknown>>} */
const inflightWrites = new Set()

export function jsonObjectKey(name) {
  const base = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
  if (!base || !base.endsWith('.json')) {
    throw new Error('JSON documents must use a .json filename.')
  }
  return `data/${base}`
}

export function mediaObjectKey(key) {
  const normalized = String(key || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!normalized) throw new Error('A media key is required.')
  if (normalized.startsWith('uploads/')) return normalized
  if (normalized.startsWith('data/')) {
    throw new Error('JSON documents cannot be stored as public media.')
  }
  return `uploads/${normalized}`
}

function jsonToken() {
  return String(process.env[JSON_TOKEN_NAME] || '')
}

function mediaToken() {
  return String(process.env[MEDIA_TOKEN_NAME] || '')
}

export function jsonStoreEnabled() {
  return Boolean(testJsonDriver) || (isServerlessRuntime() && Boolean(jsonToken()))
}

export function mediaStoreEnabled() {
  return Boolean(testMediaDriver) || (isServerlessRuntime() && Boolean(mediaToken()))
}

export function assertJsonWritable() {
  if (isServerlessRuntime() && !jsonStoreEnabled()) {
    throw new StorageUnavailableError()
  }
}

export function assertMediaWritable() {
  if (isServerlessRuntime() && !mediaStoreEnabled()) {
    throw new StorageUnavailableError()
  }
}

/** JSON persist callbacks. Media uploads use assertMediaWritable instead. */
export function assertStorageWritable() {
  assertJsonWritable()
}

/**
 * Test-only drivers. Pass `{ json, media }` so each store is targeted separately.
 */
export function installTestBlobDriver(driver) {
  testJsonDriver = driver?.json || null
  testMediaDriver = driver?.media || null
}

export function resetRuntimeStoreTestState() {
  testJsonDriver = null
  testMediaDriver = null
  blobSeeded.clear()
  inflightWrites.clear()
}

async function jsonDriver() {
  if (testJsonDriver) return testJsonDriver
  return import('@vercel/blob')
}

async function mediaDriver() {
  if (testMediaDriver) return testMediaDriver
  return import('@vercel/blob')
}

function jsonPutOptions(extra = {}) {
  const options = {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    ...extra,
  }
  const token = jsonToken()
  if (token) options.token = token
  return options
}

function jsonGetOptions() {
  const options = { access: 'private', useCache: false }
  const token = jsonToken()
  if (token) options.token = token
  return options
}

function mediaPutOptions(contentType, extra = {}) {
  const options = {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...extra,
  }
  const token = mediaToken()
  if (token) options.token = token
  return options
}

function mediaDelOptions() {
  const options = {}
  const token = mediaToken()
  if (token) options.token = token
  return options
}

async function streamToString(stream) {
  if (stream == null) return ''
  if (typeof stream === 'string') return stream
  if (Buffer.isBuffer(stream)) return stream.toString('utf8')
  if (typeof stream.text === 'function') return stream.text()
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function localJsonPath(name) {
  return join(resolveDataDir(), jsonObjectKey(name).slice('data/'.length))
}

function localMediaPath(key) {
  const objectKey = mediaObjectKey(key)
  return join(resolveUploadsDir(), objectKey.slice('uploads/'.length))
}

function localMediaUrl(key) {
  return `/${mediaObjectKey(key)}`
}

function seedFilePath(name) {
  return join(projectRoot(), 'data', jsonObjectKey(name).slice('data/'.length))
}

function readLocalJsonText(name) {
  try {
    return readFileSync(localJsonPath(name), 'utf8')
  } catch {
    return null
  }
}

function trackPromise(work) {
  let tracked
  const job = Promise.resolve()
    .then(work)
    .finally(() => {
      inflightWrites.delete(tracked)
    })
  tracked = job
  inflightWrites.add(tracked)
  return tracked
}

function trackWrite(work) {
  return trackPromise(() => work)
}

/**
 * Register a persistence operation before it starts.
 * `start` runs only after the promise is in the in-flight set, so a later
 * flush waits for the read that precedes the write.
 */
export function trackRuntimeOperation(start) {
  return trackPromise(start)
}

/**
 * Await every writeJson / putBlob / deleteBlob that has not settled.
 * Rejects if any tracked write failed.
 */
export async function flushRuntimeWrites() {
  while (inflightWrites.size > 0) {
    await Promise.all([...inflightWrites])
  }
}

/**
 * Send a JSON HTTP body only after pending durable writes have settled.
 * A failed write on a success status becomes 503/500 instead of a false 200.
 */
export async function endJsonResponse(res, status, body) {
  try {
    await flushRuntimeWrites()
  } catch (error) {
    if (status < 400) {
      status = error.status || 500
      body = { message: error.message || 'Could not persist.' }
    }
  }
  if (res.headersSent) return
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

export async function flushAndNext(next) {
  await flushRuntimeWrites()
  return next()
}

async function readBlobJsonText(name) {
  const key = jsonObjectKey(name)
  const driver = await jsonDriver()
  const result = await driver.get(key, jsonGetOptions())
  if (!result || result.statusCode !== 200) return null
  return streamToString(result.stream)
}

async function seedBlobJson(name) {
  const key = jsonObjectKey(name)
  const fileName = key.slice('data/'.length)
  if (blobSeeded.has(key)) return null
  if (!SEED_JSON_FILES.has(fileName)) {
    blobSeeded.add(key)
    return null
  }
  const seedPath = seedFilePath(name)
  if (!existsSync(seedPath)) {
    blobSeeded.add(key)
    return null
  }
  const text = readFileSync(seedPath, 'utf8')
  JSON.parse(text)
  const driver = await jsonDriver()
  await trackWrite(driver.put(key, text, jsonPutOptions()))
  blobSeeded.add(key)
  return text
}

/**
 * Read a JSON document by filename (`templates.json` → `data/templates.json`).
 * Missing or unreadable documents return `fallback`.
 */
export async function readJson(name, fallback) {
  try {
    if (jsonStoreEnabled()) {
      let text = await readBlobJsonText(name)
      if (text == null) text = await seedBlobJson(name)
      if (text == null) return fallback
      return JSON.parse(text)
    }
    if (isServerlessRuntime()) return fallback
    const text = readLocalJsonText(name)
    if (text == null) return fallback
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw error
    return fallback
  }
}

export async function readJsonText(name) {
  if (jsonStoreEnabled()) {
    let text = await readBlobJsonText(name)
    if (text == null) text = await seedBlobJson(name)
    return text
  }
  if (isServerlessRuntime()) return null
  return readLocalJsonText(name)
}

export async function ignoreUnavailableWrite(work) {
  try {
    await work()
  } catch (error) {
    if (error?.status !== 503) throw error
  }
}

async function writeJsonNow(name, value) {
  assertJsonWritable()
  const body = `${JSON.stringify(value, null, 2)}\n`
  if (jsonStoreEnabled()) {
    const key = jsonObjectKey(name)
    const driver = await jsonDriver()
    await driver.put(key, body, jsonPutOptions())
    return
  }
  const file = localJsonPath(name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
}

/**
 * Replace a JSON document. Always private JSON store. Last-write-wins.
 */
export function writeJson(name, value) {
  return trackWrite(writeJsonNow(name, value))
}

async function putBlobNow(key, bytes, contentType) {
  assertMediaWritable()
  const pathname = mediaObjectKey(key)
  const type = contentType || 'application/octet-stream'
  if (mediaStoreEnabled()) {
    const driver = await mediaDriver()
    const result = await driver.put(pathname, bytes, mediaPutOptions(type))
    const url = String(result?.url || '')
    if (!/^https:\/\//i.test(url)) {
      throw new Error('Production media must return an https URL.')
    }
    return { url, pathname: result?.pathname || pathname }
  }
  const file = localMediaPath(pathname)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes)
  return { url: localMediaUrl(pathname), pathname }
}

/**
 * Store media bytes. Local: `public/uploads/...`. Production: public Blob store.
 * @returns {Promise<{ url: string, pathname: string }>}
 */
export function putBlob(key, bytes, contentType) {
  return trackWrite(putBlobNow(key, bytes, contentType))
}

async function deleteBlobNow(key) {
  assertMediaWritable()
  const pathname = mediaObjectKey(key)
  if (mediaStoreEnabled()) {
    const driver = await mediaDriver()
    const options = mediaDelOptions()
    const urls = []
    if (typeof driver.list === 'function') {
      const listed = await driver.list({ prefix: pathname, ...options })
      for (const blob of listed?.blobs || []) {
        if (blob?.url) urls.push(blob.url)
        else if (blob?.pathname) urls.push(blob.pathname)
      }
    }
    if (urls.length > 0) await driver.del(urls, options)
    else await driver.del(pathname, options)
    return
  }
  rmSync(localMediaPath(pathname), { recursive: true, force: true })
}

/**
 * Delete a media object or prefix (proposal-file folders).
 */
export function deleteBlob(key) {
  return trackWrite(deleteBlobNow(key))
}
