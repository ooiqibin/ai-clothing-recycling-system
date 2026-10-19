import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const GROUPS = [
  { value: '', label: 'All' },
  { value: 'donors', label: 'Donors' },
  { value: 'ngo', label: 'NGO' },
  { value: 'suspended', label: 'Suspended' },
]

const ROLE_LABELS = { user: 'Donor', ngo: 'NGO', ngo_pending: 'NGO (pending)' }

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  idle: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-600',
}

function timeAgo(value) {
  if (!value) return 'No activity yet'

  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour(s) ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day(s) ago`

  return new Date(value).toLocaleDateString()
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-green-700 mt-1">{value}</p>
    </div>
  )
}

export default function Users({ onLogout }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)

  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState({ users: 0, suspended: 0, points: 0 })
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      if (group) params.set('group', group)
      if (debouncedSearch) params.set('q', debouncedSearch)
      params.set('page', String(page))

      const data = await api(`/api/admin/users?${params.toString()}`)
      setUsers(data.users)
      setSummary(data.summary)
      setTotal(data.total)
      setPageSize(data.pageSize)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [group, debouncedSearch, page, handleAuthError])

  useEffect(() => {
    load()
  }, [load])

  async function handleSuspend(user) {
    const reason = window.prompt(
      `Suspend ${user.name} (${user.email})? They will not be able to log in or use the app.\n\nReason (optional):`
    )
    if (reason === null) return // cancelled

    try {
      await api(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  async function handleReactivate(user) {
    if (!window.confirm(`Reactivate ${user.name}? They will be able to log in again.`)) return

    try {
      await api(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' })
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-green-700">User Management</h1>
          <p className="text-sm text-gray-600">
            View community members and suspend accounts when needed.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <StatCard label="Total users" value={summary.users} />
          <StatCard label="Points held by users" value={summary.points} />
          <StatCard label="Suspended accounts" value={summary.suspended} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 min-w-56 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => {
                    setGroup(g.value)
                    setPage(1)
                  }}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    group === g.value
                      ? 'bg-green-600 text-white'
                      : 'bg-white border hover:bg-gray-50'
                  }`}
                >
                  {g.label}
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
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-4 py-3 font-medium">{u.points}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium rounded px-2 py-1 capitalize ${
                          STATUS_STYLES[u.status] || ''
                        }`}
                      >
                        {u.status}
                      </span>
                      {u.status === 'suspended' && u.suspendedReason && (
                        <p className="text-xs text-gray-500 mt-1">
                          {u.suspendedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{timeAgo(u.lastActivity)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {u.status === 'suspended' ? (
                        <button
                          onClick={() => handleReactivate(u)}
                          className="text-green-700 hover:underline"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(u)}
                          className="text-red-600 hover:underline"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>{loading ? 'Loading...' : `${total} user(s)`}</p>
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