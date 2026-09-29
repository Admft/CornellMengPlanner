import ExcelJS from 'exceljs'
import { excelSemesters } from '../data/semesters'
import { isOfferedIn } from '../data/courses'
import { getAllPlacements, generatePlan } from './planEngine'
import { validateScheduleForExport } from './scheduleValidate'
import type { GeneratedPlan, PlannerState } from '../types'
import { SEM_COLS as COLS } from '../types'

/** Build independently of the browser download so the saved file can be verified. */
export async function buildProposalWorkbook(state: PlannerState, buffer: ArrayBuffer, displayPlan = generatePlan(state)) {
  const validation = validateScheduleForExport(state, displayPlan)
  if (!validation.ok) throw new Error(validation.errors.join(' '))
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Template worksheet missing.')
  // ExcelJS shares parsed styles; isolate cells before changing seasonal fills.
  sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => { cell.style = structuredClone(cell.style) }))
  const sections: { start: number; end: number; total: number; kind: string }[] = []
  for (let row = 12; row <= sheet.rowCount; row++) {
    const label = sheet.getCell(`B${row}`).text.toLowerCase()
    const kind = label.includes('required courses') ? 'core' : label.includes('organizational behavior') ? 'org' : label.includes('specialization electives') ? 'el' : ''
    if (kind) sections.push({ start: row + 1, end: 0, total: 0, kind })
  }
  if (sections.length !== 3) throw new Error('Unsupported proposal template: course sections are missing.')
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const boundary = sections[i + 1]?.start ?? sheet.rowCount
    for (let row = section.start; row < boundary; row++) {
      if (sheet.getCell(`E${row}`).formula?.startsWith('SUM(')) { section.total = row; section.end = row - 1; break }
    }
    if (!section.total) throw new Error('Unsupported proposal template: totals are missing.')
  }
  const semesterTotal = sections[2].total + 1
  const grandTotal = semesterTotal + 2
  for (const section of sections) {
    sheet.unMergeCells(`E${section.total}:P${section.total}`)
    for (let row = section.start; row <= section.end; row++) {
      for (const col of COLS) sheet.getCell(`${col}${row}`).value = null
      sheet.getCell(`S${row}`).value = null
    }
  }
  for (const [cell, value] of Object.entries({ C4: state.name, C5: state.studentId, C6: state.netId, G4: state.programStartSem.trim() || state.planFromSem, G5: state.gradSem, G6: state.advisor })) sheet.getCell(cell).value = value
  // Remove cached checks and shared formulas from the original blank proposal.
  for (let row = 4; row <= sheet.rowCount; row++) {
    for (const col of ['S', 'T']) sheet.getCell(`${col}${row}`).value = null
  }
  const semesters = excelSemesters(state.programStartSem, state.planFromSem, state.gradSem)
  COLS.forEach((col, i) => {
    sheet.getCell(`${col}12`).value = semesters[i]?.code ?? null
    sheet.getColumn(col).hidden = !semesters[i]
  })
  sheet.getCell('E11').value = 'Credits by semester (actual term codes)'
  const entries = getAllPlacements(state, displayPlan).map(p => ({ course: p.course, semIndex: p.semIndex }))
  entries.push(...state.customTaken.map(c => ({ course: { ...c, seasons: [], prereqs: [], pri: 0, desc: '', notes: 'Completed course' }, semIndex: semesters.findIndex(s => s.code === c.semCode) })))
  const claimed = new Set<number>()
  for (const { course, semIndex } of entries) {
    const kind = course.cat === 'org' ? 'org' : course.cat === 'el' ? 'el' : 'core'
    const section = sections.find(s => s.kind === kind)!
    const rows = Array.from({ length: section.end - section.start + 1 }, (_, i) => section.start + i)
    const row = rows.find(r => !claimed.has(r) && sheet.getCell(`B${r}`).text.trim() === course.code.trim()) ?? rows.find(r => !claimed.has(r) && !sheet.getCell(`B${r}`).text.trim()) ?? rows.find(r => !claimed.has(r))
    if (!row || semIndex < 0 || semIndex >= COLS.length) throw new Error(`${course.code} does not fit in this template. Use the Summer 2026 template or shorten the export range.`)
    claimed.add(row)
    sheet.getCell(`B${row}`).value = course.code
    sheet.getCell(`C${row}`).value = course.name
    sheet.getCell(`D${row}`).value = course.credits
    sheet.getCell(`Q${row}`).value = course.seasons.join(' / ') || 'Completed course'
    sheet.getCell(`Q${row}`).alignment = { wrapText: true, vertical: 'middle' }
    sheet.getCell(`C${row}`).alignment = { wrapText: true, vertical: 'middle' }
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 15, course.name.length > 60 ? 30 : 18)
    for (const [i, col] of COLS.entries()) {
      sheet.getCell(`${col}${row}`).numFmt = 'General'
      sheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: !semesters[i] || (course.seasons.length > 0 && !isOfferedIn(course, semesters[i])) ? 'FFE7E6E6' : 'FFFFFFFF' } }
    }
    sheet.getCell(`${COLS[semIndex]}${row}`).value = course.credits
  }
  for (const section of sections) {
    // Only selected rows belong in this proposal; do not leave obsolete requirements.
    for (let row = section.start; row <= section.end; row++) {
      if (!claimed.has(row)) for (const col of ['B', 'C', 'D', 'Q']) sheet.getCell(`${col}${row}`).value = null
    }
    for (const col of COLS) {
      let result = 0
      for (let row = section.start; row <= section.end; row++) result += Number(sheet.getCell(`${col}${row}`).value ?? 0)
      sheet.getCell(`${col}${section.total}`).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(`${col}${section.total}`).numFmt = 'General'
      sheet.getCell(`${col}${section.total}`).value = { formula: `SUM(${col}${section.start}:${col}${section.end})`, result }
    }
  }
  COLS.forEach(col => {
    const cells = sections.map(s => `${col}${s.total}`)
    const result = sections.reduce((sum, s) => sum + Number(sheet.getCell(`${col}${s.total}`).result), 0)
    sheet.getCell(`${col}${semesterTotal}`).numFmt = 'General'
    sheet.getCell(`${col}${semesterTotal}`).value = { formula: cells.join('+'), result }
  })
  sheet.getCell(`H${grandTotal}`).value = { formula: `SUM(E${semesterTotal}:P${semesterTotal})`, result: validation.placementCredits }
  sheet.getCell(`B${sections[0].total}`).value = 'Core / residential subtotal'
  sheet.getCell(`B${sections[1].total}`).value = 'Organizational Behavior subtotal'
  sheet.getCell(`B${sections[2].total}`).value = 'Elective subtotal'
  sheet.getCell(`B${sections[0].total + 1}`).value = 'Capstone follows Project Management, Data Analytics, Economics (5940 or 5941 + 5942), and Decision Framing.'
  sheet.getCell('B54').value = validation.warnings.join(' ')
  sheet.getRow(54).height = 40
  sheet.getCell('B54').alignment = { wrapText: true, vertical: 'top' }
  sheet.getCell(`H${grandTotal}`).numFmt = 'General'
  sheet.getCell(`B${sections[1].start - 1}`).value = 'Organizational Behavior (3 credits required)'
  workbook.calcProperties.fullCalcOnLoad = true
  return workbook
}

export async function exportProposalExcel(state: PlannerState, templateBuffer?: ArrayBuffer | null, displayPlan?: GeneratedPlan) {
  let buffer = templateBuffer
  if (buffer) {
    const imported = new ExcelJS.Workbook()
    await imported.xlsx.load(buffer)
    // The old form has fewer core rows. Export historical completions using the updated form.
    if (imported.worksheets[0]?.getCell('B17').text.includes('5940')) buffer = null
  }
  if (!buffer) {
    const response = await fetch('/Cornellproposal.xlsx')
    if (!response.ok) throw new Error('Could not load proposal template.')
    buffer = await response.arrayBuffer()
  }
  const workbook = await buildProposalWorkbook(state, buffer, displayPlan)
  const out = await workbook.xlsx.writeBuffer()
  const blob = new Blob([out as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${state.name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'MEM_Proposal'}_Cornell_MEM_Proposal.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
