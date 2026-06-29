/**
 * Reset inflated countapi values after spam testing.
 * Targets match the last known-good snapshot before hard testing.
 * Run: npm run reset:stats
 */

import { COUNTERS, setRemoteCounter } from '../server/analyticsCore.js'

const TARGETS = {
  [COUNTERS.dailyVisitors]: 84,
  [COUNTERS.excelExports]: 4,
  [COUNTERS.desktop]: 59,
  [COUNTERS.mobile]: 25,
  [COUNTERS.tablet]: 0,
}

for (const [key, value] of Object.entries(TARGETS)) {
  const result = await setRemoteCounter(key, value)
  console.log(`${key} → ${result}`)
}

console.log('Done.')
