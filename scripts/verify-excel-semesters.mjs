/**
 * Quick sanity check for Cornell template column alignment (E=SU1, F=FA1, G=SP1, …).
 * Run: node scripts/verify-excel-semesters.mjs
 */

const SEMS = []
for (let year = 2020; year <= 2032; year++) {
  SEMS.push({ code: `SP${String(year).slice(2)}`, season: 'Spring', year })
  SEMS.push({ code: `SU${String(year).slice(2)}`, season: 'Summer', year })
  SEMS.push({ code: `FA${String(year).slice(2)}`, season: 'Fall', year })
}

const ORDER = ['Summer', 'Fall', 'Spring']
const COLS = 'EFGHIJKLMNOP'.split('')

function semIdx(code) {
  return SEMS.findIndex((s) => s.code === code)
}

function excelSemesters(programStart, grad, maxCols = 12) {
  const startIdx = semIdx(programStart)
  const gradIdx = semIdx(grad)
  const startSeasonIdx = ORDER.indexOf(SEMS[startIdx].season)
  const result = []
  for (let t = 0; t < maxCols; t++) {
    const calIdx = startIdx + (t - startSeasonIdx)
    if (calIdx < 0 || calIdx >= SEMS.length) break
    const sem = SEMS[calIdx]
    if (semIdx(sem.code) > gradIdx) break
    result.push(sem)
  }
  return result
}

const cases = [
  { start: 'SP26', grad: 'SP28', expectG: 'SP26' },
  { start: 'SU26', grad: 'SP28', expectE: 'SU26' },
  { start: 'FA26', grad: 'SP28', expectF: 'FA26' },
]

for (const { start, grad, expectG, expectE, expectF } of cases) {
  const cols = excelSemesters(start, grad)
  const label = cols.map((s, i) => `${COLS[i]}=${s.code}`).join(' ')
  console.log(start, '→', label)
  if (expectG) console.assert(cols[2]?.code === expectG, `expected G=${expectG}`)
  if (expectE) console.assert(cols[0]?.code === expectE, `expected E=${expectE}`)
  if (expectF) console.assert(cols[1]?.code === expectF, `expected F=${expectF}`)
}

console.log('excelSemesters alignment OK')
