/**
 * Anonymous usage counters — no account or API key required.
 * countapi.xyz shut down; this uses the community replacement at countapi.mileshilliard.com
 */

const API_BASE = 'https://countapi.mileshilliard.com/api/v1'

export const COUNTERS = {
  visits: 'cornell-meng-planner-visits',
  mobile: 'cornell-meng-planner-device-mobile',
  tablet: 'cornell-meng-planner-device-tablet',
  desktop: 'cornell-meng-planner-device-desktop',
  statsViews: 'cornell-meng-planner-stats-page-views',
  excelExports: 'cornell-meng-planner-excel-exports',
} as const

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

const DEVICE_COUNTER: Record<DeviceType, string> = {
  mobile: COUNTERS.mobile,
  tablet: COUNTERS.tablet,
  desktop: COUNTERS.desktop,
}

const SESSION_VISIT_KEY = 'mem-planner-visit-recorded'
const API_TIMEOUT_MS = 8000

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

/** Record one visit per browser session (survives refresh, not new tabs). */
export async function recordPlannerVisit(): Promise<void> {
  if (sessionStorage.getItem(SESSION_VISIT_KEY)) return
  sessionStorage.setItem(SESSION_VISIT_KEY, '1')

  const device = detectDevice()
  await Promise.all([
    fetchCount('hit', COUNTERS.visits),
    fetchCount('hit', DEVICE_COUNTER[device]),
  ])
}

export async function recordStatsPageView(): Promise<number | null> {
  return fetchCount('hit', COUNTERS.statsViews)
}

export async function recordExcelExport(): Promise<void> {
  await fetchCount('hit', COUNTERS.excelExports)
}

export interface SiteStats {
  visits: number | null
  mobile: number | null
  tablet: number | null
  desktop: number | null
  statsViews: number | null
  excelExports: number | null
  deviceTotal: number
  lastFetched: Date
}

export async function fetchSiteStats(): Promise<SiteStats> {
  const [visits, mobile, tablet, desktop, statsViews, excelExports] = await Promise.all([
    fetchCount('get', COUNTERS.visits),
    fetchCount('get', COUNTERS.mobile),
    fetchCount('get', COUNTERS.tablet),
    fetchCount('get', COUNTERS.desktop),
    fetchCount('get', COUNTERS.statsViews),
    fetchCount('get', COUNTERS.excelExports),
  ])

  const deviceTotal = (mobile ?? 0) + (tablet ?? 0) + (desktop ?? 0)

  return {
    visits,
    mobile,
    tablet,
    desktop,
    statsViews,
    excelExports,
    deviceTotal,
    lastFetched: new Date(),
  }
}

export function devicePercent(count: number | null, total: number): number {
  if (!count || total <= 0) return 0
  return Math.round((count / total) * 100)
}
