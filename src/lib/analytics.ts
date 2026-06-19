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

const DEVICE_COUNTER: Record<DeviceType, string> = {
  mobile: COUNTERS.mobile,
  tablet: COUNTERS.tablet,
  desktop: COUNTERS.desktop,
}

const DAILY_VISIT_PREFIX = 'mem-planner-counted'
const API_TIMEOUT_MS = 8000

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

  const device = detectDevice()
  await Promise.all([
    fetchCount('hit', COUNTERS.dailyVisitors),
    fetchCount('hit', DEVICE_COUNTER[device]),
  ])
}

/** Every Excel export increments — intentional raw count. */
export async function recordExcelExport(): Promise<void> {
  await fetchCount('hit', COUNTERS.excelExports)
}

export interface SiteStats {
  dailyVisitors: number | null
  mobile: number | null
  tablet: number | null
  desktop: number | null
  excelExports: number | null
  deviceTotal: number
  lastFetched: Date
}

export async function fetchSiteStats(): Promise<SiteStats> {
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
    lastFetched: new Date(),
  }
}

export function devicePercent(count: number | null, total: number): number {
  if (!count || total <= 0) return 0
  return Math.round((count / total) * 100)
}
