import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

function StatCard({ label, value, note }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-green-700 mt-1">{value}</p>
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  )
}

function BarRow({ label, count, max }) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-gray-600 capitalize">{label}</span>
      <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
        <div className="bg-green-500 h-5" style={{ width: `${width}%` }} />
      </div>
      <span className="w-10 text-right font-medium">{count}</span>
    </div>
  )
}

export default function Overview({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')

    try {
      setStats(await api('/api/admin/stats'))
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout()
        return
      }
      setError(err.message)
    }
  }, [onLogout])

  useEffect(() => {
    load()
  }, [load])

  const maxCategory = stats
    ? Math.max(0, ...stats.byCategory.map((c) => c.count))
    : 0
  const maxDay = stats ? Math.max(0, ...stats.scansPerDay.map((d) => d.count)) : 0

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-700">Overview</h1>
          <button
            onClick={load}
            className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-3 py-1.5"
          >
            Refresh
          </button>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {!stats && !error && <p className="text-gray-500">Loading...</p>}

        {stats && (
          <>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <StatCard label="Donors" value={stats.donors} />
              <StatCard label="NGO accounts" value={stats.ngoAccounts} />
              <StatCard
                label="Donation centres"
                value={stats.centres.visible}
                note={`${stats.centres.total} total`}
              />
              <StatCard label="Total scans" value={stats.totalScans} />
              <StatCard label="Items donated" value={stats.itemsDonated} />
              <StatCard
                label="Verified donations"
                value={stats.verifiedBatches}
              />
              <StatCard
                label="Awaiting verification"
                value={stats.awaitingBatches}
              />
              <StatCard label="Points awarded" value={stats.pointsAwarded} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-white rounded-xl shadow p-5 space-y-3">
                <h2 className="font-bold text-gray-800">Scans by category</h2>
                {stats.byCategory.length === 0 && (
                  <p className="text-sm text-gray-500">No scans yet.</p>
                )}
                {stats.byCategory.map((c) => (
                  <BarRow
                    key={c.category}
                    label={c.category}
                    count={c.count}
                    max={maxCategory}
                  />
                ))}
              </div>

              <div className="bg-white rounded-xl shadow p-5 space-y-3">
                <h2 className="font-bold text-gray-800">Scans, last 7 days</h2>
                {stats.scansPerDay.map((d) => (
                  <BarRow
                    key={d.day}
                    label={d.day.slice(5)}
                    count={d.count}
                    max={maxDay}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}