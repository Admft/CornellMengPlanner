import type { Semester } from '../types'

const SEM_FIRST_YEAR = 2020
const SEM_LAST_YEAR = 2032

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

/** All semesters for program-start date (includes past years). */
export function programStartSemesters(): Semester[] {
  return SEMS.filter(
    (semester) => semester.year >= SEM_FIRST_YEAR && semester.year <= SEM_LAST_YEAR,
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
