import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const CATEGORIES = ['Recycling', 'Donation', 'Reuse', 'Care & Repair', 'Shopping', 'General']

const CATEGORY_STYLES = {
  Recycling: 'bg-green-100 text-green-700',
  Donation: 'bg-pink-100 text-pink-700',
  Reuse: 'bg-blue-100 text-blue-700',
  'Care & Repair': 'bg-amber-100 text-amber-700',
  Shopping: 'bg-purple-100 text-purple-700',
  General: 'bg-gray-100 text-gray-700',
}

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const STATUS_LABELS = {
  pending: 'Pending review',
  published: 'Published',
  rejected: 'Rejected',
}

function TipForm({ tip, saving, serverError, onSave, onCancel }) {
  const [title, setTitle] = useState(tip ? tip.title : '')
  const [category, setCategory] = useState(tip ? tip.category : 'General')
  const [content, setContent] = useState(tip ? tip.content : '')
  const [localError, setLocalError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setLocalError('')

    if (title.trim().length < 3) {
      setLocalError('The title needs at least 3 characters.')
      return
    }
    if (content.trim().length < 10) {
      setLocalError('The tip text needs at least 10 characters.')
      return
    }

    onSave({ title: title.trim(), category, content: content.trim() })
  }

  const inputClass =
    'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-xl shadow p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold text-green-700">
          {tip ? 'Edit eco tip' : 'Create new eco tip'}
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            className={inputClass}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tip text *
          </label>
          <textarea
            rows="6"
            maxLength={2000}
            className={inputClass}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">{content.length} / 2000</p>
        </div>

        {!tip && (
          <p className="text-xs text-gray-500">
            Tips you create are published to users straight away.
          </p>
        )}

        {(localError || serverError) && (
          <p className="text-sm text-red-600">{localError || serverError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Tips({ onLogout }) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  const [tips, setTips] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // null = closed, { tip: null } = creating, { tip } = editing
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

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
      if (debouncedSearch) params.set('q', debouncedSearch)
      params.set('page', String(page))

      const data = await api(`/api/admin/eco-tips?${params.toString()}`)
      setTips(data.tips)
      setPendingCount(data.pendingCount)
      setTotal(data.total)
      setPageSize(data.pageSize)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, debouncedSearch, page, handleAuthError])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(data) {
    setSaving(true)
    setFormError('')

    try {
      if (formState.tip) {
        await api(`/api/admin/eco-tips/${formState.tip.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      } else {
        await api('/api/admin/eco-tips', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      }

      setFormState(null)
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function runAction(request) {
    setError('')

    try {
      await request()
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  function handleApprove(tip) {
    runAction(() => api(`/api/admin/eco-tips/${tip.id}/approve`, { method: 'POST' }))
  }

  function handleReject(tip) {
    const verb = tip.status === 'published' ? 'Take down' : 'Reject'
    const reason = window.prompt(
      `${verb} "${tip.title}"? Enter a reason the author will see (optional):`
    )
    if (reason === null) return

    runAction(() =>
      api(`/api/admin/eco-tips/${tip.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    )
  }

  function handleDelete(tip) {
    if (!window.confirm(`Delete "${tip.title}"? This cannot be undone.`)) return
    runAction(() => api(`/api/admin/eco-tips/${tip.id}`, { method: 'DELETE' }))
  }

  const filters = [
    { value: '', label: 'All' },
    { value: 'pending', label: `Pending review${pendingCount ? ` (${pendingCount})` : ''}` },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-700">
              Sustainability Tips
            </h1>
            <p className="text-sm text-gray-600">
              Create and update eco tips, and review the ones NGOs submit.
            </p>
          </div>
          <button
            onClick={() => {
              setFormError('')
              setFormState({ tip: null })
            }}
            className="text-sm bg-green-700 text-white hover:bg-green-800 rounded-lg px-4 py-2"
          >
            + Create new tip
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tips..."
            className="flex-1 min-w-56 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
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
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {loading && <p className="text-gray-500">Loading...</p>}
        {!loading && tips.length === 0 && (
          <p className="text-gray-500">No tips match.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {tips.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow p-5 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-medium rounded px-2 py-1 ${
                    CATEGORY_STYLES[t.category] || CATEGORY_STYLES.General
                  }`}
                >
                  {t.category}
                </span>
                <span
                  className={`text-xs font-medium rounded px-2 py-1 ${
                    STATUS_STYLES[t.status] || ''
                  }`}
                >
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </div>

              <h2 className="text-lg font-bold text-gray-800">{t.title}</h2>
              <p className="text-sm text-gray-600 line-clamp-4">{t.content}</p>

              {t.status === 'rejected' && t.rejectionReason && (
                <p className="text-xs text-red-600">
                  Reason: {t.rejectionReason}
                </p>
              )}

              <p className="text-xs text-gray-500">
                By {t.author} · updated {new Date(t.updatedAt).toLocaleDateString()}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-auto pt-1">
                {t.status !== 'published' && (
                  <button
                    onClick={() => handleApprove(t)}
                    className="text-green-700 font-medium hover:underline"
                  >
                    {t.status === 'pending' ? 'Approve' : 'Publish'}
                  </button>
                )}
                {t.status !== 'rejected' && (
                  <button
                    onClick={() => handleReject(t)}
                    className="text-amber-700 hover:underline"
                  >
                    {t.status === 'published' ? 'Take down' : 'Reject'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setFormError('')
                    setFormState({ tip: t })
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>{loading ? 'Loading...' : `${total} tip(s)`}</p>
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
      </main>

      {formState && (
        <TipForm
          tip={formState.tip}
          saving={saving}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}
    </div>
  )
}