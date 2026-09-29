export interface ChangelogSection {
  title: string
  items: string[]
}

export interface ChangelogRelease {
  /** ISO date — also used as the version id (e.g. 2026-06-29). */
  version: string
  label: string
  summary: string
  sections: ChangelogSection[]
}

/** Bump this date when you ship user-visible changes; drives the “what’s new” banner. */
export const LATEST_VERSION = '2026-09-29'

const SEEN_STORAGE_KEY = 'mem-planner-changelog-seen'

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: LATEST_VERSION,
    label: 'September 29, 2026',
    summary: 'A redesigned planner, smarter semester scheduling, updated DL capstone guidance, and corrected Excel proposals.',
    sections: [
      {
        title: 'A clearer planning experience',
        items: [
          'New Cornell red design, step navigation, and layouts for desktop and phones.',
          'Search courses by name, code, or season; open course details separately from selecting a course.',
          'Review semesters side by side on desktop and in a single column on phones.',
          'Move courses with drag-and-drop or choose a valid semester from the course details.',
        ],
      },
      {
        title: 'Smarter schedules',
        items: [
          'The planner searches alternative arrangements and earlier completion dates within your graduation target, instead of relying only on filling semesters in order.',
          'Elective selection considers semester availability as well as credits, using only the electives you selected.',
          'Seasonal offerings repeat annually for planning unless an explicit course update limits availability.',
          'Moves and swaps check the resulting schedule against course offerings, credit limits, and applicable prerequisites.',
          'Warnings distinguish selected but unscheduled credits from additional credits you still need. The bounded search does not guarantee an optimal solution for every plan.',
        ],
      },
      {
        title: 'Updated Distance Learning guidance',
        items: [
          'The capstone may be taken alongside other courses. The DL program recommends the last or second-to-last semester and suggests Project Management beforehand; these are recommendations rather than scheduling blocks.',
          'Removed the older capstone prerequisite and final-semester-only restrictions following clarification from the DL program.',
          'Current Data Analytics is 3 credits; completed legacy coursework retains its original credits. Completed Economics and Finance satisfies the replacement economics courses.',
          'Applied AI for Technical Teams is optional for returning students who matriculated before Summer 2026, excluding early admits. Select returning-student status in the timeline step when applicable.',
          'Professional Development uses ENMGT 6010 in Fall and ENMGT 6011 in Spring. Managing a Culture of Innovation can count as Organizational Behavior or an elective, once.',
        ],
      },
      {
        title: 'Excel proposal fixes',
        items: [
          'Exports use actual semester headings and place credits in the correct course sections, including legacy and custom completed courses.',
          'Corrected totals, recalculating formulas, and seasonal cell formatting in the updated proposal template.',
          'Export validation catches missing requirements, duplicate course credit, and courses outside the template range.',
        ],
      },
    ],
  },
  {
    version: '2026-07-01',
    label: 'July 1, 2026',
    summary:
      'Plan starts when you say it does, and drag-and-drop on the schedule is rebuilt to be clearer and actually work.',
    sections: [
      {
        title: 'Your plan',
        items: [
          'The plan now begins at your chosen “next semester” (e.g. Fall 2026) instead of defaulting back to program start.',
          'Changing next semester clears a stale layout so Step 4 regenerates from the right term.',
          'Mark completed courses in Step 2 so they show as done — not as empty future semesters.',
        ],
      },
      {
        title: 'Drag & drop',
        items: [
          'Rebuilt course dragging with pointer tracking — swaps and moves are much more reliable.',
          'Drag from anywhere on the course row; a quick click still expands the card details.',
          'One red “Add here” zone at the bottom of each valid semester to move a course in.',
          'Drop onto another course to swap semesters — valid partners glow, and a summary bar lists every course you can swap with.',
          'Course names stay readable while dragging; swap hints appear below the row, not over the title.',
          'Swaps apply immediately when credits and prerequisites check out.',
        ],
      },
    ],
  },
  {
    version: '2026-06-29',
    label: 'June 29, 2026',
    summary:
      'More reliable Excel exports, course swapping on the plan, and stronger usage-stats protection.',
    sections: [
      {
        title: 'Excel export & scheduling',
        items: [
          'Fixed proposal columns to match Cornell’s template (Summer 1, Fall 1, Spring 1…) so credits land in the right semester.',
          'Smarter auto-scheduling packs smaller courses first when a semester is tight on credits.',
          'Export is blocked until the plan has at least 30 credits, no unscheduled courses, and every course can be placed on the spreadsheet.',
        ],
      },
      {
        title: 'Drag & drop',
        items: [
          'Interactive tutorial on the plan page — practice swapping two sample courses before editing your schedule.',
          'Drag a course onto another course in a different semester to swap them when both terms would stay within your credit cap.',
          'Full semesters highlight valid swap targets while you drag.',
        ],
      },
      {
        title: 'Usage stats (/stats)',
        items: [
          'Stats requests go through the site API instead of exposing counter URLs in the browser.',
          'Rate limits and caching reduce spam and keep the stats page fast.',
          'Excel export counts are limited to one per browser per day for analytics (downloads are still unlimited).',
        ],
      },
      {
        title: 'Feature requests',
        items: [
          'Added rate limiting on the feedback form to reduce abuse.',
        ],
      },
    ],
  },
]

export function formatVersionLabel(version: string): string {
  const release = CHANGELOG.find((r) => r.version === version)
  if (release) return release.label
  const [y, m, d] = version.split('-').map(Number)
  if (!y || !m || !d) return version
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function latestRelease(): ChangelogRelease {
  return CHANGELOG[0]
}

export function hasSeenLatestChangelog(): boolean {
  try {
    return localStorage.getItem(SEEN_STORAGE_KEY) === LATEST_VERSION
  } catch {
    return true
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, LATEST_VERSION)
  } catch {
    // ignore
  }
}
