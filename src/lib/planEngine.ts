import { EL, OB, PD1, PD2, REQ, RES2, getCourseById } from '../data/courses'
import { semRange } from '../data/semesters'
import type { Course, GeneratedPlan, PlannerState, SemesterPlan } from '../types'

export interface CoursePlacement {
  course: Course
  semCode: string
  semIndex: number
}

function buildQueue(state: PlannerState): Course[] {
  const done = new Set(state.taken)
  const queue: Course[] = []

  REQ.forEach((course) => {
    if (!done.has(course.id)) queue.push({ ...course })
  })

  if (state.resChoice === 'session2') {
    if (!done.has('EN6002')) queue.push({ ...RES2 })
  } else {
    if (!done.has('EN6011')) queue.push({ ...PD1 })
    if (!done.has('EN6012')) queue.push({ ...PD2 })
  }

  if (state.obChoice && !done.has(state.obChoice)) {
    const ob = OB.find((course) => course.id === state.obChoice)
    if (ob) queue.push({ ...ob })
  }

  state.elChoices.forEach((courseId) => {
    if (!done.has(courseId)) {
      const elective = EL.find((course) => course.id === courseId)
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
        (course.prereqs ?? []).every((prereq) => done.has(prereq)),
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
    .map((id) => getCourseById(id))
    .filter((course): course is Course => !!course)
    .sort((a, b) => a.pri - b.pri)

  for (const course of takenCourses) {
    const semIndex = sems.findIndex((sem) => {
      if (!course.seasons.includes(sem.season)) return false
      if (!(course.prereqs ?? []).every((prereq) => done.has(prereq) || state.taken.has(prereq))) {
        return false
      }
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
    const course = getCourseById(id)
    return sum + (course?.credits ?? 0)
  }, 0)

  const plannedCredits = Object.values(plan).reduce(
    (sum, semester) => sum + semester.cr,
    0,
  )

  return {
    takenCredits,
    plannedCredits,
    total: takenCredits + plannedCredits,
    unscheduled,
  }
}
