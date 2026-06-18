import { useMemo, useState } from 'react'
import { CourseListItem, PlanCard } from './components/CourseItems'
import {
  ALL_COURSES,
  EL,
  OB,
  PD1,
  PD2,
  REQ,
  RES2,
  seasonKey,
} from './data/courses'
import { relevantSemesters, semIdx } from './data/semesters'
import { exportProposalExcel } from './lib/excelExport'
import { generatePlan, getCreditTotals } from './lib/planEngine'
import { ADVISORS, DEFAULT_STATE, type PlannerState } from './types'
import './App.css'

function toPlannerState(state: AppState): PlannerState {
  return {
    ...state,
    taken: new Set(state.taken),
    elChoices: new Set(state.elChoices),
  }
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
}

const STEPS = ['Timeline', 'Courses Taken', 'Your Choices', 'Your Plan']

function CourseList({
  courses,
  inputType,
  name,
  selected,
  onToggle,
  expanded,
  onExpand,
}: {
  courses: typeof ALL_COURSES
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
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [planExpanded, setPlanExpanded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const planner = useMemo(() => toPlannerState(state), [state])
  const plan = useMemo(() => generatePlan(planner), [planner])
  const credits = useMemo(() => getCreditTotals(planner), [planner])
  const semesterOptions = relevantSemesters()

  const takenSet = useMemo(() => new Set(state.taken), [state.taken])
  const elSet = useMemo(() => new Set(state.elChoices), [state.elChoices])

  const takenOB = OB.filter((course) => takenSet.has(course.id))
  const takenElCount = EL.filter((course) => takenSet.has(course.id)).length
  const hasRes2 = takenSet.has('EN6002')
  const hasPDs = takenSet.has('EN6011') && takenSet.has('EN6012')

  const filteredElectives = EL.filter((course) => {
    if (takenSet.has(course.id)) return false
    if (state.obChoice === 'EN5300' && course.id === 'EN5300el') return false
    if (state.obChoice === 'EN6030' && course.id === 'EN6030el') return false
    return true
  })

  const takenCourses = ALL_COURSES.filter((course) => takenSet.has(course.id))
  const pct = Math.min(100, Math.round((credits.total / 30) * 100))

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
      const elOk = takenElCount + state.elChoices.length >= 2
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
      await exportProposalExcel(planner)
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
        <span className="hdr-word">Cornell Engineering</span>
        <span className="hdr-sep">|</span>
        <span className="hdr-app">M.Eng. Management · Course Planner</span>
      </header>

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
                Specialization Electives — select at least 2 total
              </div>
              <div className="info-row" style={{ marginBottom: 12 }}>
                <span className="info-icon">📚</span>
                <span>
                  {takenElCount >= 2
                    ? `You've already completed ${takenElCount} elective(s) — you're at the minimum. Feel free to add more below.`
                    : takenElCount > 0
                      ? `You've completed ${takenElCount} elective(s). Select at least ${2 - takenElCount} more below.`
                      : 'Select at least 2 electives to include in your degree plan.'}
                </span>
              </div>
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
                      Take ENMGT 6011 + ENMGT 6012 instead of the residential
                      session.
                    </div>
                    <div className="res-opt-cr">0.5 + 0.5 credits · Fall or Spring</div>
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

            {takenCourses.length > 0 && (
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
