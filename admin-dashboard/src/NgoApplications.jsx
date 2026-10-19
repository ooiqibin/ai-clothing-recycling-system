import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const FILTERS = ['pending', 'approved', 'rejected']

// Accepts "5.3416, 100.2819" (the format Google Maps copies).
function parseCoordinates(text) {
  const parts = text.split(',').map((p) => p.trim())
  if (parts.length !== 2 || parts.some((p) => p === '')) return null

  const latitude = Number(parts[0])
  const longitude = Number(parts[1])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

  return { latitude, longitude }
}

function ApproveDialog({ application, centres, saving, serverError, onApprove, onCancel }) {
  const [mode, setMode] = useState('new') // 'new' | 'existing'
  const [existingId, setExistingId] = useState('')
  const [form, setForm] = useState({
    name: application.organisationName,
    address: application.address,
    coordinates: '',
    phone: application.contactPhone,
    openingHours: '',
  })
  const [localError, setLocalError] = useState('')

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setLocalError('')

    if (mode === 'existing') {
      if (!existingId) {
        setLocalError('Choose a donation centre.')
        return
      }
      onApprove({ centerId: existingId })
      return
    }

    const coords = parseCoordinates(form.coordinates)
    if (!coords) {
      setLocalError('Coordinates must look like: 5.3416, 100.2819')
      return
    }

    onApprove({
      centre: {
        name: form.name,
        address: form.address,
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: form.phone,
        openingHours: form.openingHours,
      },
    })
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
          Approve {application.organisationName}
        </h2>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            Create a new donation centre
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />
            Link an existing centre
          </label>
        </div>

        {mode === 'existing' ? (
          <select
            className={inputClass}
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
          >
            <option value="">Choose a centre...</option>
            {centres.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centre name
              </label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coordinates *
              </label>
              <input
                className={inputClass}
                placeholder="5.3416, 100.2819"
                value={form.coordinates}
                onChange={(e) => update('coordinates', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                In Google Maps, right-click the place and click the numbers at
                the top of the menu to copy them, then paste here.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening hours
                </label>
                <input
                  className={inputClass}
                  placeholder="Mon-Fri 9am-5pm"
                  value={form.openingHours}
                  onChange={(e) => update('openingHours', e.target.value)}
                />
              </div>
            </div>
          </div>
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
            {saving ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NgoApplications({ onLogout }) {
  const [status, setStatus] = useState('pending')
  const [applications, setApplications] = useState([])
  const [centres, setCentres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [approving, setApproving] = useState(null) // the application being approved
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')

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

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [appData, centreData] = await Promise.all([
        api(`/api/admin/ngo-applications?status=${status}`),
        api('/api/admin/donation-centers'),
      ])
      setApplications(appData.applications)
      setCentres(centreData.centers)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, handleAuthError])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(body) {
    setSaving(true)
    setDialogError('')

    try {
      await api(`/api/admin/ngo-applications/${approving.id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setApproving(null)
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setDialogError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReject(application) {
    const reason = window.prompt(
      `Reject ${application.organisationName}? Enter a reason the applicant will see (optional):`
    )
    if (reason === null) return // cancelled

    try {
      await api(`/api/admin/ngo-applications/${application.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      await load()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-700">NGO Applications</h1>
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatus(f)}
                className={`text-sm rounded-lg px-3 py-1.5 capitalize ${
                  status === f
                    ? 'bg-green-600 text-white'
                    : 'bg-white border hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {loading && <p className="text-gray-500">Loading...</p>}

        {!loading && applications.length === 0 && (
          <p className="text-gray-500">No {status} applications.</p>
        )}

        {applications.map((a) => (
          <div key={a.id} className="bg-white rounded-xl shadow p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {a.organisationName}
                </h2>
                <p className="text-sm text-gray-500">
                  Registration no: {a.registrationNumber}
                </p>
              </div>
              <p className="text-xs text-gray-500 whitespace-nowrap">
                Submitted {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <p>
                <span className="text-gray-500">Contact:</span>{' '}
                {a.applicant ? `${a.applicant.name} (${a.applicant.email})` : '-'}
              </p>
              <p>
                <span className="text-gray-500">Phone:</span> {a.contactPhone}
              </p>
              <p className="sm:col-span-2">
                <span className="text-gray-500">Address:</span> {a.address}
              </p>
              {a.about && (
                <p className="sm:col-span-2">
                  <span className="text-gray-500">About:</span> {a.about}
                </p>
              )}
              {a.status === 'approved' && a.centre && (
                <p className="sm:col-span-2 text-green-700">
                  Approved and linked to: {a.centre.name}
                </p>
              )}
              {a.status === 'rejected' && (
                <p className="sm:col-span-2 text-red-600">
                  Rejected{a.rejectionReason ? `: ${a.rejectionReason}` : ''}
                </p>
              )}
            </div>

            {a.status === 'pending' && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setDialogError('')
                    setApproving(a)
                  }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(a)}
                  className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </main>

      {approving && (
        <ApproveDialog
          application={approving}
          centres={centres}
          saving={saving}
          serverError={dialogError}
          onApprove={handleApprove}
          onCancel={() => setApproving(null)}
        />
      )}
    </div>
  )
}