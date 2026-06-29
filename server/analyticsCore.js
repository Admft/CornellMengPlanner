/**
 * Server-only analytics — counter keys and countapi URLs never ship to the browser.
 */

const API_BASE = 'https://countapi.mileshilliard.com/api/v1'
const API_TIMEOUT_MS = 8000

/** @type {Record<string, string>} */
export const COUNTERS = {
  dailyVisitors: 'cornell-meng-planner-daily-visitors',
  mobile: 'cornell-meng-planner-daily-mobile',
  tablet: 'cornell-meng-planner-daily-tablet',
  desktop: 'cornell-meng-planner-daily-desktop',
  excelExports: 'cornell-meng-planner-excel-exports',
}

const DEVICE_COUNTER = {
  mobile: COUNTERS.mobile,
  tablet: COUNTERS.tablet,
  desktop: COUNTERS.desktop,
}

/** How long the server keeps a stats snapshot before re-fetching countapi. */
export const STATS_CACHE_TTL_MS = 90_000

/** Browsers may reuse the same JSON for this long (CDN + local cache). */
export const STATS_BROWSER_MAX_AGE_SEC = 60

const VISIT_COOKIE = 'mem_a_v'
const EXPORT_COOKIE = 'mem_a_x'

let statsCache = null

function apiUrl(action, key) {
  return `${API_BASE}/${action}/${key}`
}

function parseValue(data) {
  if (!data || typeof data !== 'object') return null
  if (data.error === 'Key not found') return 0
  const raw = data.value
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function fetchCount(action, key) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    const response = await fetch(apiUrl(action, key), { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return null
    const data = await response.json()
    return parseValue(data)
  } catch {
    return null
  }
}

export function detectDeviceFromUa(userAgent = '') {
  const ua = userAgent
  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  if (isTablet) return 'tablet'

  const isMobile =
    /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  if (isMobile) return 'mobile'

  return 'desktop'
}

function secondsUntilUtcMidnight() {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.max(60, Math.floor((end - now) / 1000))
}

export function readCookie(req, name) {
  const header = req.headers?.cookie
  if (!header || typeof header !== 'string') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function appendSetCookie(res, name, value, maxAgeSec) {
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax`
  const existing = res.getHeader?.('Set-Cookie')
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie])
  } else if (existing) {
    res.setHeader('Set-Cookie', [existing, cookie])
  } else {
    res.setHeader('Set-Cookie', cookie)
  }
}

export function invalidateStatsCache() {
  statsCache = null
}

async function pullRemoteStats() {
  const [dailyVisitors, mobile, tablet, desktop, excelExports] = await Promise.all([
    fetchCount('get', COUNTERS.dailyVisitors),
    fetchCount('get', COUNTERS.mobile),
    fetchCount('get', COUNTERS.tablet),
    fetchCount('get', COUNTERS.desktop),
    fetchCount('get', COUNTERS.excelExports),
  ])

  const deviceTotal = (mobile ?? 0) + (tablet ?? 0) + (desktop ?? 0)

  return {
    dailyVisitors,
    mobile,
    tablet,
    desktop,
    excelExports,
    deviceTotal,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ payload: object, cache: 'HIT' | 'MISS' }>}
 */
export async function getCachedSiteStats(options = {}) {
  const now = Date.now()
  if (
    !options.force &&
    statsCache &&
    statsCache.expiresAt > now
  ) {
    return { payload: statsCache.payload, cache: 'HIT' }
  }

  const payload = await pullRemoteStats()
  statsCache = {
    payload,
    expiresAt: now + STATS_CACHE_TTL_MS,
  }
  return { payload, cache: 'MISS' }
}

export async function recordVisitHit(userAgent) {
  const device = detectDeviceFromUa(userAgent)
  await Promise.all([
    fetchCount('hit', COUNTERS.dailyVisitors),
    fetchCount('hit', DEVICE_COUNTER[device]),
  ])
  invalidateStatsCache()
}

export async function recordExportHit() {
  await fetchCount('hit', COUNTERS.excelExports)
  invalidateStatsCache()
}

export async function setRemoteCounter(key, value) {
  const url = `${API_BASE}/set/${key}?value=${value}`
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${key}: HTTP ${response.status}`)
  }
  invalidateStatsCache()
  return data.value ?? value
}

export function hasVisitCookie(req) {
  return readCookie(req, VISIT_COOKIE) === '1'
}

export function hasExportCookie(req) {
  return readCookie(req, EXPORT_COOKIE) === '1'
}

export function stampVisitCookie(res) {
  appendSetCookie(res, VISIT_COOKIE, '1', secondsUntilUtcMidnight())
}

export function stampExportCookie(res) {
  appendSetCookie(res, EXPORT_COOKIE, '1', secondsUntilUtcMidnight())
}
