import { useEffect, useRef, useState } from 'react'
import {
  INITIAL_DEMO,
  markDragCoachSeen,
  type DemoCourse,
  type DemoLayout,
} from '../lib/dragCoach'

interface PlanDragCoachProps {
  open: boolean
  onClose: () => void
}

function isSwapped(layout: DemoLayout): boolean {
  const a = layout.fall2026[0]?.id
  const b = layout.fall2027[0]?.id
  return a === 'demo-b' && b === 'demo-a'
}

export default function PlanDragCoach({ open, onClose }: PlanDragCoachProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [layout, setLayout] = useState<DemoLayout>(INITIAL_DEMO)
  const [drag, setDrag] = useState<{ courseId: string; from: keyof DemoLayout } | null>(
    null,
  )
  const [tried, setTried] = useState(false)
  const swapped = isSwapped(layout)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setLayout({
        fall2026: [...INITIAL_DEMO.fall2026],
        fall2027: [...INITIAL_DEMO.fall2027],
      })
      setDrag(null)
      setTried(false)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  function finish() {
    markDragCoachSeen()
    onClose()
  }

  function swapCourses(
    courseA: DemoCourse,
    from: keyof DemoLayout,
    courseB: DemoCourse,
    to: keyof DemoLayout,
  ) {
    setLayout({
      ...layout,
      [from]: layout[from].map((c) => (c.id === courseA.id ? courseB : c)),
      [to]: layout[to].map((c) => (c.id === courseB.id ? courseA : c)),
    })
    setTried(true)
    setDrag(null)
  }

  function handleDropOnCourse(
    target: DemoCourse,
    targetCol: keyof DemoLayout,
  ) {
    if (!drag || drag.from === targetCol) return
    const dragged = layout[drag.from].find((c) => c.id === drag.courseId)
    if (!dragged || dragged.id === target.id) return
    swapCourses(dragged, drag.from, target, targetCol)
  }

  function handleDropOnColumn(col: keyof DemoLayout) {
    if (!drag || drag.from === col) return
    const dragged = layout[drag.from].find((c) => c.id === drag.courseId)
    if (!dragged) return
    const next: DemoLayout = {
      fall2026: layout.fall2026.filter((c) => c.id !== dragged.id),
      fall2027: layout.fall2027.filter((c) => c.id !== dragged.id),
    }
    next[col] = [...next[col], dragged]
    setLayout(next)
    setTried(true)
    setDrag(null)
  }

  function renderColumn(key: keyof DemoLayout, label: string) {
    const courses = layout[key]
    const canReceive =
      drag &&
      drag.from !== key &&
      (courses.length === 0 || drag.from !== key)

    return (
      <div className="drag-coach-col">
        <div className="drag-coach-col-hdr">
          <span>{label}</span>
          <span className="drag-coach-col-cr">
            {courses.reduce((s, c) => s + c.credits, 0)} cr
          </span>
        </div>
        <div
          className={`drag-coach-col-body ${canReceive ? 'drag-coach-col-ready' : ''}`}
          onDragOver={(e) => {
            if (!drag || drag.from === key) return
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (courses.length === 0) handleDropOnColumn(key)
          }}
        >
          {courses.map((course) => {
            const swapReady =
              !!drag && drag.from !== key && drag.courseId !== course.id
            return (
              <div
                key={course.id}
                className={`drag-coach-chip ${drag?.courseId === course.id ? 'drag-coach-chip-active' : ''} ${swapReady ? 'drag-coach-chip-swap' : ''}`}
                draggable
                onDragStart={() => setDrag({ courseId: course.id, from: key })}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => {
                  if (!swapReady) return
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (swapReady) handleDropOnCourse(course, key)
                }}
              >
                <span className="drag-coach-chip-grip" aria-hidden>
                  ⠿
                </span>
                <span className="drag-coach-chip-code">{course.code}</span>
                <span className="drag-coach-chip-cr">{course.credits} cr</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog drag-coach-dialog"
      onClose={finish}
      aria-labelledby="drag-coach-title"
    >
      <div className="app-dialog-inner drag-coach-modal">
        <div className="req-hdr">
          <div>
            <h2 id="drag-coach-title" className="req-title">
              Try dragging your plan
            </h2>
            <p className="req-sub">
              Your real schedule works the same way. Use the practice board below, then
              tweak your semesters.
            </p>
          </div>
          <button
            type="button"
            className="req-close"
            onClick={finish}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <ol className="drag-coach-steps">
          <li>
            <strong>Drag</strong> the ⠿ handle to move a course to another semester.
          </li>
          <li>
            <strong>Drop on another course</strong> to swap when both terms are full.
          </li>
        </ol>

        <div className="drag-coach-demo">
          <p className="drag-coach-demo-lbl">Practice — swap these two courses:</p>
          {renderColumn('fall2026', 'Fall 2026')}
          {renderColumn('fall2027', 'Fall 2027')}
        </div>

        {swapped ? (
          <div className="drag-coach-success">
            <span className="drag-coach-success-icon">✓</span>
            Nice — that&apos;s a swap. Your plan cards work exactly like this.
          </div>
        ) : (
          <p className="drag-coach-hint">
            {tried
              ? 'Drop onto the other course (not empty space) to swap semesters.'
              : 'Drag ENMGT 5900 onto ENMGT 5930 to try a swap.'}
          </p>
        )}

        <div className="drag-coach-actions">
          <button type="button" className="btn btn-primary" onClick={finish}>
            {swapped ? 'Got it — edit my plan' : 'Start editing my plan'}
          </button>
          {!swapped && (
            <button type="button" className="btn btn-secondary" onClick={finish}>
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
