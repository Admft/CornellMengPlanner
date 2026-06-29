const STORAGE_KEY = 'mem-planner-drag-coach-seen'

export function hasSeenDragCoach(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markDragCoachSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

interface DemoCourse {
  id: string
  code: string
  credits: number
}

interface DemoLayout {
  fall2026: DemoCourse[]
  fall2027: DemoCourse[]
}

const INITIAL_DEMO: DemoLayout = {
  fall2026: [{ id: 'demo-a', code: 'ENMGT 5900', credits: 4 }],
  fall2027: [{ id: 'demo-b', code: 'ENMGT 5930', credits: 3 }],
}

export { INITIAL_DEMO }
export type { DemoCourse, DemoLayout }
