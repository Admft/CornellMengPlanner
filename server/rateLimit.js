/** Simple in-memory sliding-window rate limiter (per process). */

const buckets = new Map()

/**
 * @param {string} key Unique bucket id (e.g. client IP + route)
 * @param {{ windowMs: number, max: number }} options
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(key, { windowMs, max }) {
  const now = Date.now()
  const windowStart = now - windowMs
  let timestamps = buckets.get(key)

  if (!timestamps) {
    timestamps = []
    buckets.set(key, timestamps)
  }

  while (timestamps.length > 0 && timestamps[0] <= windowStart) {
    timestamps.shift()
  }

  if (timestamps.length >= max) {
    const retryAfterMs = Math.max(0, timestamps[0] + windowMs - now)
    return { allowed: false, retryAfterMs }
  }

  timestamps.push(now)
  return { allowed: true, retryAfterMs: 0 }
}

/** Best-effort client IP behind proxies (Vercel, nginx, etc.). */
export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  if (typeof req.headers?.['x-real-ip'] === 'string') {
    return req.headers['x-real-ip']
  }
  return req.socket?.remoteAddress || 'unknown'
}

export const FEATURE_REQUEST_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
}

/** Reading the public stats page JSON. */
export const STATS_READ_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 30,
}

/** Visit / export beacons — backup IP cap if cookies are cleared. */
export const ANALYTICS_EVENT_LIMIT = {
  windowMs: 60 * 60 * 1000,
  max: 12,
}
