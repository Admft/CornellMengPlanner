import { useEffect, useRef } from 'react'
import { resolveCourse } from '../lib/planEngine'
import type { CurriculumCatalog, Semester } from '../types'

export interface PendingSwap {
  courseAId: string
  semCodeA: string
  courseBId: string
  semCodeB: string
}

interface SwapConfirmDialogProps {
  pending: PendingSwap | null
  sems: Semester[]
  curriculum: CurriculumCatalog
  onConfirm: () => void
  onCancel: () => void
}

export function SwapConfirmDialog({
  pending,
  sems,
  curriculum,
  onConfirm,
  onCancel,
}: SwapConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) dialog.showModal()
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  if (!pending) return null

  const courseA = resolveCourse(pending.courseAId, curriculum)
  const courseB = resolveCourse(pending.courseBId, curriculum)
  const semA = sems.find((s) => s.code === pending.semCodeA)
  const semB = sems.find((s) => s.code === pending.semCodeB)
  if (!courseA || !courseB || !semA || !semB) return null

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog swap-confirm-dialog"
      onClose={onCancel}
      aria-labelledby="swap-confirm-title"
    >
      <div className="app-dialog-inner">
        <h2 id="swap-confirm-title" className="req-title">
          Swap these courses?
        </h2>
        <p className="req-sub swap-confirm-sub">
          Each course moves to the other semester. Credit limits and prerequisites
          stay valid.
        </p>

        <div className="swap-confirm-grid">
          <div className="swap-confirm-card">
            <span className="swap-confirm-sem">{semA.label}</span>
            <strong>{courseA.code}</strong>
            <span className="swap-confirm-name">{courseA.name}</span>
          </div>
          <div className="swap-confirm-arrow" aria-hidden>
            ⇄
          </div>
          <div className="swap-confirm-card">
            <span className="swap-confirm-sem">{semB.label}</span>
            <strong>{courseB.code}</strong>
            <span className="swap-confirm-name">{courseB.name}</span>
          </div>
        </div>

        <div className="swap-confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Swap courses
          </button>
        </div>
      </div>
    </dialog>
  )
}
