/**
 * Reset inflated countapi values after spam testing.
 * Targets match the last known-good snapshot before hard testing.
 * Run: npm run reset:stats
 */

const API_BASE = 'https://countapi.mileshilliard.com/api/v1'

const TARGETS = {
  'cornell-meng-planner-daily-visitors': 84,
  'cornell-meng-planner-excel-exports': 4,
  'cornell-meng-planner-daily-desktop': 59,
  'cornell-meng-planner-daily-mobile': 25,
  'cornell-meng-planner-daily-tablet': 0,
}

async function setCounter(key, value) {
  const url = `${API_BASE}/set/${key}?value=${value}`
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${key}: HTTP ${response.status}`)
  }
  console.log(`${key} → ${data.value ?? value}`)
}

for (const [key, value] of Object.entries(TARGETS)) {
  await setCounter(key, value)
}

console.log('Done.')
