import ExcelJS from 'exceljs'
import { catalogToList } from '../data/courses'
import { getAllPlacements } from './planEngine'
import type { PlannerState } from '../types'
import { SEM_COLS as COLS } from '../types'

function resolveExcelRow(state: PlannerState, courseId: string): number | undefined {
  const course = catalogToList(state.curriculum).find((c) => c.id === courseId)
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

export async function exportProposalExcel(
  state: PlannerState,
  templateBuffer?: ArrayBuffer | null,
) {
  let buffer = templateBuffer
  if (!buffer) {
    const response = await fetch('/Cornellproposal.xlsx')
    if (!response.ok) {
      throw new Error('Could not load proposal template.')
    }
    buffer = await response.arrayBuffer()
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Template worksheet missing.')

  sheet.getCell('C4').value = state.name
  sheet.getCell('C5').value = state.studentId
  sheet.getCell('C6').value = state.netId
  sheet.getCell('G4').value = state.startSem
  sheet.getCell('G5').value = state.gradSem
  sheet.getCell('G6').value = state.advisor

  const courseRows = catalogToList(state.curriculum)
    .map((c) => c.excelRow)
    .filter((row): row is number => row != null)

  for (const row of courseRows) {
    for (const col of COLS) {
      sheet.getCell(`${col}${row}`).value = null
    }
  }

  const placements = getAllPlacements(state)
  for (const placement of placements) {
    const row = resolveExcelRow(state, placement.course.id)
    if (!row || placement.semIndex < 0 || placement.semIndex >= COLS.length) {
      continue
    }
    const col = COLS[placement.semIndex]
    sheet.getCell(`${col}${row}`).value = placement.course.credits
  }

  const safeName = state.name.trim().replace(/\s+/g, '_') || 'MEM_Proposal'
  const outBuffer = await workbook.xlsx.writeBuffer()
  downloadBuffer(outBuffer as ArrayBuffer, `${safeName}_Cornell_MEM_Proposal.xlsx`)
}
