import {
  getCourseById,
  prereqsSatisfied,
  type CompletionContext,
} from '../data/courses'
import { LEGACY_COURSES } from '../data/legacyCourses'
import type { Course, GeneratedPlan, PlannerState, Semester, SemesterPlan } from '../types'

export const MIN_DEGREE_CREDITS = 30

function resolveCourse(id: string, catalog: PlannerState['curriculum']): Course | undefined {
  return getCourseById(id, catalog) ?? LEGACY_COURSES.find((c) => c.id === id)
}

export function planToLayout(plan: GeneratedPlan): Record<string, string[]> {
  const layout: Record<string, string[]> = {}
  for (const sem of plan.sems) {
    layout[sem.code] = plan.plan[sem.code]?.courses.map((c) => c.id) ?? []
  }
  return layout
}

export function layoutToPlan(
  layout: Record<string, string[]>,
  sems: Semester[],
  catalog: PlannerState['curriculum'],
): GeneratedPlan {
  const plan: Record<string, SemesterPlan> = {}
  const scheduledIds = new Set<string>()

  for (const sem of sems) {
    const ids = layout[sem.code] ?? []
    const courses = ids
      .map((id) => resolveCourse(id, catalog))
      .filter((c): c is Course => !!c)
    courses.forEach((c) => scheduledIds.add(c.id))
    plan[sem.code] = {
      sem,
      courses,
      cr: courses.reduce((sum, c) => sum + c.credits, 0),
    }
  }

  const allQueued = Object.values(layout).flat()
  const unscheduled: Course[] = []
  const seen = new Set<string>()
  for (const id of allQueued) {
    if (seen.has(id) || scheduledIds.has(id)) continue
    seen.add(id)
    const course = resolveCourse(id, catalog)
    if (course) unscheduled.push(course)
  }

  return { plan, unscheduled, sems }
}

function semLimit(season: Semester['season'], crLimit: number): number {
  return season === 'Summer' ? 2 : crLimit
}

function coursesBeforeInLayout(
  sems: Semester[],
  layout: Record<string, string[]>,
  semIndex: number,
): Set<string> {
  const ids = new Set<string>()
  for (let i = 0; i < semIndex; i++) {
    for (const id of layout[sems[i].code] ?? []) {
      ids.add(id)
    }
  }
  return ids
}

function semesterCredits(
  semCode: string,
  layout: Record<string, string[]>,
  catalog: PlannerState['curriculum'],
): number {
  return (layout[semCode] ?? []).reduce((sum, id) => {
    const course = resolveCourse(id, catalog)
    return sum + (course?.credits ?? 0)
  }, 0)
}

function canPlaceInLayout(
  course: Course,
  targetSem: Semester,
  layout: Record<string, string[]>,
  sems: Semester[],
  state: PlannerState,
): { ok: true } | { ok: false; reason: string } {
  const targetIdx = sems.findIndex((s) => s.code === targetSem.code)
  if (targetIdx < 0) return { ok: false, reason: 'Invalid semester.' }

  if (!course.seasons.includes(targetSem.season)) {
    return {
      ok: false,
      reason: `${course.code} is only offered in ${course.seasons.join(', ')}.`,
    }
  }

  const before = coursesBeforeInLayout(sems, layout, targetIdx)
  const done = new Set([...state.taken, ...before])
  const ctx: CompletionContext = { returningStudent: state.returningStudent }
  if (!prereqsSatisfied(course.prereqs ?? [], done, ctx)) {
    return { ok: false, reason: `Prerequisites for ${course.code} must be completed first.` }
  }

  const limit = semLimit(targetSem.season, state.crLimit)
  const load = semesterCredits(targetSem.code, layout, state.curriculum)
  const alreadyInSem = (layout[targetSem.code] ?? []).includes(course.id)
  const projectedLoad = alreadyInSem ? load : load + course.credits
  if (projectedLoad > limit + 0.001) {
    return {
      ok: false,
      reason: `${targetSem.label} is capped at ${limit} credits.`,
    }
  }

  return { ok: true }
}

export function canPlaceCourse(
  course: Course,
  targetSem: Semester,
  sems: Semester[],
  plan: Record<string, SemesterPlan>,
  state: PlannerState,
  options?: { excludeCourseId?: string; fromSemCode?: string },
): { ok: true } | { ok: false; reason: string } {
  const layout = planToLayout({ plan, unscheduled: [], sems })
  const fromSem = options?.fromSemCode
  const movingId = options?.excludeCourseId ?? course.id

  if (fromSem) {
    layout[fromSem] = (layout[fromSem] ?? []).filter((id) => id !== movingId)
  }
  if (!layout[targetSem.code]?.includes(course.id)) {
    layout[targetSem.code] = [...(layout[targetSem.code] ?? []), course.id]
  }

  return canPlaceInLayout(course, targetSem, layout, sems, state)
}

export function canSwapCourses(
  courseA: Course,
  semCodeA: string,
  courseB: Course,
  semCodeB: string,
  sems: Semester[],
  layout: Record<string, string[]>,
  state: PlannerState,
): { ok: true } | { ok: false; reason: string } {
  if (semCodeA === semCodeB) {
    return { ok: false, reason: 'Pick a course in a different semester to swap.' }
  }

  const semA = sems.find((s) => s.code === semCodeA)
  const semB = sems.find((s) => s.code === semCodeB)
  if (!semA || !semB) return { ok: false, reason: 'Invalid semester.' }

  const next: Record<string, string[]> = {}
  for (const [code, ids] of Object.entries(layout)) {
    next[code] = [...ids]
  }
  next[semCodeA] = (next[semCodeA] ?? []).map((id) => (id === courseA.id ? courseB.id : id))
  next[semCodeB] = (next[semCodeB] ?? []).map((id) => (id === courseB.id ? courseA.id : id))

  const checkA = canPlaceInLayout(courseA, semB, next, sems, state)
  if (!checkA.ok) return checkA

  const checkB = canPlaceInLayout(courseB, semA, next, sems, state)
  if (!checkB.ok) return checkB

  return { ok: true }
}

export function swapCoursesInLayout(
  layout: Record<string, string[]>,
  courseIdA: string,
  semCodeA: string,
  courseIdB: string,
  semCodeB: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const [code, ids] of Object.entries(layout)) {
    next[code] = [...ids]
  }
  next[semCodeA] = (next[semCodeA] ?? []).map((id) => (id === courseIdA ? courseIdB : id))
  next[semCodeB] = (next[semCodeB] ?? []).map((id) => (id === courseIdB ? courseIdA : id))
  return next
}

export function moveCourseInLayout(
  layout: Record<string, string[]>,
  courseId: string,
  fromSemCode: string,
  toSemCode: string,
  toIndex?: number,
): Record<string, string[]> {
  if (fromSemCode === toSemCode) return layout
  const next: Record<string, string[]> = {}
  for (const [code, ids] of Object.entries(layout)) {
    next[code] = [...ids]
  }
  next[fromSemCode] = (next[fromSemCode] ?? []).filter((id) => id !== courseId)
  const target = [...(next[toSemCode] ?? [])]
  if (toIndex !== undefined && toIndex >= 0 && toIndex <= target.length) {
    target.splice(toIndex, 0, courseId)
  } else {
    target.push(courseId)
  }
  next[toSemCode] = target
  return next
}

export function findSwapPartners(
  course: Course,
  fromSemCode: string,
  sems: Semester[],
  layout: Record<string, string[]>,
  state: PlannerState,
): { course: Course; semCode: string }[] {
  const partners: { course: Course; semCode: string }[] = []

  for (const sem of sems) {
    if (sem.code === fromSemCode) continue
    for (const id of layout[sem.code] ?? []) {
      const other = resolveCourse(id, state.curriculum)
      if (!other || other.id === course.id) continue
      const check = canSwapCourses(course, fromSemCode, other, sem.code, sems, layout, state)
      if (check.ok) partners.push({ course: other, semCode: sem.code })
    }
  }

  return partners
}

export function swapPartnersInSemester(
  course: Course,
  fromSemCode: string,
  targetSemCode: string,
  sems: Semester[],
  layout: Record<string, string[]>,
  state: PlannerState,
): Course[] {
  return findSwapPartners(course, fromSemCode, sems, layout, state)
    .filter((partner) => partner.semCode === targetSemCode)
    .map((partner) => partner.course)
}

export function validMoveSemesters(
  course: Course,
  fromSemCode: string,
  sems: Semester[],
  plan: GeneratedPlan,
  state: PlannerState,
): Set<string> {
  const valid = new Set<string>()

  for (const sem of sems) {
    if (sem.code === fromSemCode) {
      valid.add(sem.code)
      continue
    }

    const moveCheck = canPlaceCourse(course, sem, sems, plan.plan, state, {
      excludeCourseId: course.id,
      fromSemCode,
    })
    if (moveCheck.ok) valid.add(sem.code)
  }

  return valid
}

export function validDropSemesters(
  course: Course,
  fromSemCode: string,
  sems: Semester[],
  plan: GeneratedPlan,
  state: PlannerState,
  layout?: Record<string, string[]>,
): Set<string> {
  const activeLayout = layout ?? planToLayout(plan)
  const valid = new Set<string>()

  for (const sem of sems) {
    if (sem.code === fromSemCode) {
      valid.add(sem.code)
      continue
    }

    const moveCheck = canPlaceCourse(course, sem, sems, plan.plan, state, {
      excludeCourseId: course.id,
      fromSemCode,
    })
    if (moveCheck.ok) {
      valid.add(sem.code)
      continue
    }

    const partners = findSwapPartners(course, fromSemCode, sems, activeLayout, state)
    if (partners.some((p) => p.semCode === sem.code)) {
      valid.add(sem.code)
    }
  }

  return valid
}

export function validSwapTargets(
  course: Course,
  fromSemCode: string,
  sems: Semester[],
  layout: Record<string, string[]>,
  state: PlannerState,
): Set<string> {
  const valid = new Set<string>()
  for (const { course: other, semCode } of findSwapPartners(
    course,
    fromSemCode,
    sems,
    layout,
    state,
  )) {
    valid.add(`${semCode}:${other.id}`)
  }
  return valid
}
