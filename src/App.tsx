import { useMemo, useRef, useState } from 'react'
import { CourseListItem, PlanCard } from './components/CourseItems'
import { FeatureRequestModal } from './components/FeatureRequestModal'
import {
  DEFAULT_CURRICULUM,
  catalogToList,
  seasonKey,
} from './data/courses'
import { LEGACY_COURSES } from './data/legacyCourses'
import { relevantSemesters, semIdx } from './data/semesters'
import { importCurriculumFromXlsx } from './lib/curriculumImport'
import { exportProposalExcel } from './lib/excelExport'
import {
  generatePlan,
  getCreditTotals,
  hasWorkshopsDone,
} from './lib/planEngine'
import {
  ADVISORS,
  DEFAULT_STATE,
  type Course,
  type CurriculumCatalog,
  type CustomTakenCourse,
  type PlannerState,
} from './types'
import './App.css'

function toPlannerState(state: AppState): PlannerState {
  return {
    ...state,
    taken: new Set(state.taken),
    elChoices: new Set(state.elChoices),
    customTaken: state.customTaken,
    curriculum: state.curriculum,
  }
}

function reqCourses(catalog: CurriculumCatalog) {
  return catalog.req.filter((c) => c.cat !== 'cap')
}

interface AppState {
  step: number
  name: string
  studentId: string
  netId: string
  advisor: string
  startSem: string
  gradSem: string
  crLimit: number
  taken: string[]
  obChoice: string
  elChoices: string[]
  resChoice: 'session2' | 'workshops'
  customTaken: CustomTakenCourse[]
  curriculum: CurriculumCatalog
  curriculumImported: boolean
}

const STEPS = ['Timeline', 'Courses Taken', 'Your Choices', 'Your Plan']
const EL_MIN = 2

function CourseList({
  courses,
  inputType,
  name,
  selected,
  onToggle,
  expanded,
  onExpand,
}: {
  courses: Course[]
  inputType: 'checkbox' | 'radio'
  name: string
  selected: Set<string> | string
  onToggle: (id: string, checked: boolean) => void
  expanded: Set<string>
  onExpand: (id: string) => void
}) {
  return (
    <div className="clist">
      {courses.map((course) => {
        const checked =
          inputType === 'radio'
            ? selected === course.id
            : (selected as Set<string>).has(course.id)
        return (
          <CourseListItem
            key={course.id}
            course={course}
            inputType={inputType}
            name={name}
            checked={checked}
            onChange={(value) => onToggle(course.id, value)}
            expanded={expanded.has(course.id)}
            onToggle={() => onExpand(course.id)}
          />
        )
      })}
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>({
    step: 1,
    name: DEFAULT_STATE.name,
    studentId: DEFAULT_STATE.studentId,
    netId: DEFAULT_STATE.netId,
    advisor: DEFAULT_STATE.advisor,
    startSem: DEFAULT_STATE.startSem,
    gradSem: DEFAULT_STATE.gradSem,
    crLimit: DEFAULT_STATE.crLimit,
    taken: [],
    obChoice: DEFAULT_STATE.obChoice,
    elChoices: [],
    resChoice: DEFAULT_STATE.resChoice,
    customTaken: [],
    curriculum: DEFAULT_CURRICULUM,
    curriculumImported: false,
  })
  const proposalTemplateRef = useRef<ArrayBuffer | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [planExpanded, setPlanExpanded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [showFeatureRequest, setShowFeatureRequest] = useState(false)
  const [customDraft, setCustomDraft] = useState({ code: '', name: '', credits: '3' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { curriculum } = state
  const REQ = reqCourses(curriculum)
  const OB = curriculum.ob
  const EL = curriculum.el
  const RES2 = curriculum.res2
  const PD1 = curriculum.pd1
  const PD2 = curriculum.pd2
  const ALL_COURSES = useMemo(() => catalogToList(curriculum), [curriculum])

  const planner = useMemo(() => toPlannerState(state), [state])
  const plan = useMemo(() => generatePlan(planner), [planner])
  const credits = useMemo(() => getCreditTotals(planner), [planner])
  const semesterOptions = relevantSemesters()

  const takenSet = useMemo(() => new Set(state.taken), [state.taken])
  const elSet = useMemo(() => new Set(state.elChoices), [state.elChoices])

  const takenOB = OB.filter((course) => takenSet.has(course.id))
  const takenElCount = EL.filter((course) => takenSet.has(course.id)).length
  const elPlannedCount = state.elChoices.length
  const elStillNeeded = Math.max(0, EL_MIN - takenElCount)
  const elTotal = takenElCount + elPlannedCount
  const elOverSelecting = elStillNeeded > 0 && elPlannedCount > elStillNeeded
  const elExtraBeyondMin = elTotal > EL_MIN
  const hasRes2 = takenSet.has(RES2.id)
  const hasPDs = hasWorkshopsDone(takenSet)

  const filteredElectives = EL.filter((course) => {
    if (takenSet.has(course.id)) return false
    if (state.obChoice === 'EN5300' && course.id === 'EN5300el') return false
    if (state.obChoice === 'EN6030' && course.id === 'EN6030el') return false
    return true
  })

  const takenCourses = [
    ...ALL_COURSES.filter((course) => takenSet.has(course.id)),
    ...LEGACY_COURSES.filter((course) => takenSet.has(course.id)),
  ]
  const pct = Math.min(100, Math.round((credits.total / 30) * 100))

  async function handleCurriculumImport(file: File) {
    setImportError('')
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const { catalog } = await importCurriculumFromXlsx(buffer)
      proposalTemplateRef.current = buffer
      setState((prev) => ({
        ...prev,
        curriculum: catalog,
        curriculumImported: true,
        obChoice: catalog.ob.some((c) => c.id === prev.obChoice) ? prev.obChoice : '',
        elChoices: prev.elChoices.filter((id) => catalog.el.some((c) => c.id === id)),
      }))
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Could not read that spreadsheet.',
      )
    } finally {
      setImporting(false)
    }
  }

  function addCustomTaken() {
    const credits = Number(customDraft.credits)
    if (!customDraft.name.trim() || Number.isNaN(credits) || credits <= 0) return
    const entry: CustomTakenCourse = {
      id: `custom-${Date.now()}`,
      code: customDraft.code.trim() || 'Custom',
      name: customDraft.name.trim(),
      credits,
    }
    setState((prev) => ({
      ...prev,
      customTaken: [...prev.customTaken, entry],
    }))
    setCustomDraft({ code: '', name: '', credits: '3' })
  }

  function removeCustomTaken(id: string) {
    setState((prev) => ({
      ...prev,
      customTaken: prev.customTaken.filter((c) => c.id !== id),
    }))
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePlanExpanded(id: string) {
    setPlanExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate(step: number) {
    if (step === 1) {
      const ok = semIdx(state.gradSem) > semIdx(state.startSem) + 1
      setErrors((prev) => ({ ...prev, timeline: !ok }))
      return ok
    }
    if (step === 3) {
      const obOk = takenOB.length > 0 || !!state.obChoice
      const elOk = takenElCount + state.elChoices.length >= EL_MIN
      setErrors((prev) => ({ ...prev, ob: !obOk, el: !elOk }))
      return obOk && elOk
    }
    return true
  }

  function goNext() {
    if (!validate(state.step)) return
    if (state.step < 4) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function goBack() {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: prev.step - 1 }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleExport() {
    setExportError('')
    setExporting(true)
    try {
      await exportProposalExcel(planner, proposalTemplateRef.current)
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed. Please try again.',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-word">Cornell Engineering</span>
          <span className="hdr-sep">|</span>
          <span className="hdr-app">M.Eng. Management · Course Planner</span>
        </div>
        <button
          type="button"
          className="hdr-request"
          onClick={() => setShowFeatureRequest(true)}
        >
          Request a change
        </button>
      </header>

      <FeatureRequestModal
        open={showFeatureRequest}
        onClose={() => setShowFeatureRequest(false)}
      />

      <nav className="pnav">
        {STEPS.map((label, index) => {
          const stepNum = index + 1
          const isActive = state.step === stepNum
          const isDone = state.step > stepNum
          return (
            <div
              key={label}
              className={`pstep ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              <div className="pstep-num">{isDone ? '✓' : stepNum}</div>
              <div className="pstep-lbl">{label}</div>
            </div>
          )
        })}
      </nav>

      <main className="main">
        {state.step === 1 && (
          <section className="step active">
            <h1 className="step-title">Set your program timeline</h1>
            <p className="step-sub">
              Enter your student information and choose when you started (or will
              start) the MEM program and when you want to graduate.
            </p>

            <div className="card">
              <div className="sec-label">Student information</div>
              <div className="form-row">
                <div className="fg">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={state.name}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Adam Moffat"
                  />
                </div>
                <div className="fg">
                  <label htmlFor="netId">NetID</label>
                  <input
                    id="netId"
                    type="text"
                    value={state.netId}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, netId: e.target.value }))
                    }
                    placeholder="Arm393"
                  />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="fg">
                  <label htmlFor="studentId">Student ID #</label>
                  <input
                    id="studentId"
                    type="text"
                    value={state.studentId}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, studentId: e.target.value }))
                    }
                  />
                </div>
                <div className="fg">
                  <label htmlFor="advisor">Advisor</label>
                  <select
                    id="advisor"
                    value={state.advisor}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, advisor: e.target.value }))
                    }
                  >
                    {ADVISORS.map((advisor) => (
                      <option key={advisor} value={advisor}>
                        {advisor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="form-row">
                <div className="fg">
                  <label htmlFor="startSem">Program start semester</label>
                  <select
                    id="startSem"
                    value={state.startSem}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, startSem: e.target.value }))
                    }
                  >
                    {semesterOptions.map((sem) => (
                      <option key={sem.code} value={sem.code}>
                        {sem.label}
                      </option>
                    ))}
                  </select>
                  <span className="hint">First semester in the MEM program.</span>
                </div>
                <div className="fg">
                  <label htmlFor="gradSem">Target graduation semester</label>
                  <select
                    id="gradSem"
                    value={state.gradSem}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, gradSem: e.target.value }))
                    }
                  >
                    {semesterOptions.map((sem) => (
                      <option key={sem.code} value={sem.code}>
                        {sem.label}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Semester you want to complete the degree.</span>
                </div>
              </div>
              <div className={`val-msg ${errors.timeline ? 'show' : ''}`}>
                ⚠ Graduation must be at least 2 semesters after your start.
              </div>
            </div>

            <div className="info-row">
              <span className="info-icon">📋</span>
              <span>
                The MEM program requires a minimum of <strong>30 credits</strong>.
                Most students complete it in 4–6 semesters (about 2 years).
              </span>
            </div>

            <div className="card">
              <div className="sec-label">Curriculum version</div>
              <div className="info-row" style={{ marginBottom: 14 }}>
                <span className="info-icon">📄</span>
                <span>
                  Cornell updates the course list most semesters. If you received a
                  newer proposal spreadsheet, import it here to load the latest
                  classes. Otherwise the current curriculum is already loaded.
                </span>
              </div>
              <div className="import-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="file-input-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleCurriculumImport(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? 'Importing…' : 'Import proposal .xlsx'}
                </button>
                <span className="import-status">
                  {state.curriculumImported
                    ? '✓ Custom curriculum loaded from your file'
                    : 'Using latest curriculum (updated proposal)'}
                </span>
              </div>
              {importError && (
                <div className="val-msg show" style={{ marginTop: 12 }}>
                  ⚠ {importError}
                </div>
              )}
            </div>

            <div className="card">
              <div className="sec-label">Credits per semester</div>
              <div className="info-row" style={{ marginBottom: 16 }}>
                <span className="info-icon">💡</span>
                <span>
                  Default is <strong>8 credits/semester</strong>. You can push up
                  to <strong>12 credits</strong>. Summer semesters are always
                  capped at 2 credits.
                </span>
              </div>
              <div className="cr-ctl">
                <div className="cr-num">
                  <div className="cr-big">{state.crLimit}</div>
                  <div className="cr-lbl">cr/semester</div>
                </div>
                <div className="cr-slide-wrap">
                  <input
                    type="range"
                    className="cr-range"
                    min={4}
                    max={12}
                    step={1}
                    value={state.crLimit}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        crLimit: Number(e.target.value),
                      }))
                    }
                  />
                  <div className="cr-ticks">
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                    <span>10</span>
                    <span>12 (max)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {state.step === 2 && (
          <section className="step active">
            <h1 className="step-title">What have you already completed?</h1>
            <p className="step-sub">
              Check every course you&apos;ve finished. Click the ▼ on any course
              to read its description and details.
            </p>

            <div className="card">
              <div className="sec-label">Required Core Courses</div>
              <CourseList
                courses={REQ}
                inputType="checkbox"
                name="taken-req"
                selected={takenSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    taken: checked
                      ? [...prev.taken, id]
                      : prev.taken.filter((item) => item !== id),
                  }))
                }
              />
            </div>

            <div className="card">
              <div className="sec-label">
                Organizational Behavior{' '}
                <span className="sec-note">(choose 1 — check if already done)</span>
              </div>
              <CourseList
                courses={OB}
                inputType="checkbox"
                name="taken-ob"
                selected={takenSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    taken: checked
                      ? [...prev.taken, id]
                      : prev.taken.filter((item) => item !== id),
                  }))
                }
              />
            </div>

            <div className="card">
              <div className="sec-label">
                Specialization Electives{' '}
                <span className="sec-note">(check any already completed)</span>
              </div>
              <CourseList
                courses={EL}
                inputType="checkbox"
                name="taken-el"
                selected={takenSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    taken: checked
                      ? [...prev.taken, id]
                      : prev.taken.filter((item) => item !== id),
                  }))
                }
              />
            </div>

            <div className="card">
              <div className="sec-label">Residential &amp; Professional Development</div>
              <CourseList
                courses={[RES2, PD1, PD2]}
                inputType="checkbox"
                name="taken-res"
                selected={takenSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    taken: checked
                      ? [...prev.taken, id]
                      : prev.taken.filter((item) => item !== id),
                  }))
                }
              />
            </div>

            <div className="card legacy-card">
              <div className="sec-label">
                Previous curriculum courses{' '}
                <span className="sec-note">(old &amp; new versions — check if already done)</span>
              </div>
              <div className="info-row" style={{ marginBottom: 12 }}>
                <span className="info-icon">🕐</span>
                <span>
                  If you started under an older proposal, mark courses here.
                  Includes removed classes (e.g. ENMGT 5940) and previous credit
                  amounts (e.g. Data Analytics was 4 cr).
                </span>
              </div>
              <CourseList
                courses={LEGACY_COURSES}
                inputType="checkbox"
                name="taken-legacy"
                selected={takenSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    taken: checked
                      ? [...prev.taken, id]
                      : prev.taken.filter((item) => item !== id),
                  }))
                }
              />
            </div>

            <div className="card">
              <div className="sec-label">Custom completed courses</div>
              <div className="info-row" style={{ marginBottom: 14 }}>
                <span className="info-icon">✏️</span>
                <span>
                  If you took a course that was removed from the curriculum and
                  isn&apos;t listed above, add it here with the credit amount from
                  your transcript.
                </span>
              </div>
              {state.customTaken.length > 0 && (
                <div className="custom-taken-list">
                  {state.customTaken.map((course) => (
                    <div key={course.id} className="custom-taken-item">
                      <span className="ci-code">{course.code}</span>
                      <span className="ci-name">{course.name}</span>
                      <span className="ci-cr">{course.credits} cr</span>
                      <button
                        type="button"
                        className="custom-remove"
                        onClick={() => removeCustomTaken(course.id)}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="custom-add-row">
                <div className="fg">
                  <label htmlFor="customCode">Course code</label>
                  <input
                    id="customCode"
                    type="text"
                    value={customDraft.code}
                    onChange={(e) =>
                      setCustomDraft((prev) => ({ ...prev, code: e.target.value }))
                    }
                    placeholder="ENMGT 5940"
                  />
                </div>
                <div className="fg">
                  <label htmlFor="customName">Course name</label>
                  <input
                    id="customName"
                    type="text"
                    value={customDraft.name}
                    onChange={(e) =>
                      setCustomDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Economics and Finance…"
                  />
                </div>
                <div className="fg fg-narrow">
                  <label htmlFor="customCredits">Credits</label>
                  <input
                    id="customCredits"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={customDraft.credits}
                    onChange={(e) =>
                      setCustomDraft((prev) => ({ ...prev, credits: e.target.value }))
                    }
                  />
                </div>
                <button type="button" className="btn btn-secondary" onClick={addCustomTaken}>
                  + Add
                </button>
              </div>
            </div>
          </section>
        )}

        {state.step === 3 && (
          <section className="step active">
            <h1 className="step-title">Plan your remaining courses</h1>
            <p className="step-sub">
              Select the courses you plan to take. Your choices will be scheduled
              into the right semesters automatically.
            </p>

            <div className="card">
              <div className="sec-label">Organizational Behavior — select 1</div>
              {takenOB.length > 0 ? (
                <div className="done-banner">
                  ✓ Already completed:{' '}
                  <strong>{takenOB.map((c) => c.name).join(', ')}</strong>
                </div>
              ) : (
                <>
                  <CourseList
                    courses={OB}
                    inputType="radio"
                    name="ob-choice"
                    selected={state.obChoice}
                    expanded={expanded}
                    onExpand={toggleExpanded}
                    onToggle={(id, checked) =>
                      setState((prev) => ({
                        ...prev,
                        obChoice: checked ? id : prev.obChoice,
                      }))
                    }
                  />
                  <div className={`val-msg ${errors.ob ? 'show' : ''}`}>
                    ⚠ Please select one organizational behavior course to complete
                    your degree.
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="sec-label">
                Specialization Electives — select at least {EL_MIN} total
              </div>

              <div className="el-tracker">
                <div className="el-tracker-top">
                  <span className="el-tracker-title">Elective count</span>
                  <span
                    className={`el-tracker-badge ${elTotal >= EL_MIN ? 'met' : 'need'}`}
                  >
                    {elTotal >= EL_MIN
                      ? `${elTotal} total — requirement met`
                      : `${elTotal} of ${EL_MIN} required`}
                  </span>
                </div>
                <div className="el-tracker-bar">
                  <div
                    className="el-tracker-fill"
                    style={{ width: `${Math.min(100, (elTotal / EL_MIN) * 100)}%` }}
                  />
                  <div className="el-tracker-mark" style={{ left: '100%' }} />
                </div>
                <div className="el-tracker-stats">
                  <span>
                    <strong>{takenElCount}</strong> completed
                  </span>
                  <span>
                    <strong>{elPlannedCount}</strong> selected below
                  </span>
                  <span>
                    <strong>{EL_MIN}</strong> minimum
                  </span>
                </div>
              </div>

              {takenElCount >= EL_MIN ? (
                <div className="alert alert-ok el-alert">
                  <span className="alert-icon">✓</span>
                  <div>
                    You&apos;ve already completed the {EL_MIN}-elective minimum. Anything
                    you select below is optional — add only if you want extra electives
                    in your plan.
                  </div>
                </div>
              ) : takenElCount > 0 ? (
                <div className="info-row el-hint">
                  <span className="info-icon">📚</span>
                  <span>
                    You&apos;ve completed <strong>{takenElCount}</strong> elective
                    {takenElCount !== 1 ? 's' : ''}. Select{' '}
                    <strong>{elStillNeeded}</strong> more below to reach the minimum.
                  </span>
                </div>
              ) : (
                <div className="info-row el-hint">
                  <span className="info-icon">📚</span>
                  <span>Select at least {EL_MIN} electives to include in your degree plan.</span>
                </div>
              )}

              {elOverSelecting && (
                <div className="alert alert-warn el-alert">
                  <span className="alert-icon">⚠</span>
                  <div>
                    <strong>You&apos;re selecting more than you need.</strong>{' '}
                    {takenElCount > 0 ? (
                      <>
                        You already completed {takenElCount} elective
                        {takenElCount !== 1 ? 's' : ''}, so you only need{' '}
                        <strong>{elStillNeeded} more</strong> — but you&apos;ve selected{' '}
                        <strong>{elPlannedCount}</strong> below. That&apos;s{' '}
                        <strong>{elTotal} total</strong> ({elTotal - EL_MIN} beyond the
                        minimum). Extra electives are fine if you want them, but you can
                        deselect {elPlannedCount - elStillNeeded} to stay at exactly{' '}
                        {EL_MIN}.
                      </>
                    ) : (
                      <>
                        The degree requires <strong>{EL_MIN} electives</strong>, but
                        you&apos;ve selected <strong>{elPlannedCount}</strong>. Deselect{' '}
                        {elPlannedCount - EL_MIN} unless you intentionally want extra
                        electives in your plan.
                      </>
                    )}
                  </div>
                </div>
              )}

              {!elOverSelecting && elExtraBeyondMin && takenElCount >= EL_MIN && (
                <div className="alert alert-warn el-alert">
                  <span className="alert-icon">ℹ</span>
                  <div>
                    You&apos;re adding <strong>{elPlannedCount}</strong> optional elective
                    {elPlannedCount !== 1 ? 's' : ''} on top of the {EL_MIN} you already
                    completed ({elTotal} total). That&apos;s allowed — just be aware they
                    aren&apos;t required for the degree.
                  </div>
                </div>
              )}

              <CourseList
                courses={filteredElectives}
                inputType="checkbox"
                name="el-choice"
                selected={elSet}
                expanded={expanded}
                onExpand={toggleExpanded}
                onToggle={(id, checked) =>
                  setState((prev) => ({
                    ...prev,
                    elChoices: checked
                      ? [...prev.elChoices, id]
                      : prev.elChoices.filter((item) => item !== id),
                  }))
                }
              />
              <div className={`val-msg ${errors.el ? 'show' : ''}`}>
                ⚠ You need at least 2 specialization electives in total.
              </div>
            </div>

            <div className="card">
              <div className="sec-label">Residential / Professional Development</div>
              <div className="info-row" style={{ marginBottom: 14 }}>
                <span className="info-icon">🏛</span>
                <span>
                  <strong>Residential Session I</strong> (ENMGT 6001, Summer) is
                  required for everyone. For the second 1-credit requirement,
                  choose one option:
                </span>
              </div>
              {hasRes2 || hasPDs ? (
                <div className="done-banner">
                  ✓{' '}
                  {hasRes2
                    ? 'Already completed Residential Session II.'
                    : 'Already completed both Professional Development Workshops.'}
                </div>
              ) : (
                <div className="res-grid">
                  <div
                    className={`res-opt ${state.resChoice === 'session2' ? 'sel' : ''}`}
                    onClick={() =>
                      setState((prev) => ({ ...prev, resChoice: 'session2' }))
                    }
                  >
                    <div className="res-opt-title">Residential Session II</div>
                    <div className="res-opt-desc">
                      Attend a second on-campus immersive session (ENMGT 6002).
                    </div>
                    <div className="res-opt-cr">1 credit · Summer only</div>
                  </div>
                  <div
                    className={`res-opt ${state.resChoice === 'workshops' ? 'sel' : ''}`}
                    onClick={() =>
                      setState((prev) => ({ ...prev, resChoice: 'workshops' }))
                    }
                  >
                    <div className="res-opt-title">Two PD Workshops</div>
                    <div className="res-opt-desc">
                      Take {PD1.code} + {PD2.code} instead of the residential
                      session.
                    </div>
                    <div className="res-opt-cr">{PD1.credits} + {PD2.credits} credits · Fall or Spring</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {state.step === 4 && (
          <section className="step active">
            <div className="plan-header-row">
              <h1 className="step-title">Your personalized course plan</h1>
              <div className="plan-actions">
                <button className="btn-sm" onClick={() => window.print()}>
                  ⎙ Print
                </button>
                <button
                  className="btn-sm btn-export"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting…' : '↓ Export Excel'}
                </button>
              </div>
            </div>
            <p className="step-sub">
              Courses are scheduled semester-by-semester based on availability,
              prerequisites, and your graduation target. Export downloads the
              official Cornell proposal form with your plan filled in.
            </p>

            {exportError && (
              <div className="alert alert-err">
                <span className="alert-icon">⚠</span>
                <div>{exportError}</div>
              </div>
            )}

            {elExtraBeyondMin && (
              <div className="alert alert-warn">
                <span className="alert-icon">📚</span>
                <div>
                  Your plan includes <strong>{elTotal} specialization electives</strong>{' '}
                  ({takenElCount} completed + {elPlannedCount} planned). The degree only
                  requires {EL_MIN}. Extra electives add credits and workload — confirm
                  that&apos;s intentional.
                </div>
              </div>
            )}

            {plan.unscheduled.length > 0 && (
              <div className="alert alert-err">
                <span className="alert-icon">⚠</span>
                <div>
                  <strong>
                    {plan.unscheduled.length} course(s) couldn&apos;t fit before
                    your graduation date:
                  </strong>
                  {plan.unscheduled.map((course) => (
                    <div key={course.id}>
                      • {course.code} — {course.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {credits.total < 30 && (
              <div className="alert alert-warn">
                <span className="alert-icon">📊</span>
                <div>
                  Your current plan totals <strong>{credits.total} credits</strong>{' '}
                  — you need at least 30. Consider adding more electives in Step 3.
                </div>
              </div>
            )}

            {credits.total >= 30 && plan.unscheduled.length === 0 && (
              <div className="alert alert-ok">
                <span className="alert-icon">✓</span>
                <div>
                  Your plan meets the 30-credit requirement with{' '}
                  <strong>{credits.total} credits</strong> across your program.
                </div>
              </div>
            )}

            <div className="plan-summary">
              <div className="credit-hero">
                <div className="credit-num">{credits.total}</div>
                <div>
                  <div className="credit-lbl">total credits planned</div>
                  <div className="credit-sub">30 credits required for the MEM degree</div>
                </div>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="prog-labels">
                <span>{credits.takenCredits} already completed</span>
                <span>{credits.plannedCredits} in plan</span>
                <span>30 minimum</span>
              </div>
              <div className="cr-plan-row">
                <span className="cr-plan-lbl">Credits per semester:</span>
                <div className="cr-stepper">
                  <button
                    className="cr-step-btn"
                    disabled={state.crLimit <= 4}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        crLimit: Math.max(4, prev.crLimit - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <div className="cr-step-num">{state.crLimit}</div>
                  <button
                    className="cr-step-btn"
                    disabled={state.crLimit >= 12}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        crLimit: Math.min(12, prev.crLimit + 1),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
                <span className="cr-plan-note">
                  Default 8 · max 12 · summers always capped at 2
                </span>
              </div>
            </div>

            <div className="legend">
              <div className="leg-item">
                <div className="leg-dot" style={{ background: 'var(--red)' }} />
                Required core
              </div>
              <div className="leg-item">
                <div className="leg-dot" style={{ background: '#333' }} />
                Org. behavior
              </div>
              <div className="leg-item">
                <div className="leg-dot" style={{ background: '#555' }} />
                Elective
              </div>
              <div className="leg-item">
                <div className="leg-dot" style={{ background: '#999' }} />
                Residential / PD
              </div>
            </div>

            {(takenCourses.length > 0 || state.customTaken.length > 0) && (
              <div className="sem-block">
                <div className="sem-hdr">
                  <span className="sem-pill completed-pill">✓ Completed</span>
                  <span className="sem-cr">{credits.takenCredits} credits</span>
                </div>
                <div className="sem-body" style={{ borderLeftColor: '#bbb' }}>
                  {takenCourses.map((course) => (
                    <PlanCard
                      key={course.id}
                      course={course}
                      expanded={planExpanded.has(course.id)}
                      onToggle={() => togglePlanExpanded(course.id)}
                    />
                  ))}
                  {state.customTaken.map((course) => {
                    const asCourse: Course = {
                      id: course.id,
                      code: course.code,
                      name: course.name,
                      credits: course.credits,
                      seasons: [],
                      prereqs: [],
                      cat: 'el',
                      pri: 4,
                      desc: 'Custom completed course (removed from current curriculum).',
                      notes: 'Added manually from your transcript.',
                    }
                    return (
                      <PlanCard
                        key={course.id}
                        course={asCourse}
                        expanded={planExpanded.has(course.id)}
                        onToggle={() => togglePlanExpanded(course.id)}
                      />
                    )
                  })}
                </div>
                {plan.sems.length > 0 && <div className="divider" />}
              </div>
            )}

            {plan.sems.map((sem) => {
              const semPlan = plan.plan[sem.code]
              if (!semPlan || semPlan.courses.length === 0) return null
              const borderClass = `${seasonKey(sem.season)}-border`
              const pillClass = seasonKey(sem.season)
              return (
                <div key={sem.code} className="sem-block">
                  <div className="sem-hdr">
                    <span className={`sem-pill ${pillClass}`}>{sem.label}</span>
                    <span className="sem-cr">
                      {semPlan.cr} credit{semPlan.cr !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={`sem-body ${borderClass}`}>
                    {semPlan.courses.map((course) => (
                      <PlanCard
                        key={course.id}
                        course={course}
                        expanded={planExpanded.has(`${sem.code}-${course.id}`)}
                        onToggle={() => togglePlanExpanded(`${sem.code}-${course.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {takenCourses.length === 0 &&
              state.customTaken.length === 0 &&
              plan.sems.every((sem) => !plan.plan[sem.code]?.courses.length) && (
                <div className="empty">
                  No courses to display. Complete the previous steps to build your
                  plan.
                </div>
              )}
          </section>
        )}
      </main>

      <div className="abar">
        <div className="abar-in">
          <button
            className="btn btn-ghost"
            style={{ visibility: state.step > 1 ? 'visible' : 'hidden' }}
            onClick={goBack}
          >
            ← Back
          </button>
          {state.step === 4 ? (
            <button
              className="btn btn-primary"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Recalculate →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={goNext}>
              Continue →
            </button>
          )}
        </div>
      </div>
    </>
  )
}
