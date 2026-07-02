import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { seasonKey } from '../data/courses'
import { resolveCourse } from '../lib/planEngine'
import {
  canPlaceCourse,
  canSwapCourses,
  moveCourseInLayout,
  swapCoursesInLayout,
  validMoveSemesters,
  validSwapTargets,
} from '../lib/planLayout'
import type { CurriculumCatalog, GeneratedPlan, PlannerState } from '../types'
import { PlanCard, PlanInsertSlot } from './CourseItems'

export type PlanDragPayload = {
  courseId: string
  fromSem: string
}

type DragHover =
  | { kind: 'insert'; semCode: string; index: number }
  | { kind: 'swap'; semCode: string; courseId: string; targetCode: string }
  | null

interface PlanDragSurfaceProps {
  plan: GeneratedPlan
  planner: PlannerState
  curriculum: CurriculumCatalog
  layout: Record<string, string[]>
  onLayoutChange: (layout: Record<string, string[]>) => void
  planExpanded: Set<string>
  onToggleExpanded: (key: string) => void
  coachPulse?: boolean
  onFeedback: (message: string, tone?: 'ok' | 'warn') => void
}

function hitTest(
  x: number,
  y: number,
): { insert?: { semCode: string; index: number }; swap?: { semCode: string; courseId: string } } {
  const elements = document.elementsFromPoint(x, y)

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue
    const swap = el.closest<HTMLElement>('[data-swap-course]')
    if (swap?.dataset.swapCourse && swap.dataset.swapSem) {
      return {
        swap: {
          courseId: swap.dataset.swapCourse,
          semCode: swap.dataset.swapSem,
        },
      }
    }
  }

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue
    const insert = el.closest<HTMLElement>('[data-insert-sem]')
    if (insert?.dataset.insertSem) {
      const index = Number(insert.dataset.insertIndex ?? '0')
      return { insert: { semCode: insert.dataset.insertSem, index } }
    }
  }

  return {}
}

const DRAG_THRESHOLD_PX = 6

export default function PlanDragSurface({
  plan,
  planner,
  curriculum,
  layout,
  onLayoutChange,
  planExpanded,
  onToggleExpanded,
  coachPulse = false,
  onFeedback,
}: PlanDragSurfaceProps) {
  const [drag, setDrag] = useState<PlanDragPayload | null>(null)
  const dragRef = useRef<PlanDragPayload | null>(null)
  const pendingRef = useRef<
    (PlanDragPayload & { startX: number; startY: number }) | null
  >(null)
  const skipToggleRef = useRef(false)
  const [hover, setHover] = useState<DragHover>(null)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)

  const validMoveSems = useMemo(() => {
    if (!drag) return new Set<string>()
    const course = resolveCourse(drag.courseId, curriculum)
    if (!course) return new Set<string>()
    return validMoveSemesters(course, drag.fromSem, plan.sems, plan, planner)
  }, [drag, plan, planner, curriculum])

  const draggedCourse = drag ? resolveCourse(drag.courseId, curriculum) : undefined

  const validSwapKeys = useMemo(() => {
    if (!drag || !draggedCourse) return new Set<string>()
    return validSwapTargets(draggedCourse, drag.fromSem, plan.sems, layout, planner)
  }, [drag, draggedCourse, plan.sems, layout, planner])

  const swapPartnerLabels = useMemo(() => {
    if (!drag || validSwapKeys.size === 0) return []
    const labels: { code: string; semLabel: string }[] = []
    for (const sem of plan.sems) {
      for (const id of layout[sem.code] ?? []) {
        const key = `${sem.code}:${id}`
        if (!validSwapKeys.has(key) || id === drag.courseId) continue
        const course = resolveCourse(id, curriculum)
        if (course) labels.push({ code: course.code, semLabel: sem.label })
      }
    }
    return labels
  }, [drag, validSwapKeys, plan.sems, layout, curriculum])

  const canSwapWith = useCallback(
    (targetCourseId: string, targetSemCode: string) => {
      if (!drag || !draggedCourse) return { ok: false as const, reason: '' }
      if (drag.fromSem === targetSemCode || drag.courseId === targetCourseId) {
        return { ok: false as const, reason: '' }
      }
      const other = resolveCourse(targetCourseId, curriculum)
      if (!other) return { ok: false as const, reason: '' }
      return canSwapCourses(
        draggedCourse,
        drag.fromSem,
        other,
        targetSemCode,
        plan.sems,
        layout,
        planner,
      )
    },
    [drag, draggedCourse, curriculum, plan.sems, layout, planner],
  )

  const finishDrag = useCallback(() => {
    dragRef.current = null
    pendingRef.current = null
    setDrag(null)
    setHover(null)
    setGhostPos(null)
  }, [])

  const applyMove = useCallback(
    (targetSemCode: string, index: number) => {
      const active = dragRef.current
      if (!active) return
      const course = resolveCourse(active.courseId, curriculum)
      if (!course) return

      const moveCheck = canPlaceCourse(
        course,
        plan.sems.find((s) => s.code === targetSemCode)!,
        plan.sems,
        plan.plan,
        planner,
        { excludeCourseId: active.courseId, fromSemCode: active.fromSem },
      )
      if (!moveCheck.ok) {
        onFeedback(moveCheck.reason, 'warn')
        return
      }

      onLayoutChange(
        moveCourseInLayout(layout, active.courseId, active.fromSem, targetSemCode, index),
      )
      onFeedback(`Moved ${course.code}.`, 'ok')
      finishDrag()
    },
    [curriculum, plan, planner, layout, onLayoutChange, onFeedback, finishDrag],
  )

  const applySwap = useCallback(
    (targetCourseId: string, targetSemCode: string) => {
      const active = dragRef.current
      if (!active) return
      const courseA = resolveCourse(active.courseId, curriculum)
      const courseB = resolveCourse(targetCourseId, curriculum)
      if (!courseA || !courseB) return

      const check = canSwapCourses(
        courseA,
        active.fromSem,
        courseB,
        targetSemCode,
        plan.sems,
        layout,
        planner,
      )
      if (!check.ok) {
        onFeedback(check.reason, 'warn')
        return
      }

      onLayoutChange(
        swapCoursesInLayout(
          layout,
          active.courseId,
          active.fromSem,
          targetCourseId,
          targetSemCode,
        ),
      )
      onFeedback(`Swapped ${courseA.code} ↔ ${courseB.code}.`, 'ok')
      finishDrag()
    },
    [curriculum, plan.sems, layout, planner, onLayoutChange, onFeedback, finishDrag],
  )

  useEffect(() => {
    if (!drag) return
    document.body.classList.add('plan-is-dragging')
    return () => document.body.classList.remove('plan-is-dragging')
  }, [drag])

  useEffect(() => {
    function activateDrag(payload: PlanDragPayload, x: number, y: number) {
      dragRef.current = payload
      setDrag(payload)
      setGhostPos({ x, y })
      setHover(null)
      skipToggleRef.current = true
      onFeedback('', 'ok')
    }

    function onPointerMove(e: PointerEvent) {
      if (pendingRef.current && !dragRef.current) {
        const p = pendingRef.current
        const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY)
        if (dist >= DRAG_THRESHOLD_PX) {
          pendingRef.current = null
          activateDrag({ courseId: p.courseId, fromSem: p.fromSem }, e.clientX, e.clientY)
        }
        return
      }

      if (!dragRef.current) return

      setGhostPos({ x: e.clientX, y: e.clientY })
      const hit = hitTest(e.clientX, e.clientY)
      const active = dragRef.current

      if (hit.swap && hit.swap.semCode !== active.fromSem) {
        const other = resolveCourse(hit.swap.courseId, curriculum)
        if (other && hit.swap.courseId !== active.courseId) {
          setHover({
            kind: 'swap',
            semCode: hit.swap.semCode,
            courseId: hit.swap.courseId,
            targetCode: other.code,
          })
          return
        }
      }

      if (hit.insert && hit.insert.semCode !== active.fromSem && validMoveSems.has(hit.insert.semCode)) {
        setHover({
          kind: 'insert',
          semCode: hit.insert.semCode,
          index: hit.insert.index,
        })
        return
      }

      setHover(null)
    }

    function onPointerUp(e: PointerEvent) {
      if (pendingRef.current && !dragRef.current) {
        pendingRef.current = null
        return
      }

      const hit = hitTest(e.clientX, e.clientY)
      const active = dragRef.current
      if (!active) {
        finishDrag()
        return
      }

      if (hit.swap && hit.swap.semCode !== active.fromSem && hit.swap.courseId !== active.courseId) {
        applySwap(hit.swap.courseId, hit.swap.semCode)
        return
      }

      if (hit.insert && hit.insert.semCode !== active.fromSem) {
        applyMove(hit.insert.semCode, hit.insert.index)
        return
      }

      finishDrag()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') finishDrag()
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [curriculum, validMoveSems, applyMove, applySwap, finishDrag, onFeedback])

  function prepareDrag(courseId: string, fromSem: string, e: React.PointerEvent) {
    e.stopPropagation()
    skipToggleRef.current = false
    pendingRef.current = {
      courseId,
      fromSem,
      startX: e.clientX,
      startY: e.clientY,
    }
  }

  return (
    <>
      {drag && draggedCourse && ghostPos && (
        <div
          className="plan-drag-ghost"
          style={{ left: ghostPos.x, top: ghostPos.y }}
          aria-hidden
        >
          <span className="plan-drag-ghost-code">{draggedCourse.code}</span>
          <span className="plan-drag-ghost-cr">{draggedCourse.credits} cr</span>
        </div>
      )}

      {drag && draggedCourse && swapPartnerLabels.length > 0 && (
        <div className="plan-swap-partners-bar">
          <span className="plan-swap-partners-lbl">Can swap {draggedCourse.code} with</span>
          <span className="plan-swap-partners-list">
            {swapPartnerLabels
              .map((p) => `${p.code} (${p.semLabel})`)
              .join(', ')}
          </span>
        </div>
      )}

      {hover?.kind === 'swap' && draggedCourse && (
        <div className="plan-drag-feedback plan-drag-feedback-floating">
          <div className="alert alert-ok plan-swap-hint">
            <span className="alert-icon">⇄</span>
            <div>
              <strong>Release to swap</strong> {draggedCourse.code} with {hover.targetCode}
            </div>
          </div>
        </div>
      )}

      {hover?.kind === 'insert' && draggedCourse && (
        <div className="plan-drag-feedback plan-drag-feedback-floating">
          <div className="alert alert-ok plan-insert-hint">
            <span className="alert-icon">+</span>
            <div>
              <strong>Release to add</strong> {draggedCourse.code} here
            </div>
          </div>
        </div>
      )}

      {plan.sems.map((sem) => {
        const semPlan = plan.plan[sem.code]
        if (!semPlan || semPlan.courses.length === 0) return null
        const borderClass = `${seasonKey(sem.season)}-border`
        const pillClass = seasonKey(sem.season)
        const canMoveHere =
          !!drag && drag.fromSem !== sem.code && validMoveSems.has(sem.code)
        const isInvalid =
          !!drag && drag.fromSem !== sem.code && !validMoveSems.has(sem.code)

        return (
          <div key={sem.code} className="sem-block">
            <div className="sem-hdr">
              <span className={`sem-pill ${pillClass}`}>{sem.label}</span>
              <span className="sem-cr">
                {semPlan.cr} credit{semPlan.cr !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              className={`sem-body sem-body-drag ${borderClass} ${canMoveHere ? 'sem-drop-valid' : ''} ${isInvalid ? 'sem-drop-invalid' : ''}`}
            >
              {semPlan.courses.map((course) => {
                const swapKey = `${sem.code}:${course.id}`
                const swapAvailable = validSwapKeys.has(swapKey)
                const swapCheck = drag ? canSwapWith(course.id, sem.code) : { ok: false, reason: '' }
                const swapHover =
                  hover?.kind === 'swap' &&
                  hover.semCode === sem.code &&
                  hover.courseId === course.id
                const swapInvalid = swapHover && !swapCheck.ok
                return (
                  <PlanCard
                    key={course.id}
                    course={course}
                    semCode={sem.code}
                    expanded={planExpanded.has(`${sem.code}-${course.id}`)}
                    onToggle={() => onToggleExpanded(`${sem.code}-${course.id}`)}
                    isDragging={drag?.courseId === course.id && drag.fromSem === sem.code}
                    coachPulse={coachPulse}
                    swapAvailable={swapAvailable}
                    swapHover={swapHover}
                    swapInvalid={swapInvalid}
                    showSwapChip={swapAvailable && !swapHover}
                    swapStrip={
                      swapHover
                        ? swapCheck.ok
                          ? `Release to swap with ${draggedCourse?.code ?? 'course'}`
                          : swapCheck.reason || "Can't swap"
                        : undefined
                    }
                    onDragPointerDown={(e) => prepareDrag(course.id, sem.code, e)}
                    skipToggleRef={skipToggleRef}
                  />
                )
              })}
              <PlanInsertSlot
                semCode={sem.code}
                index={semPlan.courses.length}
                visible={canMoveHere}
                active={
                  hover?.kind === 'insert' &&
                  hover.semCode === sem.code &&
                  hover.index === semPlan.courses.length
                }
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
