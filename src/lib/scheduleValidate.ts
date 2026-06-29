import { excelSemesters } from '../data/semesters'
import { getAllPlacements, resolveCourse } from './planEngine'
import type { GeneratedPlan, PlannerState } from '../types'
import { MIN_DEGREE_CREDITS } from './planLayout'

export interface ExportValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  placementCredits: number
}

/** Block Excel download when the schedule is incomplete or misaligned. */
export function validateScheduleForExport(
  state: PlannerState,
  plan: GeneratedPlan,
): ExportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const takenCr = [...state.taken].reduce((sum, id) => {
    const course = resolveCourse(id, state.curriculum)
    return sum + (course?.credits ?? 0)
  }, 0)
  const customCr = state.customTaken.reduce((sum, c) => sum + c.credits, 0)
  const plannedCr = Object.values(plan.plan).reduce((sum, sem) => sum + sem.cr, 0)
  const total = takenCr + customCr + plannedCr

  if (plan.unscheduled.length > 0) {
    errors.push(
      `${plan.unscheduled.length} course(s) could not be scheduled: ${plan.unscheduled.map((c) => c.code).join(', ')}. Adjust your plan or graduation date before exporting.`,
    )
  }

  if (total < MIN_DEGREE_CREDITS) {
    errors.push(
      `Plan totals ${total} credits — at least ${MIN_DEGREE_CREDITS} are required.`,
    )
  }

  if (!state.programStartSem.trim()) {
    warnings.push(
      'Program start semester is blank — export uses “next semester” as the first column. Set program start in Step 1 for accurate Excel columns.',
    )
  }

  const placements = getAllPlacements(state, plan)
  const placementCredits = placements.reduce((sum, p) => sum + p.course.credits, 0)
  const placedIds = new Set(placements.map((p) => p.course.id))

  const scheduledIds = new Set<string>()
  for (const semPlan of Object.values(plan.plan)) {
    for (const course of semPlan.courses) {
      scheduledIds.add(course.id)
      if (!placedIds.has(course.id) && !course.excelRow) {
        errors.push(`${course.code} is on your plan but has no row on the Excel template.`)
      }
    }
  }

  for (const id of state.taken) {
    const course = resolveCourse(id, state.curriculum)
    if (!course) continue
    if (!placedIds.has(id) && course.excelRow) {
      errors.push(
        `${course.code} is marked completed but could not be placed on the proposal spreadsheet. Pick a “taken in” semester in Step 2.`,
      )
    }
  }

  const excelCols = excelSemesters(
    state.programStartSem,
    state.planFromSem,
    state.gradSem,
  ).length
  const overflow = placements.filter((p) => p.semIndex >= excelCols)
  if (overflow.length > 0) {
    errors.push(
      `${overflow.length} course(s) fall past the last Excel column — choose a later graduation date or fewer terms.`,
    )
  }

  const exportableTotal = takenCr + customCr + placementCredits
  if (errors.length === 0 && exportableTotal < MIN_DEGREE_CREDITS) {
    errors.push(
      `Only ${exportableTotal} credits would appear on the Excel file (need ${MIN_DEGREE_CREDITS}).`,
    )
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    placementCredits: exportableTotal,
  }
}
