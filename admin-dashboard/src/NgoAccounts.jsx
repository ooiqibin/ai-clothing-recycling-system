import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const EMPTY_FORM = { name: '', email: '', password: '' }

export default function NgoAccounts({ onLogout }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { ok, text }

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

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setListError('')

    try {
      const data = await api('/api/admin/ngo-accounts')
      setAccounts(data.accounts)
    } catch (err) {
      if (!handleAuthError(err)) setListError(err.message)
    } finally {
      setLoading(false)
    }
  }, [handleAuthError])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleCreate(event) {
    event.preventDefault()
    setMessage(null)
    setSaving(true)

    try {
      const data = await api('/api/admin/ngo-accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      })

      setMessage({
        ok: true,
        text: `Created. ${data.account.name} can now log in to the app with ${data.account.email}.`,
      })
      setForm(EMPTY_FORM)
      await loadAccounts()
    } catch (err) {
      if (!handleAuthError(err)) setMessage({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(account) {
    const sure = window.confirm(
      `Delete the NGO account "${account.name}" (${account.email})? They will no longer be able to log in.`
    )
    if (!sure) return

    try {
      await api(`/api/admin/ngo-accounts/${account._id}`, { method: 'DELETE' })
      await loadAccounts()
    } catch (err) {
      if (!handleAuthError(err)) setListError(err.message)
    }
  }

  const inputClass =
    'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow p-6 space-y-4"
        >
          <h1 className="text-xl font-bold text-green-700">
            Create an NGO account
          </h1>
          <p className="text-sm text-gray-600">
            NGO staff log in to the mobile app with these details and use the
            Verify tab to confirm donations.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organisation / staff name
              </label>
              <input
                className={inputClass}
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className={inputClass}
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password (min 6)
              </label>
              <input
                type="password"
                className={inputClass}
                required
                minLength={6}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
            </div>
          </div>

          {message && (
            <p
              className={`text-sm font-medium ${
                message.ok ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create NGO account'}
          </button>
        </form>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">NGO accounts</h2>
            <button
              type="button"
              onClick={loadAccounts}
              className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-3 py-1.5"
            >
              Refresh
            </button>
          </div>

          {listError && <p className="text-red-600 mb-3">{listError}</p>}

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a._id} className="border-t">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(a)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No NGO accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}