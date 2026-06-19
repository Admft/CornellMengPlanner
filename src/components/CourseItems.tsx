import type { Course } from '../types'

interface CourseListItemProps {
  course: Course
  inputType: 'checkbox' | 'radio'
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  expanded: boolean
  onToggle: () => void
}

export function CourseListItem({
  course,
  inputType,
  name,
  checked,
  onChange,
  expanded,
  onToggle,
}: CourseListItemProps) {
  const hasPrereqs = course.prereqs.length > 0

  return (
    <div className={`citem ${expanded ? 'xpd' : ''}`}>
      <div
        className="ci-hdr"
        onClick={(event) => {
          if ((event.target as HTMLElement).matches('input')) return
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
  expanded: boolean
  onToggle: () => void
}

export function PlanCard({ course, expanded, onToggle }: PlanCardProps) {
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
    <div className={`pc ${catClass} ${expanded ? 'xpd' : ''}`}>
      <div className="pc-hdr" onClick={onToggle}>
        <span className="pc-code">{course.code}</span>
        <span className="pc-name">{course.name}</span>
        <span className={`pc-tag ${tagClass}`}>{tagLabel}</span>
        <span className="pc-cr">{course.credits} cr</span>
        <span className="pc-chev">▼</span>
      </div>
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
