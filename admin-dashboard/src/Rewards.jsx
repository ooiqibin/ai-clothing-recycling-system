import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const EMPTY_FORM = {
  title: '',
  partnerName: '',
  pointsCost: '',
  stock: '',
  perUserLimit: '',
  validDays: '30',
  description: '',
  terms: '',
}

const COUPON_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_STYLES = {
  active: 'text-green-700',
  used: 'text-gray-500',
  expired: 'text-amber-700',
  cancelled: 'text-red-600',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function RewardForm({ reward, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(
    reward
      ? {
          title: reward.title,
          partnerName: reward.partnerName,
          pointsCost: String(reward.pointsCost),
          stock: reward.stock === null ? '' : String(reward.stock),
          perUserLimit: reward.perUserLimit === null ? '' : String(reward.perUserLimit),
          validDays: String(reward.validDays),
          description: reward.description,
          terms: reward.terms,
        }
      : EMPTY_FORM
  )
  const [localError, setLocalError] = useState('')

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setLocalError('')

    if (form.title.trim().length < 3) {
      setLocalError('The title needs at least 3 characters.')
      return
    }

    const cost = Number(form.pointsCost)
    if (!Number.isInteger(cost) || cost < 1) {
      setLocalError('Points cost must be a whole number of at least 1.')
      return
    }

    onSave({
      title: form.title.trim(),
      partnerName: form.partnerName.trim(),
      pointsCost: cost,
      stock: form.stock.trim() === '' ? null : Number(form.stock),
      perUserLimit: form.perUserLimit.trim() === '' ? null : Number(form.perUserLimit),
      validDays: form.validDays.trim() === '' ? 30 : Number(form.validDays),
      description: form.description.trim(),
      terms: form.terms.trim(),
    })
  }

  const inputClass =
    'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-xl shadow p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold text-green-700">
          {reward ? 'Edit reward' : 'Create reward'}
        </h2>

        <div>
          <label className={labelClass}>Title *</label>
          <input
            className={inputClass}
            maxLength={80}
            placeholder="e.g. Free coffee at Green Cafe"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Partner / shop</label>
            <input
              className={inputClass}
              maxLength={60}
              value={form.partnerName}
              onChange={(e) => update('partnerName', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Points cost *</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.pointsCost}
              onChange={(e) => update('pointsCost', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Stock</label>
            <input
              type="number"
              min="0"
              className={inputClass}
              placeholder="Unlimited"
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Limit per user</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              placeholder="None"
              value={form.perUserLimit}
              onChange={(e) => update('perUserLimit', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Valid days</label>
            <input
              type="number"
              min="1"
              max="365"
              className={inputClass}
              value={form.validDays}
              onChange={(e) => update('validDays', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Leave stock empty for unlimited. Valid days is how long a coupon lasts
          after a user redeems it.
        </p>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows="2"
            maxLength={300}
            className={inputClass}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Terms &amp; conditions</label>
          <textarea
            rows="2"
            maxLength={500}
            className={inputClass}
            placeholder="e.g. One per visit. Not valid with other offers."
            value={form.terms}
            onChange={(e) => update('terms', e.target.value)}
          />
        </div>

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

function RewardsList({ handleAuthError }) {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // null = closed, { reward: null } = creating, { reward } = editing
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await api('/api/admin/rewards')
      setRewards(data.rewards)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [handleAuthError])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(data) {
    setSaving(true)
    setFormError('')

    try {
      if (formState.reward) {
        await api(`/api/admin/rewards/${formState.reward.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      } else {
        await api('/api/admin/rewards', {
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

  async function run(request) {
    setError('')

    try {
      await request()
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  function toggleActive(reward) {
    run(() =>
      api(`/api/admin/rewards/${reward.id}/active`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !reward.isActive }),
      })
    )
  }

  function handleDelete(reward) {
    if (!window.confirm(`Delete "${reward.title}"? This cannot be undone.`)) return
    run(() => api(`/api/admin/rewards/${reward.id}`, { method: 'DELETE' }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {loading ? 'Loading...' : `${rewards.length} reward(s)`}
        </p>
        <button
          onClick={() => {
            setFormError('')
            setFormState({ reward: null })
          }}
          className="text-sm bg-green-700 text-white hover:bg-green-800 rounded-lg px-4 py-2"
        >
          + Create reward
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!loading && rewards.length === 0 && (
        <p className="text-gray-500">No rewards yet. Create the first one.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rewards.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow p-5 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-800">{r.title}</h2>
              <span className="shrink-0 text-sm font-bold text-green-700 bg-green-100 rounded px-2 py-1">
                {r.pointsCost} pts
              </span>
            </div>

            {r.partnerName && (
              <p className="text-sm text-gray-500">{r.partnerName}</p>
            )}
            {r.description && (
              <p className="text-sm text-gray-600">{r.description}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs mt-1">
              <span
                className={`rounded px-2 py-1 ${
                  r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {r.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="rounded px-2 py-1 bg-gray-100 text-gray-700">
                {r.stock === null ? 'Unlimited stock' : `${r.stock} left`}
              </span>
              {r.soldOut && (
                <span className="rounded px-2 py-1 bg-red-100 text-red-600">Sold out</span>
              )}
              <span className="rounded px-2 py-1 bg-gray-100 text-gray-700">
                {r.redeemedCount} redeemed
              </span>
              <span className="rounded px-2 py-1 bg-gray-100 text-gray-700">
                Valid {r.validDays} days
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-auto pt-2">
              <button
                onClick={() => {
                  setFormError('')
                  setFormState({ reward: r })
                }}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(r)}
                className="text-amber-700 hover:underline"
              >
                {r.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleDelete(r)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {formState && (
        <RewardForm
          reward={formState.reward}
          saving={saving}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}
    </div>
  )
}

function Redemptions({ handleAuthError }) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  const [coupons, setCoupons] = useState([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

      const data = await api(`/api/admin/coupons?${params.toString()}`)
      setCoupons(data.coupons)
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

  async function run(request) {
    setError('')
    setNotice('')

    try {
      const data = await request()
      if (data && data.message) setNotice(data.message)
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  function markUsed(coupon) {
    if (!window.confirm(`Mark coupon ${coupon.code} as used?`)) return
    run(() => api(`/api/admin/coupons/${coupon.id}/use`, { method: 'POST' }))
  }

  function cancel(coupon) {
    if (
      !window.confirm(
        `Cancel coupon ${coupon.code}? ${coupon.pointsSpent} points will be returned to the user.`
      )
    )
      return
    run(() => api(`/api/admin/coupons/${coupon.id}/cancel`, { method: 'POST' }))
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search coupon code, user name or email..."
          className="flex-1 min-w-56 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex flex-wrap gap-2">
          {COUPON_FILTERS.map((f) => (
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
      {notice && <p className="text-green-700 font-medium">{notice}</p>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Reward</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Points</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Redeemed</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-mono tracking-wider">{c.code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{c.rewardTitle}</p>
                  {c.partnerName && (
                    <p className="text-xs text-gray-500">{c.partnerName}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p>{c.user ? c.user.name : '-'}</p>
                  {c.user && <p className="text-xs text-gray-500">{c.user.email}</p>}
                </td>
                <td className="px-4 py-3">{c.pointsSpent}</td>
                <td className={`px-4 py-3 font-medium capitalize ${STATUS_STYLES[c.status] || ''}`}>
                  {c.status}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.expiresAt)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {c.status === 'active' && (
                    <button
                      onClick={() => markUsed(c)}
                      className="text-green-700 hover:underline mr-3"
                    >
                      Mark used
                    </button>
                  )}
                  {(c.status === 'active' || c.status === 'expired') && (
                    <button
                      onClick={() => cancel(c)}
                      className="text-red-600 hover:underline"
                    >
                      Cancel &amp; refund
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!loading && coupons.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-6 text-center text-gray-500">
                  No redemptions match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>{loading ? 'Loading...' : `${total} redemption(s)`}</p>
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
  )
}

export default function Rewards({ onLogout }) {
  const [view, setView] = useState('rewards')

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

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-700">Rewards</h1>
            <p className="text-sm text-gray-600">
              Publish coupons that users redeem with their points.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'rewards', label: 'Rewards' },
              { id: 'redemptions', label: 'Redemptions' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`text-sm rounded-lg px-4 py-2 ${
                  view === v.id
                    ? 'bg-green-600 text-white'
                    : 'bg-white border hover:bg-gray-50'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'rewards' ? (
          <RewardsList handleAuthError={handleAuthError} />
        ) : (
          <Redemptions handleAuthError={handleAuthError} />
        )}
      </main>
    </div>
  )
}