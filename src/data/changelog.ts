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
export const LATEST_VERSION = '2026-06-29'

const SEEN_STORAGE_KEY = 'mem-planner-changelog-seen'

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: LATEST_VERSION,
    label: 'June 29, 2026',
    summary:
      'More reliable Excel exports, course swapping on the plan, and stronger usage-stats protection.',
    sections: [
      {
        title: 'Excel export & scheduling',
        items: [
          'Fixed proposal columns to match Cornell’s template (Summer 1, Fall 1, Spring 1…) so credits land in the right semester.',
          'Planner now includes your program-start spring when “next semester” is later — required courses like economics are less likely to be skipped.',
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
