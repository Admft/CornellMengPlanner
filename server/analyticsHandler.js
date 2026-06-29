import {
  getCachedSiteStats,
  hasExportCookie,
  hasVisitCookie,
  recordExportHit,
  recordVisitHit,
  stampExportCookie,
  stampVisitCookie,
  STATS_BROWSER_MAX_AGE_SEC,
} from './analyticsCore.js'
import {
  ANALYTICS_EVENT_LIMIT,
  checkRateLimit,
  clientIp,
  STATS_READ_LIMIT,
} from './rateLimit.js'

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value)
  }
  res.end(JSON.stringify(data))
}

function rateLimited(res, retryAfterMs) {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000))
  sendJson(
    res,
    429,
    { ok: false, error: `Too many requests. Try again in ${retryAfterSec} seconds.` },
    { 'Retry-After': String(retryAfterSec) },
  )
}

export async function handleGetStats(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  const { allowed, retryAfterMs } = checkRateLimit(`stats-read:${ip}`, STATS_READ_LIMIT)
  if (!allowed) {
    rateLimited(res, retryAfterMs)
    return
  }

  const force = req.url?.includes('refresh=1')
  const { payload, cache } = await getCachedSiteStats({ force })

  if (req.method === 'HEAD') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', `public, max-age=${STATS_BROWSER_MAX_AGE_SEC}`)
    res.setHeader('X-Cache', cache)
    res.end()
    return
  }

  sendJson(res, 200, { ok: true, stats: payload }, {
    'Cache-Control': `public, max-age=${STATS_BROWSER_MAX_AGE_SEC}`,
    'X-Cache': cache,
  })
}

export async function handleAnalyticsEvent(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  const { allowed, retryAfterMs } = checkRateLimit(`analytics-event:${ip}`, ANALYTICS_EVENT_LIMIT)
  if (!allowed) {
    rateLimited(res, retryAfterMs)
    return
  }

  const body = await readJsonBody(req)
  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { ok: false, error: 'Invalid request' })
    return
  }

  const kind = body.t
  if (kind !== 'v' && kind !== 'x') {
    sendJson(res, 400, { ok: false, error: 'Invalid request' })
    return
  }

  try {
    if (kind === 'v') {
      if (hasVisitCookie(req)) {
        res.statusCode = 204
        res.end()
        return
      }
      await recordVisitHit(req.headers['user-agent'] || '')
      stampVisitCookie(res)
      res.statusCode = 204
      res.end()
      return
    }

    if (hasExportCookie(req)) {
      res.statusCode = 204
      res.end()
      return
    }
    await recordExportHit()
    stampExportCookie(res)
    res.statusCode = 204
    res.end()
  } catch (error) {
    console.error('Analytics event failed:', error)
    sendJson(res, 500, { ok: false, error: 'Could not record event' })
  }
}

/** Shared handler for Express production server. */
export function mountAnalyticsRoutes(app) {
  app.get('/api/stats', (req, res) => {
    void handleGetStats(req, res)
  })
  app.post('/api/analytics-event', (req, res) => {
    void handleAnalyticsEvent(req, res)
  })
}

/** Vite plugin — serves analytics API during dev without a second process. */
export function analyticsDevPlugin() {
  return {
    name: 'analytics-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/api/stats') {
          void handleGetStats(req, res)
          return
        }
        if (url === '/api/analytics-event') {
          void handleAnalyticsEvent(req, res)
          return
        }
        next()
      })
    },
  }
}
