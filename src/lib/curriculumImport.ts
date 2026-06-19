import ExcelJS from 'exceljs'
import type { Course, CourseCategory, CurriculumCatalog, Season } from '../types'

type Section = 'req' | 'ob' | 'el'

const COURSE_CODE_RE =
  /^(ENMGT|CEE|NBA|SYSEN)\s+\d+/i

function parseSeasons(comment: string | null | undefined): Season[] {
  if (!comment) return ['Fall', 'Spring']
  const text = comment.toLowerCase()
  const seasons: Season[] = []
  if (text.includes('summer')) seasons.push('Summer')
  if (text.includes('fall')) seasons.push('Fall')
  if (text.includes('spring')) seasons.push('Spring')
  return seasons.length > 0 ? seasons : ['Fall', 'Spring']
}

function toCourseId(code: string): string {
  const normalized = code.trim().replace(/\s*\(.+\)\s*$/, '')
  const match = normalized.match(/(\d+)/)
  if (!match) return normalized.replace(/\s+/g, '')
  const num = match[1]
  if (normalized.toUpperCase().startsWith('CEE')) return `CEE${num}`
  if (normalized.toUpperCase().startsWith('NBA')) return `NBA${num}`
  if (normalized.toUpperCase().startsWith('SYSEN')) return `SYS${num}`
  return `EN${num}`
}

function detectSection(label: string): Section | null {
  const text = label.toLowerCase()
  if (text.includes('required course')) return 'req'
  if (text.includes('organizational behavior')) return 'ob'
  if (text.includes('specialization elective')) return 'el'
  return null
}

function isCapstone(code: string, name: string): boolean {
  return code.includes('5910') || name.toLowerCase().includes('management project')
}

function isResidential(code: string): boolean {
  return /600[12]/.test(code)
}

function isPdWorkshop(code: string): boolean {
  return /601[012]/.test(code)
}

function buildCourse(
  row: number,
  code: string,
  name: string,
  credits: number,
  section: Section,
  comment: string | null | undefined,
  obCodes: Set<string>,
): Course | null {
  if (!COURSE_CODE_RE.test(code)) return null

  const baseId = toCourseId(code)
  let id = baseId
  let cat: CourseCategory = section === 'ob' ? 'org' : section === 'el' ? 'el' : 'req'
  let pri = cat === 'req' ? 1 : cat === 'org' ? 2 : 4

  if (section === 'req' && isCapstone(code, name)) {
    cat = 'cap'
    pri = 3
  } else if (isResidential(code)) {
    cat = 'res'
    pri = 1
  } else if (isPdWorkshop(code)) {
    cat = 'res'
    pri = 1
  }

  if (section === 'el' && obCodes.has(baseId)) {
    id = `${baseId}el`
  }

  const seasons = parseSeasons(comment)
  const prereqs: string[] = []
  if (cat === 'cap') {
    prereqs.push('EN5900', 'EN5930', 'EN5941', 'EN5942', 'EN5980')
  }

  return {
    id,
    code: code.trim(),
    name: name.trim(),
    credits,
    seasons,
    prereqs,
    cat,
    pri,
    desc: name.trim(),
    notes: comment?.trim() ?? '',
    excelRow: row,
  }
}

export interface ImportResult {
  catalog: CurriculumCatalog
  courseRows: number[]
}

export async function importCurriculumFromXlsx(
  buffer: ArrayBuffer,
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in the uploaded file.')

  let section: Section | null = null
  const req: Course[] = []
  const ob: Course[] = []
  const el: Course[] = []
  const courseRows: number[] = []
  const obCodes = new Set<string>()
  let res2: Course | undefined
  const pdWorkshops: Course[] = []

  for (let row = 1; row <= sheet.rowCount; row++) {
    const label = String(sheet.getCell(`B${row}`).value ?? '')
    const detected = detectSection(label)
    if (detected) {
      section = detected
      continue
    }

    const code = String(sheet.getCell(`B${row}`).value ?? '').trim()
    const name = String(sheet.getCell(`C${row}`).value ?? '').trim()
    const creditsRaw = sheet.getCell(`D${row}`).value
    const comment = sheet.getCell(`Q${row}`).value
    const credits =
      typeof creditsRaw === 'number'
        ? creditsRaw
        : creditsRaw
          ? Number(creditsRaw)
          : NaN

    if (!code || !name || Number.isNaN(credits)) continue
    if (!section) continue

    const course = buildCourse(
      row,
      code,
      name,
      credits,
      section,
      comment ? String(comment) : null,
      obCodes,
    )
    if (!course) continue

    courseRows.push(row)

    if (course.id === 'EN6002' || (isResidential(code) && code.includes('6002'))) {
      res2 = course
      continue
    }
    if (isPdWorkshop(code)) {
      pdWorkshops.push(course)
      continue
    }

    if (section === 'req') req.push(course)
    else if (section === 'ob') {
      ob.push(course)
      obCodes.add(toCourseId(code))
    } else el.push(course)
  }

  if (req.length === 0) {
    throw new Error(
      'Could not find courses in this file. Make sure you uploaded a Cornell MEM proposal spreadsheet.',
    )
  }

  if (!res2) {
    res2 = {
      id: 'EN6002',
      code: 'ENMGT 6002',
      name: 'Residential Session II',
      credits: 1,
      seasons: ['Summer'],
      prereqs: [],
      cat: 'res',
      pri: 1,
      desc: 'Second on-campus immersive session.',
      notes: 'Summer only.',
    }
  }
  pdWorkshops.sort((a, b) => a.id.localeCompare(b.id))
  const pd1 = pdWorkshops[0]
  const pd2 = pdWorkshops[1]

  if (!pd1 || !pd2) {
    throw new Error('Could not find Professional Development workshop courses in the uploaded file.')
  }

  return {
    catalog: { req, ob, el, res2, pd1, pd2 },
    courseRows,
  }
}
