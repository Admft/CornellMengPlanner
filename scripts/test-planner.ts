import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { DEFAULT_STATE, type PlannerState, type Course } from '../src/types'
import { DEFAULT_CURRICULUM, getCourseById, isOfferedIn } from '../src/data/courses'
import { semRange, excelSemesters } from '../src/data/semesters'
import { generatePlan, getCreditTotals } from '../src/lib/planEngine'
import { canPlaceCourse, canSwapCourses, layoutToPlan, planToLayout } from '../src/lib/planLayout'
import { validateScheduleForExport } from '../src/lib/scheduleValidate'
import { buildProposalWorkbook } from '../src/lib/excelExport'
import { importCurriculumFromXlsx } from '../src/lib/curriculumImport'

async function main() {
const state: PlannerState = { ...DEFAULT_STATE, curriculum: DEFAULT_CURRICULUM, name: 'Regression Student', programStartSem: 'SU26', planFromSem: 'SU26', gradSem: 'SP29', crLimit: 8, taken: new Set(), takenSemesters: {}, elChoices: new Set(['EN6020el', 'EN6095']), obChoice: 'EN5300', resChoice: 'workshops' }
const course = (id: string) => getCourseById(id)!
const plan = generatePlan(state)
assert.equal(plan.unscheduled.length, 0)
assert.equal(validateScheduleForExport(state, plan).ok, true)
assert.deepEqual(course('EN6010').seasons, ['Fall'])
assert.deepEqual(course('EN6011').seasons, ['Spring'])
assert.equal(isOfferedIn(course('EN5941'), semRange('SP26', 'SP26')[0]), false)
assert.equal(isOfferedIn(course('EN5941'), semRange('SP28', 'SP28')[0]), true)
assert.equal(excelSemesters('SP26', 'FA26', 'SP28')[0].code, 'SP26')
const sems = semRange('FA26', 'FA28')
const layout = Object.fromEntries(sems.map(s => [s.code, [] as string[]]))
layout.FA26 = ['EN5930']; layout.SP28 = ['EN5910']
const movingState = { ...state, taken: new Set(['EN5900', 'EN5940', 'EN5980']) }
const movingPlan = layoutToPlan(layout, sems, state.curriculum)
assert.equal(canPlaceCourse(course('EN5930'), sems.find(s => s.code === 'FA27')!, sems, movingPlan.plan, movingState, { fromSemCode: 'FA26' }).ok, true)
assert.equal(canPlaceCourse(course('EN5930'), sems.find(s => s.code === 'SP27')!, sems, movingPlan.plan, movingState, { fromSemCode: 'FA26' }).ok, false)
assert.equal(canPlaceCourse(course('EN5930'), sems.find(s => s.code === 'FA28')!, sems, movingPlan.plan, movingState, { fromSemCode: 'FA26' }).ok, true)
layout.FA28 = ['EN5200']
assert.equal(canSwapCourses(course('EN5930'), 'FA26', course('EN5200'), 'FA28', sems, layout, movingState).ok, true)
const duplicate = { ...state, obChoice: 'EN6020', elChoices: new Set(['EN6020el', 'EN6095', 'EN5500']) }
assert.equal(Object.values(generatePlan(duplicate).plan).flatMap(s => s.courses).filter(c => c.code === 'ENMGT 6020').length, 1)
const legacy = { ...state, returningStudent: true, programStartSem: 'SP25', planFromSem: 'FA26', gradSem: 'SP28', taken: new Set(['EN5930_legacy', 'EN5940', 'EN5080', 'EN6001']), takenSemesters: { EN5930_legacy: 'FA25', EN5940: 'SP26', EN5080: 'SU25', EN6001: 'SU25' }, elChoices: new Set(['EN6020el', 'EN5500', 'EN6095']) }
// Twelve completed credits can be enough, but the identity of those credits matters.
const feasible12 = { ...state, planFromSem: 'SP27', gradSem: 'FA27', crLimit: 12,
  taken: new Set(['EN5900', 'EN5930', 'EN5980', 'EN5080', 'EN6001']) }
const fastPlan = generatePlan(feasible12)
assert.equal(getCreditTotals(feasible12).takenCredits, 12)
assert.equal(fastPlan.unscheduled.length, 0)
assert.ok(fastPlan.plan.FA27.courses.some(c => c.id === 'EN5910'))
const userCourses = { ...state, returningStudent: true, planFromSem: 'SP27', gradSem: 'FA27', crLimit: 12,
  taken: new Set(['EN5940', 'EN5080', 'EN6001', 'EN5980', 'EN5960']), obChoice: '', elChoices: new Set(['EN5500', 'EN6020el']), resChoice: 'session2' as const }
const userPlan = generatePlan(userCourses)
assert.equal(getCreditTotals(userCourses).takenCredits, 12)
assert.deepEqual(userPlan.unscheduled, [])
assert.equal(getCreditTotals(userCourses).total, 30)
assert.ok(userPlan.plan.FA27.courses.some(c => c.id === 'EN5910'))
assert.ok(userPlan.plan.FA27.courses.some(c => c.id === 'EN5930'))
assert.ok(userPlan.plan.SP27.courses.some(c => c.id === 'EN5900'))
const extendedUserPlan = generatePlan({ ...userCourses, gradSem: 'SP28' })
assert.equal(extendedUserPlan.unscheduled.length, 0)
assert.equal(getCreditTotals(userCourses, extendedUserPlan).total, 30)
// Compare the solver to exhaustive enumeration on small independent fixtures.
function bruteFits(input: PlannerState, required: Course[]): boolean {
  const terms = semRange(input.planFromSem, input.gradSem)
  const assigned: number[] = []
  const visit = (index: number): boolean => {
    if (index === required.length) return required.every((c, i) => c.prereqs.every(p => assigned[required.findIndex(x => x.id === p)] < assigned[i]))
    return terms.some((term, t) => {
      if (!isOfferedIn(required[index], term)) return false
      const load = assigned.reduce((n, a, j) => n + (a === t ? required[j].credits : 0), required[index].credits)
      if (load > (term.season === 'Summer' ? 2 : input.crLimit)) return false
      assigned.push(t)
      const found = visit(index + 1)
      assigned.pop()
      return found
    })
  }
  return visit(0)
}
const trapCourses: Course[] = [
  { ...course('EN5900'), id: 'FLEX', code: 'TEST FLEX', credits: 3, seasons: ['Spring', 'Fall'], prereqs: [], pri: 1 },
  { ...course('EN5900'), id: 'SPRING', code: 'TEST SPRING', credits: 3, seasons: ['Spring'], prereqs: [], pri: 2 },
  { ...course('EN5910'), id: 'CAP', code: 'TEST CAP', credits: 1, seasons: ['Fall'], prereqs: ['SPRING'], pri: 3 },
]
const trap = { ...state, planFromSem: 'SP27', gradSem: 'FA27', crLimit: 4, curriculum: { ...DEFAULT_CURRICULUM, req: trapCourses }, taken: new Set(['EN6002']), obChoice: '', elChoices: new Set<string>() }
const escaped = generatePlan(trap)
assert.equal(escaped.unscheduled.length, 0)
assert.deepEqual(escaped.plan.SP27.courses.map(c => c.id), ['SPRING'])
assert.ok(escaped.plan.FA27.courses.some(c => c.id === 'FLEX'))
const electives = [
  { ...course('EN5200'), id: 'FALL', code: 'TEST FALL', credits: 3, seasons: ['Fall'] as Course['seasons'] },
  { ...course('EN5500'), id: 'SPRING', code: 'TEST SPRING', credits: 3, seasons: ['Spring'] as Course['seasons'] },
  { ...course('EN5500'), id: 'SUMMER', code: 'TEST SUMMER', credits: 1, seasons: ['Summer'] as Course['seasons'] },
]
const electiveFixture = { ...trap, curriculum: { ...DEFAULT_CURRICULUM, req: [{ ...trapCourses[0], seasons: ['Fall'] as Course['seasons'] }], el: electives },
  customTaken: [{ id: 'history', code: 'HIST', name: 'Historical credits', credits: 22, cat: 'req' as const }], elChoices: new Set(electives.map(c => c.id)) }
const electivePlan = generatePlan(electiveFixture)
assert.equal(electivePlan.unscheduled.length, 0)
assert.ok(electivePlan.plan.SP27.courses.some(c => c.id === 'SPRING'))
assert.ok(!Object.values(electivePlan.plan).some(s => s.courses.some(c => c.id === 'FALL')))
for (let seed = 0; seed < 96; seed++) {
  const req: Course[] = Array.from({ length: 4 }, (_, i) => ({ ...course('EN5900'), id: `TEST${i}`, code: `TEST ${i}`, pri: i,
    credits: 1 + ((seed >> i) % 4), seasons: ((seed + i) % 3 === 0 ? ['Spring'] : (seed + i) % 3 === 1 ? ['Fall'] : ['Spring', 'Fall']) as Course['seasons'],
    prereqs: i === 3 && seed % 2 === 0 ? ['TEST1'] : [] }))
  const fixture = { ...state, planFromSem: 'SP27', gradSem: 'FA28', crLimit: 4,
    curriculum: { ...DEFAULT_CURRICULUM, req }, taken: new Set(['EN6002']), obChoice: '', elChoices: new Set<string>() }
  const generated = generatePlan(fixture)
  assert.equal(generated.unscheduled.length === 0, bruteFits(fixture, req), `solver feasibility seed ${seed}`)
  if (!generated.unscheduled.length) {
    const placement = new Map(Object.values(generated.plan).flatMap((s, t) => s.courses.map(c => [c.id, t] as const)))
    req.forEach(c => c.prereqs.forEach(p => assert.ok(placement.get(p)! < placement.get(c.id)!)))
    Object.values(generated.plan).forEach(s => assert.ok(s.cr <= (s.sem.season === 'Summer' ? 2 : fixture.crLimit)))
  }
}
console.log('Optimizer: concurrent-capstone 12-credit scenarios and 96 exhaustive feasibility comparisons passed.')
const template = await fs.readFile('public/Cornellproposal.xlsx')
for (const [label, input] of [['incoming', state], ['legacy', legacy], ['custom', { ...legacy, customTaken: [{ id: 'custom1', code: 'TEST 1234', name: 'Approved historical elective', credits: 1.5, cat: 'el', semCode: 'SP26' }] }]] as const) {
  const p = generatePlan(input as PlannerState)
  const validation = validateScheduleForExport(input as PlannerState, p)
  assert.equal(validation.ok, true, `${label}: ${validation.errors.join(' ')}`)
  const w = await buildProposalWorkbook(input as PlannerState, template as unknown as ArrayBuffer, p)
  const saved = await w.xlsx.writeBuffer()
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(saved)
  const sheet = reopened.worksheets[0]
  assert.equal(sheet.getCell('H52').result, getCreditTotals(input as PlannerState, p).total)
  let actual = 0
  for (const [a,b] of [[13,24],[29,32],[36,48]]) for(let r=a;r<=b;r++) for(let c=5;c<=16;c++) actual += Number(sheet.getCell(r,c).value ?? 0)
  assert.equal(actual, sheet.getCell('H52').result)
  assert.equal(sheet.getCell('E12').value, input.programStartSem)
  assert.equal(sheet.getCell('E25').alignment.indent, undefined)
  if (label === 'incoming') {
    assert.equal((sheet.getCell('E13').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFFFFFFF')
    assert.equal((sheet.getCell('F13').fill as ExcelJS.FillPattern).fgColor?.argb, 'FFE7E6E6')
  }
  if(label === 'legacy') {
    let found = false
    sheet.eachRow(row => { if(row.getCell(2).text === 'ENMGT 5940') { assert.equal(row.getCell(4).value, 4); found = true } })
    assert.ok(found)
  }
  await fs.writeFile(`/tmp/cornell-${label}-verified.xlsx`, Buffer.from(saved))
  console.log(`${label}: saved/reopened workbook, ${actual} credits, formulas and term headers verified`)
}
const overflow = { ...state, programStartSem: 'SP20' }
assert.equal(validateScheduleForExport(overflow, plan).ok, false)
const missingCustom = { ...legacy, customTaken: [{ id: 'custom', code: 'TEST', name: 'Test', credits: 3, cat: 'el' as const }] }
assert.equal(validateScheduleForExport(missingCustom, generatePlan(missingCustom)).ok, false)
const missing = layoutToPlan(planToLayout(plan), plan.sems, state.curriculum)
for(const term of Object.values(missing.plan)) term.courses = term.courses.filter(c => c.id !== 'EN5980')
assert.equal(validateScheduleForExport(state, missing).ok, false)
const old = await fs.readFile('OldCornellproposal.xlsx')
const imported = await importCurriculumFromXlsx(old as unknown as ArrayBuffer)
assert.equal(imported.catalog.req.find(c => c.id === 'EN5930')?.credits, 3)
assert.equal(imported.catalog.req.some(c => c.id === 'EN5940'), false)
assert.deepEqual(imported.catalog.pd1.seasons, ['Fall'])
assert.deepEqual(imported.catalog.req.find(c => c.id === 'EN5910')?.prereqs, [])
console.log('All planner/export regression checks passed.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
