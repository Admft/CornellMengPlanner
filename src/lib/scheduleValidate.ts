import { excelSemesters, semIdx } from '../data/semesters'
import { courseKey, isCourseCompleted, hasWorkshopsDone } from '../data/courses'
import { getAllPlacements, resolveCourse } from './planEngine'
import type { GeneratedPlan, PlannerState } from '../types'
import { MIN_DEGREE_CREDITS, planToLayout, validateLayout } from './planLayout'

export interface ExportValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  placementCredits: number
}

export function validateScheduleForExport(state: PlannerState, plan: GeneratedPlan): ExportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const semesters = excelSemesters(state.programStartSem, state.planFromSem, state.gradSem)
  if (!semesters.length) errors.push('Choose valid start and graduation semesters.')
  const check = validateLayout(planToLayout(plan), plan.sems, state)
  if (!check.ok) errors.push(check.reason)
  if (plan.unscheduled.length) errors.push(`Unscheduled courses: ${plan.unscheduled.map(c => c.code).join(', ')}. Extend your plan or adjust your credit limit.`)
  const placements = getAllPlacements(state, plan)
  const placed = new Set(placements.filter(p => p.semIndex >= 0).map(p => p.course.id))
  const completed = [...state.taken].map(id => resolveCourse(id, state.curriculum))
  const planned = Object.values(plan.plan).flatMap(s => s.courses)
  const seen = new Set<string>()
  for (const course of [...completed, ...planned]) {
    if (!course) { errors.push('An unrecognized completed course must be corrected.'); continue }
    const key = courseKey(course)
    if (seen.has(key)) errors.push(`${key} is counted more than once. Choose one requirement category.`)
    seen.add(key)
    if (!placed.has(course.id)) errors.push(`${course.code} cannot fit in the 12 semester columns. Check its taken semester, program start and graduation dates.`)
  }
  for (const id of state.taken) {
    const term = state.takenSemesters[id]
    if (term && semIdx(term) >= semIdx(state.planFromSem)) errors.push(`${resolveCourse(id, state.curriculum)?.code ?? id}: a completed course must precede the next planning semester.`)
    if (!term) warnings.push('Completed courses without a semester are assigned to an eligible past term; verify those dates before submitting.')
  }
  const done = new Set([...state.taken, ...planned.map(c => c.id)])
  for (const c of state.curriculum.req) {
    if (!isCourseCompleted(c.id, done, { returningStudent: state.returningStudent })) errors.push(`Missing required course: ${c.code}.`)
  }
  if (!done.has(state.curriculum.res2.id) && !hasWorkshopsDone(done)) errors.push('Complete Residential Session II or both Professional Development workshops.')
  const all = [...completed.filter(c => !!c), ...planned, ...state.customTaken]
  if (!all.some(c => c.cat === 'org' && c.credits >= 3)) errors.push('Choose a 3-credit Organizational Behavior course.')
  if (all.filter(c => c.cat === 'el').length < 2) errors.push('At least two elective courses are required.')
  let customCredits = 0
  for (const c of state.customTaken) {
    if (!c.semCode || !semesters.some(s => s.code === c.semCode) || semIdx(c.semCode) >= semIdx(state.planFromSem)) {
      errors.push(`${c.code}: choose the actual completed semester within the export range and before your next semester.`)
    } else customCredits += c.credits
    if (!Number.isFinite(c.credits) || c.credits <= 0) errors.push(`${c.code}: invalid credits.`)
    if (seen.has(courseKey(c))) errors.push(`${c.code} is counted more than once.`)
    seen.add(courseKey(c))
  }
  const placementCredits = placements.filter(p => p.semIndex >= 0).reduce((n, p) => n + p.course.credits, 0) + customCredits
  if (placementCredits < MIN_DEGREE_CREDITS) errors.push(`Only ${placementCredits} credits would appear in Excel; at least 30 are required.`)
  return { ok: !errors.length, errors: [...new Set(errors)], warnings: [...new Set(warnings)], placementCredits }
}
