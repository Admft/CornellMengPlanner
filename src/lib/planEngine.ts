import {
  catalogToList,
  getCourseById,
  hasWorkshopsDone,
  isCourseCompleted,
  prereqsSatisfied,
} from '../data/courses'
import { LEGACY_COURSES } from '../data/legacyCourses'
import { semRange } from '../data/semesters'
import type { Course, CurriculumCatalog, GeneratedPlan, PlannerState, SemesterPlan } from '../types'
import { MIN_DEGREE_CREDITS } from './planLayout'

export interface CoursePlacement {
  course: Course
  semCode: string
  semIndex: number
}

const MIN_ELECTIVES = 2

function allKnownCourses(catalog: CurriculumCatalog): Course[] {
  return [...catalogToList(catalog), ...LEGACY_COURSES]
}

export function resolveCourse(id: string, catalog: CurriculumCatalog): Course | undefined {
  return getCourseById(id, catalog) ?? LEGACY_COURSES.find((c) => c.id === id)
}

function takenCredits(state: PlannerState): number {
  const fromTaken = [...state.taken].reduce((sum, id) => {
    const course = resolveCourse(id, state.curriculum)
    return sum + (course?.credits ?? 0)
  }, 0)
  const custom = state.customTaken.reduce((sum, c) => sum + c.credits, 0)
  return fromTaken + custom
}

function takenElectiveCount(state: PlannerState): number {
  return state.curriculum.el.filter((c) => state.taken.has(c.id)).length
}

function nonElectiveQueue(state: PlannerState): Course[] {
  const { curriculum } = state
  const done = new Set(state.taken)
  const queue: Course[] = []

  curriculum.req.forEach((course) => {
    if (!isCourseCompleted(course.id, done)) queue.push({ ...course })
  })

  if (state.resChoice === 'session2') {
    if (!isCourseCompleted(curriculum.res2.id, done)) queue.push({ ...curriculum.res2 })
  } else {
    if (!isCourseCompleted(curriculum.pd1.id, done)) queue.push({ ...curriculum.pd1 })
    if (!isCourseCompleted(curriculum.pd2.id, done)) queue.push({ ...curriculum.pd2 })
  }

  if (state.obChoice && !isCourseCompleted(state.obChoice, done)) {
    const ob = curriculum.ob.find((course) => course.id === state.obChoice)
    if (ob) queue.push({ ...ob })
  }

  return queue.sort((a, b) => a.pri - b.pri)
}

/** Pick fewest elective credits that still meets the 2-course rule and lands near 30 total. */
function optimizeElectives(state: PlannerState, candidates: Course[]): Course[] {
  const minCount = Math.max(0, MIN_ELECTIVES - takenElectiveCount(state))
  if (candidates.length === 0) return []
  if (candidates.length <= minCount) return candidates

  const fixed = nonElectiveQueue(state)
  const fixedCredits = fixed.reduce((sum, c) => sum + c.credits, 0)
  const already = takenCredits(state)
  const n = candidates.length

  let best: Course[] | null = null
  let bestTotal = Infinity

  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: Course[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(candidates[i])
    }
    if (subset.length < minCount) continue

    const total =
      already + fixedCredits + subset.reduce((sum, course) => sum + course.credits, 0)
    if (total < MIN_DEGREE_CREDITS) continue

    if (
      total < bestTotal ||
      (total === bestTotal && subset.length < (best?.length ?? Infinity))
    ) {
      bestTotal = total
      best = subset
    }
  }

  if (best) return best

  // Can't reach 30 — use minimum count, prefer lower-credit electives
  const sorted = [...candidates].sort((a, b) => a.credits - b.credits || a.pri - b.pri)
  return sorted.slice(0, minCount)
}

function buildQueue(state: PlannerState): Course[] {
  const done = new Set(state.taken)
  const queue = nonElectiveQueue(state)

  const electiveCandidates: Course[] = []
  state.elChoices.forEach((courseId) => {
    if (!isCourseCompleted(courseId, done)) {
      const elective = state.curriculum.el.find((course) => course.id === courseId)
      if (elective) electiveCandidates.push({ ...elective })
    }
  })

  const optimized = optimizeElectives(state, electiveCandidates)
  queue.push(...optimized)

  return queue.sort((a, b) => a.pri - b.pri)
}

export function getSkippedElectives(state: PlannerState): Course[] {
  const done = new Set(state.taken)
  const chosen: Course[] = []
  state.elChoices.forEach((courseId) => {
    if (!isCourseCompleted(courseId, done)) {
      const elective = state.curriculum.el.find((course) => course.id === courseId)
      if (elective) chosen.push(elective)
    }
  })
  const optimized = optimizeElectives(state, chosen)
  const optimizedIds = new Set(optimized.map((c) => c.id))
  return chosen.filter((c) => !optimizedIds.has(c.id))
}

export function generatePlan(state: PlannerState): GeneratedPlan {
  const sems = semRange(state.planFromSem, state.gradSem)
  const done = new Set(state.taken)
  let queue = buildQueue(state)

  const limits = {
    Fall: state.crLimit,
    Spring: state.crLimit,
    Summer: 2,
  }

  const plan: Record<string, SemesterPlan> = {}

  for (const sem of sems) {
    const limit = limits[sem.season] ?? 12
    plan[sem.code] = { sem, courses: [], cr: 0 }

    const available = queue.filter(
      (course) =>
        course.seasons.includes(sem.season) &&
        prereqsSatisfied(course.prereqs ?? [], done),
    )

    let used = 0
    const placed: Course[] = []
    for (const course of available) {
      if (used + course.credits <= limit) {
        placed.push(course)
        used += course.credits
      }
    }

    plan[sem.code].courses = placed
    plan[sem.code].cr = used

    const placedIds = new Set(placed.map((course) => course.id))
    queue = queue.filter((course) => !placedIds.has(course.id))
    placed.forEach((course) => done.add(course.id))
  }

  return { plan, unscheduled: queue, sems }
}

export function getAllPlacements(
  state: PlannerState,
  displayPlan?: GeneratedPlan,
): CoursePlacement[] {
  const { plan, sems } = displayPlan ?? generatePlan(state)
  const placements: CoursePlacement[] = []
  const done = new Set<string>()
  const semLoads = new Map<string, number>()
  const limits = {
    Fall: state.crLimit,
    Spring: state.crLimit,
    Summer: 2,
  }

  const takenCourses = [...state.taken]
    .map((id) => resolveCourse(id, state.curriculum))
    .filter((course): course is Course => !!course)
    .sort((a, b) => a.pri - b.pri)

  for (const course of takenCourses) {
    const semIndex = sems.findIndex((sem) => {
      if (!course.seasons.includes(sem.season)) return false
      if (!prereqsSatisfied(course.prereqs ?? [], done)) return false
      const load = semLoads.get(sem.code) ?? 0
      const limit = limits[sem.season] ?? 12
      return load + course.credits <= limit
    })

    if (semIndex >= 0) {
      const sem = sems[semIndex]
      placements.push({
        course,
        semCode: sem.code,
        semIndex,
      })
      semLoads.set(sem.code, (semLoads.get(sem.code) ?? 0) + course.credits)
      done.add(course.id)
    }
  }

  for (const sem of sems) {
    const semPlan = plan[sem.code]
    if (!semPlan) continue
    const semIndex = sems.findIndex((item) => item.code === sem.code)
    for (const course of semPlan.courses) {
      placements.push({ course, semCode: sem.code, semIndex })
      done.add(course.id)
    }
  }

  return placements
}

export function getCreditTotals(state: PlannerState, displayPlan?: GeneratedPlan) {
  const plan = displayPlan ?? generatePlan(state)
  const { unscheduled } = plan
  const takenCr = takenCredits(state)

  const plannedCredits = Object.values(plan.plan).reduce(
    (sum, semester) => sum + semester.cr,
    0,
  )

  return {
    takenCredits: takenCr,
    plannedCredits,
    total: takenCr + plannedCredits,
    unscheduled,
  }
}

export { hasWorkshopsDone, allKnownCourses }
export { MIN_DEGREE_CREDITS } from './planLayout'
