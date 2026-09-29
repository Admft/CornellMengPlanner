import type { Course, Semester } from '../types'
import type { MutableRefObject } from 'react'

interface CourseListItemProps {
  course: Course
  inputType: 'checkbox' | 'radio'
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  expanded: boolean
  onToggle: () => void
  takenSem?: string
  takenSemOptions?: Semester[]
  onTakenSemChange?: (semCode: string) => void
}

export function CourseListItem({
  course,
  inputType,
  name,
  checked,
  onChange,
  expanded,
  onToggle,
  takenSem,
  takenSemOptions,
  onTakenSemChange,
}: CourseListItemProps) {
  const hasPrereqs = course.prereqs.length > 0

  return (
    <div className={`citem ${expanded ? 'xpd' : ''} ${checked ? 'selected' : ''}`}>
      <div className="ci-hdr">
        <label className="ci-selection">
          <input type={inputType} className={inputType === 'checkbox' ? 'ci-cb' : 'ci-rb'}
            name={name} value={course.id} checked={checked}
            aria-label={`${course.code}: ${course.name}`}
            onChange={event => onChange(event.target.checked)} />
          <span className="ci-title"><span className="ci-code">{course.code}</span><span className="ci-name">{course.name}</span></span>
        </label>
        <span className="ci-metadata"><span className="ci-season">{course.seasons.join(' / ')}</span><span className="ci-cr">{course.credits} cr</span></span>
        <button type="button" className="course-expand" aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${course.code}`} onClick={onToggle}>
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
      </div>
      {checked && onTakenSemChange && takenSemOptions && takenSemOptions.length > 0 && (
        <div
          className="ci-export-row"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ci-export-sem-copy">
            <span className="ci-export-sem-lbl">Which semester did you take this?</span>
            <span className="ci-export-sem-hint">
              Optional — only used when you download the Excel proposal. Leave on skip if
              you&apos;re just planning.
            </span>
          </div>
          <select
            className="ci-export-sem-select"
            value={takenSem ?? ''}
            onChange={(e) => onTakenSemChange(e.target.value)}
            aria-label={`Which semester you took ${course.code} — optional, for Excel export only`}
          >
            <option value="">Skip</option>
            {takenSemOptions.map((sem) => (
              <option key={sem.code} value={sem.code}>
                {sem.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="ci-body">
        {course.legacy && <span className="legacy-pill">Previous curriculum</span>}
        <p className="ci-desc">{course.desc}</p>
        <p className="ci-notes">{course.notes}</p>
        {hasPrereqs && (
          <p className="ci-prereq">Prerequisites: {course.prereqs.join(', ')}</p>
        )}
      </div>
    </div>
  )
}

interface PlanCardProps {
  course: Course
  semCode?: string
  expanded: boolean
  onToggle: () => void
  onDragPointerDown?: (e: React.PointerEvent) => void
  skipToggleRef?: MutableRefObject<boolean>
  isDragging?: boolean
  coachPulse?: boolean
  swapAvailable?: boolean
  swapHover?: boolean
  swapInvalid?: boolean
  swapStrip?: string
  showSwapChip?: boolean
  moveTargets?: { code: string; label: string }[]
  onMove?: (semCode: string) => void
}

export function PlanInsertSlot({
  semCode,
  index,
  visible,
  active,
}: {
  semCode: string
  index: number
  visible: boolean
  active: boolean
}) {
  if (!visible) {
    return <div className="plan-insert-slot plan-insert-slot-idle" aria-hidden />
  }

  return (
    <div
      className={`plan-insert-slot plan-insert-slot-visible ${active ? 'plan-insert-slot-active' : ''}`}
      data-insert-sem={semCode}
      data-insert-index={index}
      role="presentation"
    >
      <div className="plan-insert-slot-inner">
        <span className="plan-insert-slot-icon">+</span>
        <span className="plan-insert-slot-label">Add here</span>
      </div>
    </div>
  )
}

export function PlanCard({
  course,
  semCode,
  expanded,
  onToggle,
  onDragPointerDown,
  skipToggleRef,
  isDragging = false,
  coachPulse = false,
  swapAvailable = false,
  swapHover = false,
  swapInvalid = false,
  swapStrip,
  showSwapChip = false,
  moveTargets,
  onMove,
}: PlanCardProps) {
  const catClass =
    course.cat === 'req' || course.cat === 'cap'
      ? 'cat-req'
      : course.cat === 'org'
        ? 'cat-org'
        : course.cat === 'res'
          ? 'cat-res'
          : 'cat-el'

  const tagClass =
    course.cat === 'req' || course.cat === 'cap'
      ? 'req'
      : course.cat === 'org'
        ? 'org'
        : course.cat === 'res'
          ? 'res'
          : 'el'

  const tagLabel =
    course.cat === 'req'
      ? 'Core'
      : course.cat === 'cap'
        ? 'Capstone'
        : course.cat === 'org'
          ? 'Org. Behavior'
          : course.cat === 'res'
            ? 'Residential'
            : 'Elective'

  return (
    <div
      className={`pc ${catClass} ${expanded ? 'xpd' : ''} ${isDragging ? 'pc-dragging' : ''} ${onDragPointerDown ? 'pc-draggable' : ''} ${swapHover ? (swapInvalid ? 'pc-swap-invalid' : 'pc-swap-hover') : swapAvailable ? 'pc-swap-available' : ''} ${coachPulse && onDragPointerDown ? 'pc-coach-pulse' : ''}`}
      data-swap-course={semCode ? course.id : undefined}
      data-swap-sem={semCode}
    >
      <div
        className="pc-hdr"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${course.code}: ${course.name}, ${course.credits} credits. ${expanded ? 'Hide' : 'Show'} details`}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }}
        onPointerDown={event => {
          if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.pc-drag')) return
          onDragPointerDown?.(event)
        }}
        onClick={() => {
          if (skipToggleRef?.current) {
            skipToggleRef.current = false
            return
          }
          onToggle()
        }}
      >
        {onDragPointerDown && (
          <span className="pc-drag" title="Drag to move or swap" aria-hidden>
            ⠿
          </span>
        )}
        <span className="pc-code">{course.code}</span>
        <span className="pc-name">{course.name}</span>
        <span className={`pc-tag ${tagClass}`}>{tagLabel}</span>
        <span className="pc-cr">{course.credits} cr</span>
        {showSwapChip && (
          <span className="pc-swap-chip" title="Valid swap target">
            ⇄
          </span>
        )}
        <span className="pc-chev">▼</span>
      </div>
      {swapStrip && (
        <div className={`pc-swap-strip ${swapInvalid ? 'pc-swap-strip-warn' : ''}`}>
          {swapStrip}
        </div>
      )}
      <div className="pc-body">
        {onMove && moveTargets && <label className="course-move-label">
          Move to semester
          <select aria-label={`Move ${course.code} to semester`} value={semCode} onChange={event => onMove(event.target.value)}>
            {moveTargets.map(semester => <option key={semester.code} value={semester.code}>{semester.label}</option>)}
          </select>
          <small>Only semesters that fit the course rules and your credit limit are listed.</small>
        </label>}
        <p>{course.desc}</p>
        <p>{course.notes}</p>
        {course.prereqs.length > 0 && (
          <p className="ci-prereq">Prerequisites: {course.prereqs.join(', ')}</p>
        )}
      </div>
    </div>
  )
}
