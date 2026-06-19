import {
  getCourseById,
  prereqsSatisfied,
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

function coursesBefore(
  sems: Semester[],
  plan: Record<string, SemesterPlan>,
  semIndex: number,
): Set<string> {
  const ids = new Set<string>()
  for (let i = 0; i < semIndex; i++) {
    for (const course of plan[sems[i].code]?.courses ?? []) {
      ids.add(course.id)
    }
  }
  return ids
}

export function canPlaceCourse(
  course: Course,
  targetSem: Semester,
  sems: Semester[],
  plan: Record<string, SemesterPlan>,
  state: PlannerState,
  options?: { excludeCourseId?: string; fromSemCode?: string },
): { ok: true } | { ok: false; reason: string } {
  const targetIdx = sems.findIndex((s) => s.code === targetSem.code)
  if (targetIdx < 0) return { ok: false, reason: 'Invalid semester.' }

  if (!course.seasons.includes(targetSem.season)) {
    return {
      ok: false,
      reason: `${course.code} is only offered in ${course.seasons.join(', ')}.`,
    }
  }

  const before = coursesBefore(sems, plan, targetIdx)
  const done = new Set([...state.taken, ...before])
  if (!prereqsSatisfied(course.prereqs ?? [], done)) {
    return { ok: false, reason: `Prerequisites for ${course.code} must be completed first.` }
  }

  const limit = semLimit(targetSem.season, state.crLimit)
  let load = plan[targetSem.code]?.cr ?? 0
  if (options?.fromSemCode === targetSem.code && options?.excludeCourseId === course.id) {
    load -= course.credits
  } else if (options?.fromSemCode && options.fromSemCode !== targetSem.code) {
    // moving from another sem — target load unchanged for this course yet
  }
  if (load + course.credits > limit) {
    return {
      ok: false,
      reason: `${targetSem.label} is capped at ${limit} credits.`,
    }
  }

  return { ok: true }
}

export function moveCourseInLayout(
  layout: Record<string, string[]>,
  courseId: string,
  fromSemCode: string,
  toSemCode: string,
): Record<string, string[]> {
  if (fromSemCode === toSemCode) return layout
  const next: Record<string, string[]> = {}
  for (const [code, ids] of Object.entries(layout)) {
    next[code] = [...ids]
  }
  next[fromSemCode] = (next[fromSemCode] ?? []).filter((id) => id !== courseId)
  next[toSemCode] = [...(next[toSemCode] ?? []), courseId]
  return next
}

export function validDropSemesters(
  course: Course,
  fromSemCode: string,
  sems: Semester[],
  plan: GeneratedPlan,
  state: PlannerState,
): Set<string> {
  const valid = new Set<string>()
  for (const sem of sems) {
    const check = canPlaceCourse(course, sem, sems, plan.plan, state, {
      excludeCourseId: course.id,
      fromSemCode,
    })
    if (check.ok) valid.add(sem.code)
  }
  return valid
}
