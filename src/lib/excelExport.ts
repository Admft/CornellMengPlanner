import ExcelJS from 'exceljs'
import { getCourseById } from '../data/courses'
import { getAllPlacements } from './planEngine'
import type { PlannerState } from '../types'
import { SEM_COLS as COLS } from '../types'

const COURSE_ROWS = [
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  27, 28, 29, 30,
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
] as const

function resolveExcelRow(courseId: string): number | undefined {
  const course = getCourseById(courseId)
  return course?.excelRow
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportProposalExcel(state: PlannerState) {
  const response = await fetch('/Cornellproposal.xlsx')
  if (!response.ok) {
    throw new Error('Could not load proposal template.')
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await response.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Template worksheet missing.')

  sheet.getCell('C4').value = state.name
  sheet.getCell('C5').value = state.studentId
  sheet.getCell('C6').value = state.netId
  sheet.getCell('G4').value = state.startSem
  sheet.getCell('G5').value = state.gradSem
  sheet.getCell('G6').value = state.advisor

  for (const row of COURSE_ROWS) {
    for (const col of COLS) {
      sheet.getCell(`${col}${row}`).value = null
    }
  }

  const placements = getAllPlacements(state)
  for (const placement of placements) {
    const row = resolveExcelRow(placement.course.id)
    if (!row || placement.semIndex < 0 || placement.semIndex >= COLS.length) {
      continue
    }
    const col = COLS[placement.semIndex]
    sheet.getCell(`${col}${row}`).value = placement.course.credits
  }

  // Row 48 (semester totals) and H50 (program total) contain shared formulas
  // in the template — leave them so Excel recalculates from the course cells above.

  const safeName = state.name.trim().replace(/\s+/g, '_') || 'MEM_Proposal'
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(buffer as ArrayBuffer, `${safeName}_Cornell_MEM_Proposal.xlsx`)
}
