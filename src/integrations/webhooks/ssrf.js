/**
 * H16.5 — SSRF / URL policy for outbound webhook destinations.
 *
 * Validates scheme + resolved addresses. Does not follow redirects.
 * Live path: https only. Test seam may allow http and inject DNS.
 *
 * IPv4-mapped IPv6 (::ffff:…) is normalized to the embedded IPv4 before
 * allow/deny checks (dotted and hex hextet forms).
 *
 * Known residual limitations (defer to H16.9+; not solved here):
 * - DNS validation vs connect-time rebinding / TOCTOU (fetch re-resolves)
 * - transport response.text() path may buffer a full body before size trim
 */

import dns from 'node:dns/promises'
import net from 'node:net'
import { OUTBOUND_WEBHOOK_FAILURE_CODE } from './types.js'

/** @type {(hostname: string) => Promise<Array<{ address: string, family: number }>> | null} */
let dnsResolverOverride = null

/**
 * @param {null | ((hostname: string) => Promise<Array<{ address: string, family: number }>>)} resolver
 */
export function setOutboundWebhookDnsResolverForTests(resolver) {
  dnsResolverOverride = typeof resolver === 'function' ? resolver : null
}

function parseIpv4(address) {
  const parts = String(address).split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/**
 * Expand an IPv6 literal into eight lowercase 4-char hextets.
 * Accepts dotted IPv4 tails (::ffff:127.0.0.1) by converting them to two hextets.
 *
 * @param {string} address
 * @returns {string[] | null}
 */
export function expandOutboundWebhookIpv6(address) {
  let addr = String(address ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (!addr || addr.includes('%')) {
    // Zone identifiers are not accepted for outbound destinations.
    return null
  }

  if (addr.includes('.')) {
    const lastColon = addr.lastIndexOf(':')
    if (lastColon < 0) return null
    const dotted = addr.slice(lastColon + 1)
    if (!net.isIPv4(dotted)) return null
    const parts = dotted.split('.').map((part) => Number(part))
    const hi = ((parts[0] << 8) | parts[1]).toString(16)
    const lo = ((parts[2] << 8) | parts[3]).toString(16)
    addr = `${addr.slice(0, lastColon)}:${hi}:${lo}`
  }

  if (addr.includes(':::')) return null
  const sides = addr.split('::')
  if (sides.length > 2) return null

  /** @type {string[]} */
  let head = []
  /** @type {string[]} */
  let tail = []
  if (sides.length === 1) {
    head = addr.split(':')
  } else {
    head = sides[0] === '' ? [] : sides[0].split(':')
    tail = sides[1] === '' ? [] : sides[1].split(':')
  }

  if (head.some((part) => part === '') || tail.some((part) => part === '')) return null
  const missing = 8 - head.length - tail.length
  if (missing < 0) return null
  if (sides.length === 1 && missing !== 0) return null

  const full = [...head, ...Array(Math.max(missing, 0)).fill('0'), ...tail]
  if (full.length !== 8) return null
  if (full.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null
  return full.map((part) => part.padStart(4, '0'))
}

/**
 * Extract embedded IPv4 from IPv4-mapped IPv6 (::ffff:x).
 * Supports dotted and hex-hextet forms, compressed or expanded.
 *
 * @param {string} address
 * @returns {string | null} dotted IPv4 or null
 */
export function extractIpv4FromMappedIpv6(address) {
  const hextets = expandOutboundWebhookIpv6(address)
  if (!hextets) return null
  // 0000:0000:0000:0000:0000:ffff:HHHH:LLLL
  if (
    hextets[0] !== '0000' ||
    hextets[1] !== '0000' ||
    hextets[2] !== '0000' ||
    hextets[3] !== '0000' ||
    hextets[4] !== '0000' ||
    hextets[5] !== 'ffff'
  ) {
    return null
  }
  const hi = Number.parseInt(hextets[6], 16)
  const lo = Number.parseInt(hextets[7], 16)
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

/**
 * Normalize an IP literal for allow/deny.
 * IPv4-mapped IPv6 becomes family 4 with the embedded address.
 *
 * @param {string} address
 * @returns {{ family: 4, address: string } | { family: 6, address: string, hextets: string[] } | null}
 */
export function normalizeOutboundWebhookIp(address) {
  const raw = String(address ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (!raw) return null

  if (net.isIPv4(raw)) {
    return { family: 4, address: raw }
  }

  const embedded = extractIpv4FromMappedIpv6(raw)
  if (embedded) {
    return { family: 4, address: embedded }
  }

  const hextets = expandOutboundWebhookIpv6(raw)
  if (!hextets) {
    // Fallback for parsers that accept the literal as IPv6 without our expander.
    if (net.isIPv6(raw)) {
      return { family: 6, address: raw, hextets: null }
    }
    return null
  }

  return {
    family: 6,
    address: hextets.join(':'),
    hextets,
  }
}

function isBlockedIpv4(address) {
  const n = parseIpv4(address)
  if (n == null) return true
  const a = (n >>> 24) & 0xff
  const b = (n >>> 16) & 0xff
  // loopback 127.0.0.0/8
  if (a === 127) return true
  // RFC1918
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  // link-local 169.254.0.0/16 (includes metadata 169.254.169.254)
  if (a === 169 && b === 254) return true
  // unspecified / broadcast-ish
  if (a === 0) return true
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

/**
 * @param {string[] | null} hextets
 * @param {string} raw
 */
function isBlockedIpv6(hextets, raw) {
  if (hextets && hextets.length === 8) {
    const isUnspecified = hextets.every((part) => part === '0000')
    if (isUnspecified) return true
    const isLoopback =
      hextets.slice(0, 7).every((part) => part === '0000') && hextets[7] === '0001'
    if (isLoopback) return true

    const first = Number.parseInt(hextets[0], 16)
    if (!Number.isFinite(first)) return true
    // unique local fc00::/7
    if ((first & 0xfe00) === 0xfc00) return true
    // link-local fe80::/10
    if ((first & 0xffc0) === 0xfe80) return true
    return false
  }

  const lower = String(raw ?? '').toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true
  }
  return false
}

/**
 * @param {string} address
 */
export function isBlockedOutboundWebhookIp(address) {
  const normalized = normalizeOutboundWebhookIp(address)
  if (!normalized) return true
  if (normalized.family === 4) return isBlockedIpv4(normalized.address)
  return isBlockedIpv6(normalized.hextets, normalized.address)
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc',
])

async function defaultLookup(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true })
}

/**
 * True when the host is an IP literal (v4, v6, or IPv4-mapped v6), not a DNS name.
 *
 * @param {string} hostname
 */
function isIpLiteralHost(hostname) {
  if (net.isIP(hostname)) return true
  return normalizeOutboundWebhookIp(hostname) != null
}

/**
 * @param {string} urlString
 * @param {{ allowHttp?: boolean }} [options]
 */
export async function validateOutboundWebhookUrl(urlString, options = {}) {
  const allowHttp = options.allowHttp === true
  let parsed
  try {
    parsed = new URL(String(urlString ?? '').trim())
  } catch {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_DESTINATION,
      message: 'Destination URL is invalid.',
    }
  }

  const protocol = parsed.protocol.toLowerCase()
  if (protocol === 'https:') {
    // ok
  } else if (protocol === 'http:' && allowHttp) {
    // test seam only
  } else if (
    protocol === 'file:' ||
    protocol === 'ftp:' ||
    protocol === 'data:' ||
    protocol === 'javascript:' ||
    protocol === 'http:'
  ) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
      message: 'Destination scheme is not allowed.',
    }
  } else {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
      message: 'Destination scheme is not allowed.',
    }
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
      message: 'Destination URL must not embed credentials.',
    }
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
      message: 'Destination host is blocked.',
    }
  }

  if (isIpLiteralHost(hostname)) {
    if (isBlockedOutboundWebhookIp(hostname)) {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
        message: 'Destination address is blocked.',
      }
    }
    return { ok: true, failureCode: null, message: null, url: parsed.toString() }
  }

  let records
  try {
    const resolver = dnsResolverOverride || defaultLookup
    records = await resolver(hostname)
  } catch {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.DNS_FAILURE,
      message: 'Destination DNS lookup failed.',
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.DNS_FAILURE,
      message: 'Destination DNS lookup returned no addresses.',
    }
  }

  for (const record of records) {
    const address = String(record?.address ?? '').trim()
    if (!address || isBlockedOutboundWebhookIp(address)) {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
        message: 'Destination resolved to a blocked address.',
      }
    }
  }

  return { ok: true, failureCode: null, message: null, url: parsed.toString() }
}
