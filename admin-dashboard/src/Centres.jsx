import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const EMPTY_FORM = {
  name: '',
  address: '',
  coordinates: '',
  phone: '',
  openingHours: '',
  notes: '',
  isActive: true,
}

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

function CentreForm({ centre, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(
    centre
      ? {
          name: centre.name,
          address: centre.address || '',
          coordinates: `${centre.latitude}, ${centre.longitude}`,
          phone: centre.phone || '',
          openingHours: centre.openingHours || '',
          notes: centre.notes || '',
          isActive: centre.isActive,
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

    if (!form.name.trim()) {
      setLocalError('Name is required.')
      return
    }

    const coords = parseCoordinates(form.coordinates)
    if (!coords) {
      setLocalError('Coordinates must look like: 5.3416, 100.2819')
      return
    }

    onSave({
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      phone: form.phone.trim(),
      openingHours: form.openingHours.trim(),
      notes: form.notes.trim(),
      isActive: form.isActive,
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
          {centre ? 'Edit donation centre' : 'Add donation centre'}
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
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
            In Google Maps, right-click the place and click the numbers at the
            top of the menu to copy them, then paste here.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            rows="2"
            className={inputClass}
            placeholder="What they accept, special instructions..."
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => update('isActive', e.target.checked)}
          />
          Show on the app map
        </label>

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

export default function Centres({ user, onLogout }) {
  const [centres, setCentres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // null = closed, { centre: null } = adding, { centre } = editing
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

  const loadCentres = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await api('/api/admin/donation-centers')
      setCentres(data.centers)
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [handleAuthError])

  useEffect(() => {
    loadCentres()
  }, [loadCentres])

  function openAdd() {
    setFormError('')
    setFormState({ centre: null })
  }

  function openEdit(centre) {
    setFormError('')
    setFormState({ centre })
  }

  async function handleSave(data) {
    setSaving(true)
    setFormError('')

    try {
      if (formState.centre) {
        await api(`/api/admin/donation-centers/${formState.centre._id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      } else {
        await api('/api/admin/donation-centers', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      }

      setFormState(null)
      await loadCentres()
    } catch (err) {
      if (!handleAuthError(err)) setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleVisible(centre) {
    try {
      await api(`/api/admin/donation-centers/${centre._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !centre.isActive }),
      })
      await loadCentres()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  async function handleDelete(centre) {
    const sure = window.confirm(
      `Delete "${centre.name}"? This cannot be undone.`
    )
    if (!sure) return

    try {
      await api(`/api/admin/donation-centers/${centre._id}`, {
        method: 'DELETE',
      })
      await loadCentres()
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-700">
            Donation Centres
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <button
              onClick={onLogout}
              className="text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {loading ? 'Loading...' : `${centres.length} centre(s)`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={loadCentres}
              className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-3 py-1.5"
            >
              Refresh
            </button>
            <button
              onClick={openAdd}
              className="text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg px-3 py-1.5"
            >
              + Add centre
            </button>
          </div>
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {centres.map((c) => (
                <tr key={c._id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.address || '-'}</td>
                  <td className="px-4 py-3">
                    {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <span className="text-green-700">Visible on map</span>
                    ) : (
                      <span className="text-gray-500">Hidden</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleVisible(c)}
                      className="text-gray-600 hover:underline mr-3"
                    >
                      {c.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && centres.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No donation centres yet. Click "+ Add centre".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {formState && (
        <CentreForm
          centre={formState.centre}
          saving={saving}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}
    </div>
  )
}