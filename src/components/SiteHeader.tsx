import { NavLink } from 'react-router-dom'

export default function SiteHeader({ onFeedback }: { onFeedback?: () => void }) {
  return (
    <header className="site-header">
      <NavLink to="/" className="site-brand" aria-label="Cornell MEM course planner">
        <span className="brand-seal"><img src="/Cornell_University_seal.svg.png" alt="" width="40" height="40" /></span>
        <span><strong>Cornell MEM</strong><span className="brand-caption">Distance Learning · Course Planner</span></span>
      </NavLink>
      <nav className="site-links" aria-label="Main navigation">
        <NavLink to="/" end>Planner</NavLink>
        <NavLink to="/changelog">Updates</NavLink>
        <NavLink to="/stats">Usage</NavLink>
        {onFeedback && <button type="button" onClick={onFeedback}>Feedback <span aria-hidden="true">↗</span></button>}
      </nav>
    </header>
  )
}
