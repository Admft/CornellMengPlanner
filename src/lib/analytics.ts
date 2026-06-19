/** Free public counter API — no account or API key required. https://countapi.xyz */

const NAMESPACE = 'cornell-meng-planner'

export const COUNTERS = {
  visits: 'visits',
  mobile: 'device-mobile',
  tablet: 'device-tablet',
  desktop: 'device-desktop',
  statsViews: 'stats-page-views',
  excelExports: 'excel-exports',
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
  return `https://api.countapi.xyz/${action}/${NAMESPACE}/${key}`
}

async function fetchCount(action: 'hit' | 'get', key: string): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    const response = await fetch(apiUrl(action, key), { signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return null
    const data = (await response.json()) as { value?: number }
    return typeof data.value === 'number' ? data.value : null
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
