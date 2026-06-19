import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  devicePercent,
  detectDevice,
  fetchSiteStats,
  type DeviceType,
  type SiteStats,
} from '../lib/analytics'
import '../App.css'

const DEVICE_LABELS: Record<DeviceType, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-val">{value}</div>
      <div className="stat-card-lbl">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

function DeviceBar({
  label,
  count,
  percent,
  color,
}: {
  label: string
  count: number | null
  percent: number
  color: string
}) {
  return (
    <div className="device-row">
      <div className="device-row-hdr">
        <span className="device-row-lbl">{label}</span>
        <span className="device-row-num">
          {count ?? '—'} <span className="device-row-pct">({percent}%)</span>
        </span>
      </div>
      <div className="device-row-track">
        <div
          className="device-row-fill"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thisDevice] = useState(() => detectDevice())
  const loadedRef = useRef(false)

  async function loadStats() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchSiteStats()
      setStats(data)
      if (
        data.dailyVisitors == null &&
        data.mobile == null &&
        data.desktop == null
      ) {
        setError(
          'Stats service is unreachable right now. Try refreshing in a moment.',
        )
      }
    } catch {
      setError('Could not load stats right now. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void loadStats()
  }, [])

  const deviceTotal = stats?.deviceTotal ?? 0

  return (
    <>
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-word">Cornell Engineering</span>
          <span className="hdr-sep">|</span>
          <span className="hdr-app">M.Eng. Management · Usage Stats</span>
        </div>
        <Link to="/" className="hdr-request">
          ← Back to planner
        </Link>
      </header>

      <main className="main stats-main">
        <div className="stats-hdr-row">
          <div>
            <h1 className="step-title">Planner usage</h1>
            <p className="step-sub">
              Approximate unique reach — one count per browser per day (resets at
              midnight). Excel exports count every download. No accounts or cookies
              beyond local deduping.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadStats()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {error && (
          <div className="alert alert-err">
            <span className="alert-icon">⚠</span>
            <div>{error}</div>
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            label="Daily visitors"
            value={stats?.dailyVisitors ?? (loading ? '…' : '—')}
            sub="One per browser per day"
          />
          <StatCard
            label="Excel exports"
            value={stats?.excelExports ?? (loading ? '…' : '—')}
            sub="Every proposal download"
          />
          <StatCard
            label="Your device"
            value={DEVICE_LABELS[thisDevice]}
            sub="Detected on this visit"
          />
        </div>

        <div className="card">
          <div className="sec-label">Visitors by device</div>
          <p className="stats-device-note">
            When someone opens the planner for the first time that day, one device
            counter increments. Refreshing or revisiting the same day does not add
            another count.
          </p>

          <DeviceBar
            label="Desktop"
            count={stats?.desktop ?? null}
            percent={devicePercent(stats?.desktop ?? null, deviceTotal)}
            color="#b31b1b"
          />
          <DeviceBar
            label="Mobile"
            count={stats?.mobile ?? null}
            percent={devicePercent(stats?.mobile ?? null, deviceTotal)}
            color="#555"
          />
          <DeviceBar
            label="Tablet"
            count={stats?.tablet ?? null}
            percent={devicePercent(stats?.tablet ?? null, deviceTotal)}
            color="#999"
          />
        </div>

        {stats?.lastFetched && (
          <p className="stats-updated">
            Last updated {stats.lastFetched.toLocaleString()}
          </p>
        )}
      </main>
    </>
  )
}
