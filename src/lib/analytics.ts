/**
 * Client analytics — talks only to our API routes.
 * Counter keys and the upstream countapi service stay on the server.
 */

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

const DAILY_VISIT_PREFIX = 'mem-planner-counted'
const STATS_REFRESH_COOLDOWN_MS = 5000
const API_TIMEOUT_MS = 8000

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

/** Client-side guard — skips redundant server calls. Server enforces its own limits too. */
function markOnceToday(kind: string): boolean {
  const key = dailyStorageKey(kind)
  if (localStorage.getItem(key)) return false
  localStorage.setItem(key, '1')
  return true
}

function hitCooldownRemaining(lastAt: number, cooldownMs: number): number {
  const elapsed = Date.now() - lastAt
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed
}

/** Milliseconds until another manual stats refresh is allowed (0 = ready). */
export function statsRefreshCooldownRemaining(): number {
  return hitCooldownRemaining(lastStatsFetchAt, STATS_REFRESH_COOLDOWN_MS)
}

async function postAnalyticsEvent(kind: 'v' | 'x'): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    await fetch('/api/analytics-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: kind }),
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch {
    // Stats are best-effort — never block the planner.
  }
}

/** Parse user agent into mobile / tablet / desktop (display only). */
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

/** Record one daily visitor when someone opens the planner. */
export async function recordPlannerVisit(): Promise<void> {
  if (!markOnceToday('visit')) return
  await postAnalyticsEvent('v')
}

/** Count at most one Excel export per browser per calendar day. */
export async function recordExcelExport(): Promise<void> {
  if (!markOnceToday('export')) return
  await postAnalyticsEvent('x')
}

export async function fetchSiteStats(options?: {
  skipRefreshLimit?: boolean
  force?: boolean
}): Promise<SiteStats> {
  if (!options?.skipRefreshLimit) {
    const remaining = statsRefreshCooldownRemaining()
    if (remaining > 0) {
      throw new Error(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`)
    }
  }

  lastStatsFetchAt = Date.now()

  const url = options?.force ? '/api/stats?refresh=1' : '/api/stats'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait and try again.')
    }
    if (!response.ok) {
      throw new Error('Could not load stats.')
    }

    const data = (await response.json()) as {
      ok?: boolean
      stats?: {
        dailyVisitors: number | null
        mobile: number | null
        tablet: number | null
        desktop: number | null
        excelExports: number | null
        deviceTotal: number
        updatedAt?: string
      }
    }

    const stats = data.stats
    if (!stats) {
      throw new Error('Could not load stats.')
    }

    return {
      dailyVisitors: stats.dailyVisitors,
      mobile: stats.mobile,
      tablet: stats.tablet,
      desktop: stats.desktop,
      excelExports: stats.excelExports,
      deviceTotal: stats.deviceTotal,
      lastFetched: stats.updatedAt ? new Date(stats.updatedAt) : new Date(),
    }
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
}

export function devicePercent(count: number | null, total: number): number {
  if (!count || total <= 0) return 0
  return Math.round((count / total) * 100)
}
