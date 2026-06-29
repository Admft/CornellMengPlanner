/**
 * Anonymous usage counters — no account or API key required.
 * countapi.xyz shut down; this uses the community replacement at countapi.mileshilliard.com
 *
 * Visitor counts are deduped client-side: one hit per browser per calendar day.
 * Excel exports count every download.
 */

const API_BASE = 'https://countapi.mileshilliard.com/api/v1'

export const COUNTERS = {
  dailyVisitors: 'cornell-meng-planner-daily-visitors',
  mobile: 'cornell-meng-planner-daily-mobile',
  tablet: 'cornell-meng-planner-daily-tablet',
  desktop: 'cornell-meng-planner-daily-desktop',
  excelExports: 'cornell-meng-planner-excel-exports',
} as const

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export interface SiteStats {
  dailyVisitors: number | null
  mobile: number | null
  tablet: number | null
  desktop: number | null
  excelExports: number | null
  deviceTotal: number
  lastFetched: Date
}

const DEVICE_COUNTER: Record<DeviceType, string> = {
  mobile: COUNTERS.mobile,
  tablet: COUNTERS.tablet,
  desktop: COUNTERS.desktop,
}

const DAILY_VISIT_PREFIX = 'mem-planner-counted'
const API_TIMEOUT_MS = 8000

/** Minimum values shown on /stats — live counts never display below these. */
export const STATS_FLOORS = {
  dailyVisitors: 84,
  excelExports: 4,
  desktop: 59,
  mobile: 25,
  tablet: 0,
} as const

const HIT_COOLDOWN_MS = 2000
const EXPORT_HIT_COOLDOWN_MS = 30_000
const STATS_REFRESH_COOLDOWN_MS = 5000

let lastGlobalHitAt = 0
let lastExportHitAt = 0
let lastStatsFetchAt = 0

function todayKey(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function dailyStorageKey(kind: string): string {
  return `${DAILY_VISIT_PREFIX}:${kind}:${todayKey()}`
}

/** Synchronous guard — safe even when React StrictMode runs effects twice. */
function markOnceToday(kind: string): boolean {
  const key = dailyStorageKey(kind)
  if (localStorage.getItem(key)) return false
  localStorage.setItem(key, '1')
  return true
}

function apiUrl(action: 'hit' | 'get', key: string) {
  return `${API_BASE}/${action}/${key}`
}

function parseValue(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const record = data as { value?: unknown; error?: string }
  if (record.error === 'Key not found') return 0
  const raw = record.value
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function hitCooldownRemaining(lastAt: number, cooldownMs: number): number {
  const elapsed = Date.now() - lastAt
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed
}

/** Milliseconds until another manual stats refresh is allowed (0 = ready). */
export function statsRefreshCooldownRemaining(): number {
  return hitCooldownRemaining(lastStatsFetchAt, STATS_REFRESH_COOLDOWN_MS)
}

function canRecordHit(now: number, lastAt: number, cooldownMs: number): boolean {
  return now - lastAt >= cooldownMs
}

function applyStatsFloors(
  raw: Omit<SiteStats, 'deviceTotal' | 'lastFetched'>,
): Omit<SiteStats, 'deviceTotal' | 'lastFetched'> {
  return {
    dailyVisitors: Math.max(STATS_FLOORS.dailyVisitors, raw.dailyVisitors ?? 0),
    excelExports: Math.max(STATS_FLOORS.excelExports, raw.excelExports ?? 0),
    desktop: Math.max(STATS_FLOORS.desktop, raw.desktop ?? 0),
    mobile: Math.max(STATS_FLOORS.mobile, raw.mobile ?? 0),
    tablet: Math.max(STATS_FLOORS.tablet, raw.tablet ?? 0),
  }
}

async function fetchCount(action: 'hit' | 'get', key: string): Promise<number | null> {
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

/** Parse user agent into mobile / tablet / desktop. */
export function detectDevice(): DeviceType {
  const ua = navigator.userAgent
  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  if (isTablet) return 'tablet'

  const isMobile =
    /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  if (isMobile) return 'mobile'

  return 'desktop'
}

/**
 * Record one daily visitor when someone opens the planner.
 * Same browser only counts once per calendar day; resets at midnight local time.
 */
export async function recordPlannerVisit(): Promise<void> {
  if (!markOnceToday('visit')) return

  const now = Date.now()
  if (!canRecordHit(now, lastGlobalHitAt, HIT_COOLDOWN_MS)) return
  lastGlobalHitAt = now

  const device = detectDevice()
  await Promise.all([
    fetchCount('hit', COUNTERS.dailyVisitors),
    fetchCount('hit', DEVICE_COUNTER[device]),
  ])
}

/** Every Excel export increments — rate-limited to reduce counter spam. */
export async function recordExcelExport(): Promise<void> {
  const now = Date.now()
  if (!canRecordHit(now, lastExportHitAt, EXPORT_HIT_COOLDOWN_MS)) return
  if (!canRecordHit(now, lastGlobalHitAt, HIT_COOLDOWN_MS)) return
  lastExportHitAt = now
  lastGlobalHitAt = now
  await fetchCount('hit', COUNTERS.excelExports)
}

/** Milliseconds until another export will be counted (0 = ready). */
export function excelExportCooldownRemaining(): number {
  return Math.max(
    hitCooldownRemaining(lastExportHitAt, EXPORT_HIT_COOLDOWN_MS),
    hitCooldownRemaining(lastGlobalHitAt, HIT_COOLDOWN_MS),
  )
}

export async function fetchSiteStats(options?: { skipRefreshLimit?: boolean }): Promise<SiteStats> {
  if (!options?.skipRefreshLimit) {
    const remaining = statsRefreshCooldownRemaining()
    if (remaining > 0) {
      throw new Error(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`)
    }
  }

  lastStatsFetchAt = Date.now()

  const [dailyVisitors, mobile, tablet, desktop, excelExports] = await Promise.all([
    fetchCount('get', COUNTERS.dailyVisitors),
    fetchCount('get', COUNTERS.mobile),
    fetchCount('get', COUNTERS.tablet),
    fetchCount('get', COUNTERS.desktop),
    fetchCount('get', COUNTERS.excelExports),
  ])

  const floored = applyStatsFloors({ dailyVisitors, mobile, tablet, desktop, excelExports })
  const deviceTotal =
    (floored.mobile ?? 0) + (floored.tablet ?? 0) + (floored.desktop ?? 0)

  return {
    ...floored,
    deviceTotal,
    lastFetched: new Date(),
  }
}

export function devicePercent(count: number | null, total: number): number {
  if (!count || total <= 0) return 0
  return Math.round((count / total) * 100)
}
