import { useEffect } from 'react'
import SiteHeader from '../components/SiteHeader'
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
      <SiteHeader />

      <main className="main changelog-main">
        <div className="changelog-hdr">
          <h1 className="step-title">Changelog</h1>
          <p className="step-sub">
            A record of improvements to course planning, scheduling, and proposal exports.
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
