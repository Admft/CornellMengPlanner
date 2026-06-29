import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  hasSeenLatestChangelog,
  LATEST_VERSION,
  latestRelease,
  markChangelogSeen,
} from '../data/changelog'

export default function WhatsNewBanner() {
  const [visible, setVisible] = useState(() => !hasSeenLatestChangelog())
  const release = latestRelease()

  if (!visible) return null

  function dismiss() {
    markChangelogSeen()
    setVisible(false)
  }

  return (
    <div className="whats-new" role="status" aria-live="polite">
      <div className="whats-new-inner">
        <div className="whats-new-copy">
          <span className="whats-new-badge">New · v{LATEST_VERSION}</span>
          <strong>Updates are live.</strong> {release.summary}{' '}
          <Link to="/changelog" className="whats-new-link" onClick={markChangelogSeen}>
            See changelog
          </Link>
        </div>
        <button type="button" className="whats-new-dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
