import { catalogToList, economicsRequirementMet } from '../data/courses'
import { LEGACY_COURSES } from '../data/legacyCourses'
import { autoPlaceSemesters, excelSemesters } from '../data/semesters'
import { generatePlan } from './planEngine'
import type { Course, CourseCategory, CustomTakenCourse, GeneratedPlan, PlannerState } from '../types'
import { SEM_COLS } from '../types'

export interface CustomExcelPlacement {
  custom: CustomTakenCourse
  row: number
  semIndex: number
}

function categoryRowCandidates(cat: CourseCategory): number[] {
  if (cat === 'cap') return [15]
  if (cat === 'org') return [29, 30, 31, 32]
  if (cat === 'el') return [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47]
  if (cat === 'res') return [21, 22, 23, 24]
  return [13, 14, 16, 17, 18, 19, 20]
}

function plannedCourseIds(displayPlan: GeneratedPlan): Set<string> {
  const ids = new Set<string>()
  for (const semPlan of Object.values(displayPlan.plan)) {
    for (const course of semPlan.courses) {
      ids.add(course.id)
    }
  }
  return ids
}

/** Template row for a course the student does not need to fill on the proposal. */
function isSkippableTemplateCourse(
  course: Course,
  state: PlannerState,
  plannedIds: Set<string>,
): boolean {
  const { taken } = state

  if (taken.has(course.id)) return false
  if (plannedIds.has(course.id)) return false

  if (course.id === 'EN5405' && state.returningStudent) return true
  if ((course.id === 'EN5941' || course.id === 'EN5942') && economicsRequirementMet(taken)) {
    return true
  }
  if (course.id === 'EN5930' && taken.has('EN5930_legacy')) return true

  if (course.cat === 'org') {
    const tookOb = state.curriculum.ob.some((c) => taken.has(c.id))
    if (tookOb || state.obChoice) {
      if (state.obChoice && course.id !== state.obChoice && !taken.has(course.id)) return true
      if (tookOb && !taken.has(course.id)) return true
    }
  }

  if (course.id === 'EN6002' && state.resChoice === 'workshops') return true
  if ((course.id === 'EN6010' || course.id === 'EN6011') && state.resChoice === 'session2') {
    return true
  }

  return false
}

/** Rows for waived/unneeded template courses — used when the section is full. */
function skippableBorrowRows(
  state: PlannerState,
  plannedIds: Set<string>,
  claimedRows: Set<number>,
  cat: CourseCategory,
): number[] {
  const inCategory = new Set(categoryRowCandidates(cat))
  const allCourses = [...catalogToList(state.curriculum), ...LEGACY_COURSES]
  const byId = new Map(allCourses.map((c) => [c.id, c]))

  const priorityIds = [
    'EN5405',
    'EN5941',
    'EN5942',
    'EN6010',
    'EN6011',
    'EN6002',
    ...state.curriculum.ob.map((c) => c.id),
  ]

  const rows: number[] = []
  const seen = new Set<number>()

  for (const id of priorityIds) {
    const course = byId.get(id)
    if (!course?.excelRow) continue
    if (claimedRows.has(course.excelRow)) continue
    if (inCategory.has(course.excelRow)) continue
    if (!isSkippableTemplateCourse(course, state, plannedIds)) continue
    if (seen.has(course.excelRow)) continue
    rows.push(course.excelRow)
    seen.add(course.excelRow)
  }

  return rows
}

function pickCustomRow(
  cat: CourseCategory,
  claimedRows: Set<number>,
  state: PlannerState,
  plannedIds: Set<string>,
): number | undefined {
  for (const row of categoryRowCandidates(cat)) {
    if (!claimedRows.has(row)) return row
  }

  for (const row of skippableBorrowRows(state, plannedIds, claimedRows, cat)) {
    return row
  }

  return undefined
}

function resolveCustomSemIndex(
  custom: CustomTakenCourse,
  state: PlannerState,
  semLoads: Map<string, number>,
): number {
  const excelSems = excelSemesters(
    state.programStartSem,
    state.planFromSem,
    state.gradSem,
    SEM_COLS.length,
  )

  if (custom.semCode) {
    return excelSems.findIndex((sem) => sem.code === custom.semCode)
  }

  const autoSems = autoPlaceSemesters(state.programStartSem, state.planFromSem)
  const limits = {
    Fall: state.crLimit,
    Spring: state.crLimit,
    Summer: 2,
  }

  const matched = autoSems.find((sem) => {
    const load = semLoads.get(sem.code) ?? 0
    const limit = limits[sem.season] ?? 12
    return load + custom.credits <= limit
  })

  if (!matched) return -1
  return excelSems.findIndex((sem) => sem.code === matched.code)
}

export function getCustomExcelPlacements(
  state: PlannerState,
  usedRows: Set<number>,
  displayPlan?: GeneratedPlan,
): CustomExcelPlacement[] {
  const plan = displayPlan ?? generatePlan(state)
  const plannedIds = plannedCourseIds(plan)
  const placements: CustomExcelPlacement[] = []
  const semLoads = new Map<string, number>()
  const excelSems = excelSemesters(
    state.programStartSem,
    state.planFromSem,
    state.gradSem,
    SEM_COLS.length,
  )
  const claimedRows = new Set(usedRows)

  for (const custom of state.customTaken) {
    const semIndex = resolveCustomSemIndex(custom, state, semLoads)
    if (semIndex < 0 || semIndex >= SEM_COLS.length) continue

    const row = pickCustomRow(custom.cat, claimedRows, state, plannedIds)
    if (row == null) continue

    const sem = excelSems[semIndex]
    placements.push({ custom, row, semIndex })
    claimedRows.add(row)
    semLoads.set(sem.code, (semLoads.get(sem.code) ?? 0) + custom.credits)
  }

  return placements
}
