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

export interface CoursePlacement {
  course: Course
  semCode: string
  semIndex: number
}

function allKnownCourses(catalog: CurriculumCatalog): Course[] {
  return [...catalogToList(catalog), ...LEGACY_COURSES]
}

function resolveCourse(id: string, catalog: CurriculumCatalog): Course | undefined {
  return getCourseById(id, catalog) ?? LEGACY_COURSES.find((c) => c.id === id)
}

function buildQueue(state: PlannerState): Course[] {
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

  state.elChoices.forEach((courseId) => {
    if (!isCourseCompleted(courseId, done)) {
      const elective = curriculum.el.find((course) => course.id === courseId)
      if (elective) queue.push({ ...elective })
    }
  })

  return queue.sort((a, b) => a.pri - b.pri)
}

export function generatePlan(state: PlannerState): GeneratedPlan {
  const sems = semRange(state.startSem, state.gradSem)
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

export function getAllPlacements(state: PlannerState): CoursePlacement[] {
  const { plan, sems } = generatePlan(state)
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

export function getCreditTotals(state: PlannerState) {
  const { plan, unscheduled } = generatePlan(state)
  const takenCredits = [...state.taken].reduce((sum, id) => {
    const course = resolveCourse(id, state.curriculum)
    return sum + (course?.credits ?? 0)
  }, 0)

  const customCredits = state.customTaken.reduce((sum, c) => sum + c.credits, 0)

  const plannedCredits = Object.values(plan).reduce(
    (sum, semester) => sum + semester.cr,
    0,
  )

  return {
    takenCredits: takenCredits + customCredits,
    plannedCredits,
    total: takenCredits + customCredits + plannedCredits,
    unscheduled,
  }
}

export { hasWorkshopsDone, allKnownCourses, resolveCourse }
