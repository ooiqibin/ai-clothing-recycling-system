import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import CentrePicker from './CentrePicker'
import CodeInput from './CodeInput'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'awaiting_verification', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
]

const CENTRE_FILTER_EXTRAS = [
  { id: '', name: 'All centres' },
  { id: 'none', name: 'No centre recorded (older donations)' },
]

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export default function Activity({ onLogout }) {
  const [centres, setCentres] = useState([])

  // Log filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [centreFilter, setCentreFilter] = useState('')
  const [page, setPage] = useState(1)

  // Log data
  const [donations, setDonations] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Verify form
  const [code, setCode] = useState('')
  const [verifyCentre, setVerifyCentre] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null) // { ok, text }

  const handleAuthError = useCallback(
    (err) => {
      if (err.status === 401 || err.status === 403) {
        onLogout()
        return true
      }
      return false
    },
    [onLogout]
  )

  // Load the centre list once.
  useEffect(() => {
    api('/api/admin/donation-centers')
      .then((data) => setCentres(data.centers))
      .catch((err) => handleAuthError(err))
  }, [handleAuthError])

  // Wait a moment after typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (centreFilter) params.set('centerId', centreFilter)
      if (debouncedSearch) params.set('q', debouncedSearch)
      params.set('page', String(page))

      const data = await api(`/api/admin/donations?${params.toString()}`)
      setDonations(data.donations)
      setPendingCount(data.pendingCount)
      setTotal(data.total)
      setPageSize(data.pageSize)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, centreFilter, debouncedSearch, page, handleAuthError])

  useEffect(() => {
    load()
  }, [load])

  async function handleVerify(event) {
    event.preventDefault()
    setResult(null)
    setChecking(true)

    try {
      const data = await api('/api/verify', {
        method: 'POST',
        body: JSON.stringify({ verificationCode: code, centerId: verifyCentre }),
      })

      setResult({
        ok: true,
        text: `Verified. ${data.donorName} earned +${data.pointsAwarded} pts for ${data.itemCount} item(s).`,
      })
      setCode('')
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setResult({ ok: false, text: err.message })
    } finally {
      setChecking(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <form
          onSubmit={handleVerify}
          className="bg-white rounded-xl shadow p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-green-700">
                Verify a donation
              </h1>
              <p className="text-sm text-gray-600">
                Use this when an NGO partner cannot verify in the app. Choose
                the centre that received the donation.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-gray-500">awaiting verification</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CodeInput value={code} onChange={setCode} />
            <CentrePicker
              centres={centres}
              value={verifyCentre}
              onChange={setVerifyCentre}
              placeholder="Search receiving centre..."
              className="flex-1 min-w-56"
            />
            <button
              type="submit"
              placeholder="Centre (only for older donations)"
              className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {checking ? 'Checking...' : 'Verify'}
            </button>
          </div>

          {result && (
            <p
              className={`text-sm font-medium ${
                result.ok ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {result.text}
            </p>
          )}
        </form>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800">Activity log</h2>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search donor name, email or code..."
              className="flex-1 min-w-56 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <CentrePicker
              centres={centres}
              value={centreFilter}
              onChange={(id) => {
                setCentreFilter(id)
                setPage(1)
              }}
              extraOptions={CENTRE_FILTER_EXTRAS}
              placeholder="All centres"
              className="w-64"
            />
            <div className="flex gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setStatus(f.value)
                    setPage(1)
                  }}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    status === f.value
                      ? 'bg-green-600 text-white'
                      : 'bg-white border hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={load}
                className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-3 py-2"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Donor</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Points</th>
                    <th className="px-4 py-3">Centre</th>
                    <th className="px-4 py-3">Verified by</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-3 font-mono tracking-widest">{d.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.donor ? d.donor.name : '-'}</p>
                      {d.donor && (
                        <p className="text-xs text-gray-500">{d.donor.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{d.itemCount}</td>
                    <td className="px-4 py-3">{d.totalPoints}</td>
                    <td className="px-4 py-3">{d.centre ? d.centre.name : '-'}</td>
                    <td className="px-4 py-3">
                      {d.verifiedBy ? d.verifiedBy.name : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'verified' ? (
                        <span className="text-green-700 font-medium">Verified</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(d.verifiedAt || d.createdAt)}
                    </td>
                  </tr>
                ))}

                {!loading && donations.length === 0 && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No donations match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>{loading ? 'Loading...' : `${total} donation(s)`}</p>
            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}