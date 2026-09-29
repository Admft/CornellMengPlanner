import {
  catalogToList,
  courseKey,
  isOfferedIn,
  getCourseById,
  hasWorkshopsDone,
  isCourseCompleted,
  prereqsSatisfied,
} from '../data/courses'
import { LEGACY_COURSES } from '../data/legacyCourses'
import { excelSemesters, semIdx, semRange, autoPlaceSemesters } from '../data/semesters'
import type { Course, CurriculumCatalog, GeneratedPlan, PlannerState, SemesterPlan } from '../types'
import { SEM_COLS } from '../types'
import { MIN_DEGREE_CREDITS } from './planLayout'

export interface CoursePlacement {
  course: Course
  semCode: string
  semIndex: number
}

const MIN_ELECTIVES = 2

/** Future planning always begins at “next semester” — completed terms belong in Step 2. */
function planningStartSemester(state: PlannerState): string {
  return state.planFromSem
}

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
  return state.curriculum.el.filter((c) => state.taken.has(c.id)).length + state.customTaken.filter(c => c.cat === 'el').length
}

function completionCtx(state: PlannerState) {
  return { returningStudent: state.returningStudent }
}

function nonElectiveQueue(state: PlannerState): Course[] {
  const { curriculum } = state
  const done = new Set(state.taken)
  const ctx = completionCtx(state)
  const queue: Course[] = []

  curriculum.req.forEach((course) => {
    if (!isCourseCompleted(course.id, done, ctx)) queue.push({ ...course })
  })

  if (hasWorkshopsDone(done) || done.has(curriculum.res2.id)) {
    // Either completed pathway satisfies the requirement.
  } else if (state.resChoice === 'session2') {
    if (!isCourseCompleted(curriculum.res2.id, done, ctx)) queue.push({ ...curriculum.res2 })
  } else {
    if (!isCourseCompleted(curriculum.pd1.id, done, ctx)) queue.push({ ...curriculum.pd1 })
    if (!isCourseCompleted(curriculum.pd2.id, done, ctx)) queue.push({ ...curriculum.pd2 })
  }

  if (!curriculum.ob.some(c => done.has(c.id)) && state.obChoice && !isCourseCompleted(state.obChoice, done, ctx)) {
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
  const choices: { courses: Course[]; total: number }[] = []

  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: Course[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(candidates[i])
    }
    if (subset.length < minCount) continue

    const total =
      already + fixedCredits + subset.reduce((sum, course) => sum + course.credits, 0)
    if (total < MIN_DEGREE_CREDITS) continue
    choices.push({ courses: subset, total })

    if (
      total < bestTotal ||
      (total === bestTotal && subset.length < (best?.length ?? Infinity))
    ) {
      bestTotal = total
      best = subset
    }
  }

  if (best) {
    // Credit-efficient choices are useful only if they can actually be scheduled.
    // Consider only electives the student selected, in credit/count preference order.
    choices.sort((a, b) => a.total - b.total || a.courses.length - b.courses.length)
    const effort = { remaining: 50000 }
    for (const choice of choices.slice(0, 256)) {
      if (!scheduleQueue(state, [...fixed, ...choice.courses], effort).unscheduled.length) return choice.courses
      if (effort.remaining <= 0) break
    }
    return best
  }

  // Can't reach 30 with minimum electives — add more (prefer smaller-credit makeup courses)
  const sorted = [...candidates].sort((a, b) => a.credits - b.credits || a.pri - b.pri)
  const picked = sorted.slice(0, minCount)
  let total =
    already + fixedCredits + picked.reduce((sum, course) => sum + course.credits, 0)
  for (let i = minCount; i < sorted.length && total < MIN_DEGREE_CREDITS; i++) {
    picked.push(sorted[i])
    total += sorted[i].credits
  }
  return picked
}

function buildQueue(state: PlannerState): Course[] {
  const done = new Set(state.taken)
  const ctx = completionCtx(state)
  const queue = nonElectiveQueue(state)

  const electiveCandidates: Course[] = []
  state.elChoices.forEach((courseId) => {
    if (!isCourseCompleted(courseId, done, ctx)) {
      const elective = state.curriculum.el.find((course) => course.id === courseId)
      if (elective && !queue.some(c => courseKey(c) === courseKey(elective)) &&
          ![...done].some(id => { const c = resolveCourse(id, state.curriculum); return c && courseKey(c) === courseKey(elective) })) electiveCandidates.push({ ...elective })
    }
  })

  const optimized = optimizeElectives(state, electiveCandidates)
  queue.push(...optimized)

  return queue.sort((a, b) => a.pri - b.pri)
}

export function getSkippedElectives(state: PlannerState): Course[] {
  const done = new Set(state.taken)
  const ctx = completionCtx(state)
  const chosen: Course[] = []
  state.elChoices.forEach((courseId) => {
    if (!isCourseCompleted(courseId, done, ctx)) {
      const elective = state.curriculum.el.find((course) => course.id === courseId)
      if (elective) chosen.push(elective)
    }
  })
  const optimized = optimizeElectives(state, chosen)
  const optimizedIds = new Set(optimized.map((c) => c.id))
  return chosen.filter((c) => !optimizedIds.has(c.id))
}

function greedyPlan(state: PlannerState, selected: Course[]): GeneratedPlan {
  const planStartSem = planningStartSemester(state)
  const sems = semRange(planStartSem, state.gradSem)
  const done = new Set(state.taken)
  const ctx = completionCtx(state)
  let queue = [...selected]

  const limits = {
    Fall: state.crLimit,
    Spring: state.crLimit,
    Summer: 2,
  }

  const plan: Record<string, SemesterPlan> = {}

  for (const sem of sems) {
    const limit = limits[sem.season] ?? 12
    plan[sem.code] = { sem, courses: [], cr: 0 }

    const available = queue
      .filter(
        (course) =>
          isOfferedIn(course, sem) &&
          prereqsSatisfied(course.prereqs ?? [], done, ctx),
      )
      .sort((a, b) => a.pri - b.pri || a.credits - b.credits)

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

/** Search whole schedules, propagating seasons, capacity and prerequisite deadlines.
 * A bounded search keeps imported catalogs responsive; exhaustion is never proof
 * that a degree is impossible. Existing valid schedules remain the fallback.
 */
export function generatePlan(state: PlannerState): GeneratedPlan {
  return scheduleQueue(state, buildQueue(state))
}

function scheduleQueue(state: PlannerState, courses: Course[], effort = { remaining: 50000 }): GeneratedPlan {
  const fallback = greedyPlan(state, courses)
  if (!courses.length || !fallback.sems.length) return fallback
  const ctx = completionCtx(state)
  const fullCredits = courses.reduce((sum, c) => sum + c.credits, 0)
  for (let horizon = 1; horizon <= fallback.sems.length; horizon++) {
    const sems = fallback.sems.slice(0, horizon)
    const capacity = sems.map(s => s.season === 'Summer' ? 2 : state.crLimit)
    if (capacity.reduce((a, b) => a + b, 0) < fullCredits) continue
    const initial = courses.map(c => sems.flatMap((s, i) => isOfferedIn(c, s) ? [i] : []))
    const search = (domains: number[][]): number[] | null => {
      if (--effort.remaining < 0) return null
      domains = domains.map(d => [...d])
      let changed = true
      while (changed) {
        changed = false
        const loads = capacity.map(() => 0)
        domains.forEach((d, i) => { if (d.length === 1) loads[d[0]] += courses[i].credits })
        if (loads.some((load, i) => load > capacity[i] + 0.001)) return null
        for (let i = 0; i < courses.length; i++) {
          const previous = domains[i]
          domains[i] = previous.filter(term => {
            if (previous.length > 1 && loads[term] + courses[i].credits > capacity[term] + 0.001) return false
            // Optimistic completion set: each prerequisite must have an earlier
            // possible term. Repeated propagation pushes dependent deadlines back.
            const before = new Set(state.taken)
            domains.forEach((d, j) => { if (j !== i && d.some(t => t < term)) before.add(courses[j].id) })
            if (!prereqsSatisfied(courses[i].prereqs, before, ctx)) return false
            // If this course is fixed here, every dependent still needs a valid
            // later placement (including equivalent legacy requirement IDs).
            return courses.every((dependent, j) => {
              if (j === i || !dependent.prereqs.some(p => !isCourseCompleted(p, state.taken, ctx) && isCourseCompleted(p, new Set([courses[i].id]), ctx))) return true
              return domains[j].some(t => t > term)
            })
          })
          if (!domains[i].length) return null
          if (domains[i].length !== previous.length) changed = true
        }
      }
      const undecided = courses.map((_, i) => i).filter(i => domains[i].length > 1)
      if (!undecided.length) return domains.map(d => d[0])
      undecided.sort((a, b) => domains[a].length - domains[b].length || courses[b].prereqs.length - courses[a].prereqs.length || courses[b].credits - courses[a].credits || courses[a].pri - courses[b].pri)
      const next = undecided[0]
      for (const term of courses[next].cat === 'cap' ? [...domains[next]].reverse() : domains[next]) {
        const branch = domains.map(d => [...d])
        branch[next] = [term]
        const result = search(branch)
        if (result) return result
        if (effort.remaining < 0) break
      }
      return null
    }
    const assignment = search(initial)
    if (assignment) {
      const plan = Object.fromEntries(fallback.sems.map(sem => [sem.code, { sem, courses: [] as Course[], cr: 0 }]))
      courses.forEach((course, i) => {
        const term = plan[sems[assignment[i]].code]
        term.courses.push(course)
        term.cr += course.credits
      })
      return { plan, sems: fallback.sems, unscheduled: [] }
    }
    if (effort.remaining < 0) break
  }
  return fallback
}

/** Explain the current obstruction without claiming a heuristic proves impossibility. */
export function unscheduledReason(course: Course, state: PlannerState, plan: GeneratedPlan): string {
  const offered = plan.sems.filter(s => isOfferedIn(course, s))
  if (!offered.length) return `No ${course.seasons.join(' or ')} offering in this planning window${course.availableFrom ? ` (available from ${course.availableFrom})` : ''}.`
  const last = offered[offered.length - 1]
  const before = new Set(state.taken)
  for (const sem of plan.sems) {
    if (sem.code === last.code) break
    plan.plan[sem.code]?.courses.forEach(c => before.add(c.id))
  }
  const missing = course.prereqs.filter(p => !isCourseCompleted(p, before, completionCtx(state)))
  if (missing.length) return `Must finish ${missing.map(id => resolveCourse(id, state.curriculum)?.code ?? id).join(', ')} before ${last.label}. These prerequisites are not completed earlier in this arrangement; concurrent enrollment is not assumed.`
  return `No complete arrangement found within the current semester limits. Try a later graduation date or a higher credit limit; summer remains capped at 2 credits.`
}

export function getAllPlacements(
  state: PlannerState,
  displayPlan?: GeneratedPlan,
): CoursePlacement[] {
  const { plan } = displayPlan ?? generatePlan(state)
  const excelSems = excelSemesters(
    state.programStartSem,
    state.planFromSem,
    state.gradSem,
    SEM_COLS.length,
  )
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
    const explicitSem = state.takenSemesters[course.id]
    let semIndex = -1

    if (explicitSem) {
      semIndex = excelSems.findIndex((sem) => sem.code === explicitSem)
    } else {
      const planFromIdx = semIdx(state.planFromSem)
      const pastSems = autoPlaceSemesters(state.programStartSem, state.planFromSem)
      const autoSems =
        pastSems.length > 0
          ? pastSems
          : excelSems.filter((sem) => {
              const idx = semIdx(sem.code)
              return planFromIdx >= 0 && idx >= 0 && idx < planFromIdx
            })

      const matchedSem = autoSems.find((sem) => {
        if (!isOfferedIn(course, sem)) return false
        if (!prereqsSatisfied(course.prereqs ?? [], done, completionCtx(state))) return false
        const load = semLoads.get(sem.code) ?? 0
        const limit = limits[sem.season] ?? 12
        return load + course.credits <= limit
      })

      if (matchedSem) {
        semIndex = excelSems.findIndex((sem) => sem.code === matchedSem.code)
      }
    }

    if (semIndex >= 0) {
      const sem = excelSems[semIndex]
      placements.push({
        course,
        semCode: sem.code,
        semIndex,
      })
      semLoads.set(sem.code, (semLoads.get(sem.code) ?? 0) + course.credits)
      done.add(course.id)
    }
  }

  for (const semPlan of Object.values(plan)) {
    const sem = semPlan.sem
    if (!semPlan) continue
    const semIndex = excelSems.findIndex((item) => item.code === sem.code)
    for (const course of semPlan.courses) {
      if (done.has(course.id)) continue
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
