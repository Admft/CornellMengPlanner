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
    <div className={`citem ${expanded ? 'xpd' : ''}`}>
      <div
        className="ci-hdr"
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.matches('input, select, option')) return
          if (target.closest('.ci-export-row')) return
          onToggle()
        }}
      >
        <input
          type={inputType}
          className={inputType === 'checkbox' ? 'ci-cb' : 'ci-rb'}
          name={name}
          value={course.id}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="ci-code">{course.code}</span>
        <span className="ci-name">{course.name}</span>
        {course.legacy && <span className="legacy-pill">previous curriculum</span>}
        {hasPrereqs && <span className="prereq-pill">prereqs req.</span>}
        <span className="ci-season">{course.seasons.join(' / ')}</span>
        <span className="ci-cr">{course.credits} cr</span>
        <span className="ci-chev">▼</span>
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
        onPointerDown={onDragPointerDown}
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
        <p>{course.desc}</p>
        <p>{course.notes}</p>
        {course.prereqs.length > 0 && (
          <p className="ci-prereq">Prerequisites: {course.prereqs.join(', ')}</p>
        )}
      </div>
    </div>
  )
}
