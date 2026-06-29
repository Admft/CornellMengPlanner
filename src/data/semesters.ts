import type { Semester } from '../types'

const SEM_FIRST_YEAR = 2020
/** Built through this year so the app stays usable without frequent updates. */
const SEM_LAST_YEAR = Math.max(2032, new Date().getFullYear() + 5)
/** Earliest semester in the program-start dropdown (Excel export). */
const PROGRAM_START_FIRST_CODE = 'SP24'
/** How many calendar years of terms to offer in the "taken in" picker. */
const TAKEN_SEM_YEARS = 3

export const SEMS: Semester[] = (() => {
  const result: Semester[] = []
  for (let year = SEM_FIRST_YEAR; year <= SEM_LAST_YEAR; year++) {
    result.push({
      code: `SP${String(year).slice(2)}`,
      season: 'Spring',
      label: `Spring ${year}`,
      year,
    })
    result.push({
      code: `SU${String(year).slice(2)}`,
      season: 'Summer',
      label: `Summer ${year}`,
      year,
    })
    result.push({
      code: `FA${String(year).slice(2)}`,
      season: 'Fall',
      label: `Fall ${year}`,
      year,
    })
  }
  return result
})()

export function semIdx(code: string): number {
  return SEMS.findIndex((semester) => semester.code === code)
}

export function semRange(start: string, end: string): Semester[] {
  const startIndex = semIdx(start)
  const endIndex = semIdx(end)
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return []
  return SEMS.slice(startIndex, endIndex + 1)
}

export function relevantSemesters(): Semester[] {
  return SEMS.filter(
    (semester) => semester.year >= SEM_FIRST_YEAR && semester.year <= SEM_LAST_YEAR,
  )
}

/** Semesters for program-start date (Excel export) — Spring 2024 onward. */
export function programStartSemesters(): Semester[] {
  const startIdx = semIdx(PROGRAM_START_FIRST_CODE)
  if (startIdx < 0) return relevantSemesters()
  return SEMS.filter(
    (semester) =>
      semester.year <= SEM_LAST_YEAR &&
      semIdx(semester.code) >= startIdx,
  )
}

/** Best guess at the upcoming semester for default selection. */
export function defaultNextSemesterCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const yy = String(year).slice(2)
  const nextYy = String(year + 1).slice(2)
  if (month <= 5) return `SU${yy}`
  if (month <= 7) return `FA${yy}`
  return `SP${nextYy}`
}

/** Semesters available for "next semester" — current term and onward. */
export function planningSemesters(): Semester[] {
  const anchor = defaultNextSemesterCode()
  const anchorIdx = semIdx(anchor)
  const startIdx = anchorIdx >= 0 ? Math.max(0, anchorIdx - 1) : 0
  return SEMS.filter(
    (semester) =>
      semester.year >= SEM_FIRST_YEAR &&
      semester.year <= SEM_LAST_YEAR &&
      semIdx(semester.code) >= startIdx,
  )
}

/** Semesters offered in the optional "taken in" picker (Step 2 / Excel export). */
export function takenSemesterOptions(programStart: string): Semester[] {
  const start = programStart.trim() || PROGRAM_START_FIRST_CODE
  const startIdx = semIdx(start)
  if (startIdx < 0) return []
  const endYear = Math.min(SEMS[startIdx].year + TAKEN_SEM_YEARS, SEM_LAST_YEAR)
  return SEMS.filter(
    (semester) =>
      semIdx(semester.code) >= startIdx && semester.year <= endYear,
  )
}

/** Semesters used when auto-placing completed courses on export (through next semester). */
export function autoPlaceSemesters(programStart: string, planFrom: string): Semester[] {
  const start = programStart.trim() || PROGRAM_START_FIRST_CODE
  const startIdx = semIdx(start)
  const planIdx = semIdx(planFrom)
  if (startIdx < 0 || planIdx < 0) return []
  return SEMS.slice(startIdx, planIdx + 1)
}

/** Cornell template row 12 labels: E=SU1, F=FA1, G=SP1, H=SU2, … */
const TEMPLATE_SEASON_ORDER: Semester['season'][] = ['Summer', 'Fall', 'Spring']

export function excelSemesters(
  programStart: string,
  planFrom: string,
  grad: string,
  maxCols = 12,
): Semester[] {
  const start = programStart.trim() || planFrom
  const startIdx = semIdx(start)
  const gradIdx = semIdx(grad)
  if (startIdx < 0 || gradIdx < 0) return []

  const startSeasonIdx = TEMPLATE_SEASON_ORDER.indexOf(SEMS[startIdx].season)
  if (startSeasonIdx < 0) return []

  const result: Semester[] = []
  for (let t = 0; t < maxCols; t++) {
    const calIdx = startIdx + (t - startSeasonIdx)
    if (calIdx < 0 || calIdx >= SEMS.length) break
    const sem = SEMS[calIdx]
    if (semIdx(sem.code) > gradIdx) break
    result.push(sem)
  }
  return result
}

export function graduationSemesters(planFromCode: string): Semester[] {
  const fromIdx = semIdx(planFromCode)
  if (fromIdx < 0) return planningSemesters()
  return SEMS.filter(
    (semester) =>
      semester.year >= SEM_FIRST_YEAR &&
      semester.year <= SEM_LAST_YEAR &&
      semIdx(semester.code) >= fromIdx,
  )
}
