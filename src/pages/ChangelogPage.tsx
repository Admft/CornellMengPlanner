import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CHANGELOG, LATEST_VERSION } from '../data/changelog'
import SiteFooter from '../components/SiteFooter'
import { setPageMeta } from '../lib/pageMeta'
import '../App.css'

export default function ChangelogPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Changelog | Cornell MEM Schedule Planner',
      description: 'Recent updates to the Cornell MEM course planner.',
      path: '/changelog',
    })
  }, [])

  return (
    <>
      <header className="hdr">
        <div className="hdr-brand">
          <img
            src="/Cornell_University_seal.svg.png"
            alt="Cornell University"
            className="hdr-logo"
          />
          <span className="hdr-word">Cornell Engineering</span>
          <span className="hdr-sep">|</span>
          <span className="hdr-app hdr-app-full">M.Eng. Management · Changelog</span>
          <span className="hdr-app hdr-app-short">· Changelog</span>
        </div>
        <Link to="/" className="hdr-request">
          <span className="hdr-request-full">← Back to planner</span>
          <span className="hdr-request-short">← Planner</span>
        </Link>
      </header>

      <main className="main changelog-main">
        <div className="changelog-hdr">
          <h1 className="step-title">Changelog</h1>
          <p className="step-sub">
            Versions are dated releases (<code>{LATEST_VERSION}</code> = June 29, 2026).
            When something ships, the version date bumps and returning visitors see a short
            notice on the planner.
          </p>
        </div>

        {CHANGELOG.map((release) => (
          <article key={release.version} className="card changelog-release">
            <header className="changelog-release-hdr">
              <div>
                <h2 className="changelog-version">
                  v{release.version}
                  {release.version === LATEST_VERSION && (
                    <span className="changelog-latest-pill">Latest</span>
                  )}
                </h2>
                <p className="changelog-date">{release.label}</p>
              </div>
            </header>
            <p className="changelog-summary">{release.summary}</p>
            {release.sections.map((section) => (
              <div key={section.title} className="changelog-section">
                <h3 className="changelog-section-title">{section.title}</h3>
                <ul className="changelog-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </main>

      <SiteFooter />
    </>
  )
}
