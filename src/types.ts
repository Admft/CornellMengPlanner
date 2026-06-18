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
  startSem: string
  gradSem: string
  crLimit: number
  taken: Set<string>
  obChoice: string
  elChoices: Set<string>
  resChoice: 'session2' | 'workshops'
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

export const DEFAULT_STATE: PlannerState = {
  step: 1,
  name: '',
  studentId: '',
  netId: '',
  advisor: 'Robert Newman',
  startSem: 'SP26',
  gradSem: 'SP28',
  crLimit: 8,
  taken: new Set(),
  obChoice: '',
  elChoices: new Set(),
  resChoice: 'session2',
}
