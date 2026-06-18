import type { Semester } from '../types'

export const SEMS: Semester[] = (() => {
  const result: Semester[] = []
  for (let year = 2022; year <= 2031; year++) {
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
  return SEMS.filter((semester) => semester.year >= 2022 && semester.year <= 2031)
}
