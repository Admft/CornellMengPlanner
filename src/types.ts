export type Season = 'Fall' | 'Spring' | 'Summer'
export type CourseCategory = 'req' | 'cap' | 'org' | 'el' | 'res'

export interface Course {
  id: string
  code: string
  name: string
  credits: number
  seasons: Season[]
  prereqs: string[]
  cat: CourseCategory
  pri: number
  desc: string
  notes: string
  excelRow?: number
  legacy?: boolean
}

export interface CustomTakenCourse {
  id: string
  code: string
  name: string
  credits: number
  cat: CourseCategory
  /** Optional semester taken — used for Excel export only. */
  semCode?: string
}

export interface CurriculumCatalog {
  req: Course[]
  ob: Course[]
  el: Course[]
  res2: Course
  pd1: Course
  pd2: Course
}

export interface Semester {
  code: string
  season: Season
  label: string
  year: number
}

export interface PlannerState {
  step: number
  name: string
  studentId: string
  netId: string
  advisor: string
  planFromSem: string
  programStartSem: string
  gradSem: string
  crLimit: number
  taken: Set<string>
  /** Optional per-course semester taken — Excel export only. */
  takenSemesters: Record<string, string>
  obChoice: string
  elChoices: Set<string>
  resChoice: 'session2' | 'workshops'
  customTaken: CustomTakenCourse[]
  curriculum: CurriculumCatalog
  /** Matriculated before Summer 2026 — waives ENMGT 5405 AI requirement per Cornell. */
  returningStudent: boolean
}

export interface SemesterPlan {
  sem: Semester
  courses: Course[]
  cr: number
}

export interface GeneratedPlan {
  plan: Record<string, SemesterPlan>
  unscheduled: Course[]
  sems: Semester[]
}

export const CUSTOM_COURSE_CATS: { value: CourseCategory; label: string }[] = [
  { value: 'req', label: 'Core required' },
  { value: 'cap', label: 'Capstone' },
  { value: 'org', label: 'Org. behavior' },
  { value: 'el', label: 'Elective' },
  { value: 'res', label: 'Residential / PD' },
]

export const ADVISORS = [
  'Andrea Ippolito',
  'Robert Newman',
  'Dirk Swart',
] as const

export const SEM_COLS = [
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
] as const

export const DEFAULT_STATE: Omit<PlannerState, 'curriculum' | 'planFromSem'> & {
  planFromSem: string
} = {
  step: 1,
  name: '',
  studentId: '',
  netId: '',
  advisor: 'Robert Newman',
  planFromSem: 'SU26',
  programStartSem: '',
  gradSem: 'SP28',
  crLimit: 8,
  taken: new Set(),
  takenSemesters: {},
  obChoice: '',
  elChoices: new Set(),
  resChoice: 'session2',
  customTaken: [],
  returningStudent: true,
}
