import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const PERIODS = [
  { days: 1, label: '24h' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

function formatCo2(kg) {
  return kg >= 1000
    ? { value: (kg / 1000).toFixed(2), unit: 'tonnes CO2e' }
    : { value: kg.toFixed(1), unit: 'kg CO2e' }
}

export default function Analytics({ onLogout }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setError('')

    try {
      setData(await api(`/api/admin/analytics?days=${days}`))
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout()
        return
      }
      setError(err.message)
    }
  }, [days, onLogout])

  useEffect(() => {
    load()
  }, [load])

  async function handleExport() {
    if (!data) return
    setExporting(true)

    try {
      const { exportAnalyticsPdf } = await import('./exportPdf')
      exportAnalyticsPdf(data)
    } catch (err) {
      setError(`Could not create the PDF: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const co2 = data ? formatCo2(data.carbon.thisMonthKg) : null
  const maxDayItems = data ? Math.max(1, ...data.performance.perDay.map((d) => d.items)) : 1

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-700">
              Verification &amp; Analytics
            </h1>
            <p className="text-sm text-gray-600">
              Real-time view of verified donations and their impact.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-4 py-2"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={!data || exporting}
              className="text-sm bg-green-700 text-white hover:bg-green-800 rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {exporting ? 'Creating PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {!data && !error && <p className="text-gray-500">Loading...</p>}

        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Carbon offset */}
              <div className="bg-green-800 text-white rounded-xl shadow p-5 md:col-span-1">
                <p className="text-sm text-green-100">Carbon offset (estimate)</p>
                <p className="text-xs text-green-200">This month</p>
                <p className="text-4xl font-bold mt-3">{co2.value}</p>
                <p className="text-sm text-green-100">{co2.unit}</p>
                <p className="text-xs mt-3 inline-block bg-green-600 rounded px-2 py-1">
                  {data.carbon.changePct === null
                    ? 'No data last month'
                    : `${data.carbon.changePct > 0 ? '+' : ''}${data.carbon.changePct}% vs last month`}
                </p>
                <p className="text-xs text-green-200 mt-3">
                  {data.carbon.thisMonthItems} item(s) x{' '}
                  {data.carbon.assumptions.avgItemWeightKg} kg x{' '}
                  {data.carbon.assumptions.co2ePerKg} kg CO2e per kg reused
                </p>
              </div>

              {/* Top centres */}
              <div className="bg-white rounded-xl shadow p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800">
                    Top centres by verified donations
                  </h2>
                  <div className="flex gap-1">
                    {PERIODS.map((p) => (
                      <button
                        key={p.days}
                        onClick={() => setDays(p.days)}
                        className={`text-xs rounded-lg px-2.5 py-1 ${
                          days === p.days
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {data.centres.list.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No verified donations in this period.
                  </p>
                )}

                <div className="space-y-3">
                  {data.centres.list.map((c, index) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm gap-3">
                        <span className="font-medium">
                          <span className="text-gray-400 mr-2">#{index + 1}</span>
                          {c.name}
                        </span>
                        <span className="text-gray-500 whitespace-nowrap">
                          {c.donations} donation(s) / {c.items} item(s)
                        </span>
                      </div>
                      <div className="bg-gray-100 rounded h-2.5 mt-1">
                        <div
                          className="bg-green-500 h-2.5 rounded"
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Partner performance */}
            <div className="bg-white rounded-xl shadow p-5 space-y-5">
              <h2 className="font-bold text-gray-800">
                Partner performance, last 7 days
              </h2>

              <div className="flex items-end gap-3 h-40">
                {data.performance.perDay.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <span className="text-xs text-gray-600 mb-1">{d.items}</span>
                    <div
                      className="w-full bg-green-500 rounded-t"
                      style={{
                        height: `${Math.max(2, Math.round((d.items / maxDayItems) * 100))}%`,
                      }}
                      title={`${d.donations} donation(s), ${d.items} item(s)`}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                      {d.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Bars show items from verified donations per day.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Partner / centre</th>
                      <th className="px-4 py-3">Donations</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Points issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.performance.partners.map((p) => (
                      <tr key={p.name} className="border-t">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3">{p.donations}</td>
                        <td className="px-4 py-3">{p.items}</td>
                        <td className="px-4 py-3">{p.points}</td>
                      </tr>
                    ))}
                    {data.performance.partners.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-5 text-center text-gray-500">
                          No verified donations in the last 7 days.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent impact activities */}
            <div className="bg-white rounded-xl shadow p-5 space-y-3">
              <h2 className="font-bold text-gray-800">Recent impact activities</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Centre</th>
                      <th className="px-4 py-3">Donor</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3 font-mono">{r.code}</td>
                        <td className="px-4 py-3">{r.centre}</td>
                        <td className="px-4 py-3">{r.donor}</td>
                        <td className="px-4 py-3">{r.items}</td>
                        <td className="px-4 py-3">
                          {r.status === 'verified' ? (
                            <span className="text-green-700 font-medium">Verified</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{r.points}</td>
                      </tr>
                    ))}
                    {data.recent.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-4 py-5 text-center text-gray-500">
                          No donations yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}