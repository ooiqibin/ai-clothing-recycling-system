
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

  // Verification form
  const [code, setCode] = useState('')
  const [verifyCentre, setVerifyCentre] = useState('')
  const [checking, setChecking] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Donation preview and selected items
  const [preview, setPreview] = useState(null)
  const [selectedItemIds, setSelectedItemIds] = useState([])

  // Handle authentication errors
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

  // Load donation centres
  useEffect(() => {
    api('/api/admin/donation-centers')
      .then((data) => setCentres(data.centers || []))
      .catch((err) => {
        if (!handleAuthError(err)) {
          setError(err.message)
        }
      })
  }, [handleAuthError])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  // Load donation activity log
  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (status) params.set('status', status)
      if (centreFilter) params.set('centerId', centreFilter)
      if (debouncedSearch) params.set('q', debouncedSearch)

      params.set('page', String(page))

      const data = await api(
        `/api/admin/donations?${params.toString()}`
      )

      setDonations(data.donations || [])
      setPendingCount(data.pendingCount || 0)
      setTotal(data.total || 0)
      setPageSize(data.pageSize || 20)
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [
    status,
    centreFilter,
    debouncedSearch,
    page,
    handleAuthError,
  ])

  useEffect(() => {
    load()
  }, [load])

  // Preview donation before verification
  async function handlePreview(event) {
    event.preventDefault()

    setResult(null)
    setPreview(null)
    setSelectedItemIds([])

    if (!/^\d{6}$/.test(code.trim())) {
      setResult({
        ok: false,
        text: 'Please enter a valid 6-digit verification code.',
      })
      return
    }

    setPreviewLoading(true)

    try {
      const data = await api('/api/verify/preview', {
        method: 'POST',
        body: JSON.stringify({
          verificationCode: code.trim(),
        }),
      })

      setPreview(data)

      setSelectedItemIds([])
    } catch (err) {
      if (!handleAuthError(err)) {
        setResult({
          ok: false,
          text: err.message,
        })
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  // Select or deselect an item
  function toggleItem(itemId, checked) {
    setSelectedItemIds((current) => {
      if (checked) {
        return current.includes(itemId)
          ? current
          : [...current, itemId]
      }

      return current.filter((id) => id !== itemId)
    })
  }

  // Calculate points from selected items
  const selectedPoints = preview
    ? preview.items.reduce((totalPoints, item) => {
        return selectedItemIds.includes(item.id)
          ? totalPoints + (item.pointsPerItem || 0)
          : totalPoints
      }, 0)
    : 0

  // Confirm donation verification
  async function handleVerify(event) {
    event.preventDefault()

    if (!preview) {
      setResult({
        ok: false,
        text: 'Please preview the donation first.',
      })
      return
    }

    if (selectedItemIds.length === 0) {
      setResult({
        ok: false,
        text: 'Please select at least one accepted item.',
      })
      return
    }

    setResult(null)
    setChecking(true)

    try {
      const data = await api('/api/verify', {
        method: 'POST',
        body: JSON.stringify({
          verificationCode: preview.verificationCode,
          centerId: verifyCentre,
          acceptedItemIds: selectedItemIds,
        }),
      })

      setResult({
        ok: true,
        text: `Verified successfully. ${data.donorName} earned ${data.pointsAwarded} points for ${data.itemCount} accepted item(s). ${data.rejectedItemCount} item(s) returned to the donation basket.`,
      })

      // Clear verification form
      setPreview(null)
      setSelectedItemIds([])
      setCode('')
      setVerifyCentre('')

      // Refresh activity log and pending count
      await load()
    } catch (err) {
      if (!handleAuthError(err)) {
        setResult({
          ok: false,
          text: err.message,
        })
      }
    } finally {
      setChecking(false)
    }
  }

  // Cancel current preview
  function handleCancelPreview() {
    setPreview(null)
    setSelectedItemIds([])
    setResult(null)
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  )

  return (
    <div className="min-h-screen bg-green-50">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Donation verification form */}
        <form
          onSubmit={handlePreview}
          className="bg-white rounded-xl shadow p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-green-700">
                Verify a donation
              </h1>

              <p className="text-sm text-gray-600">
                Enter the donor's 6-digit verification code
                to inspect and verify the received items.
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-amber-600">
                {pendingCount}
              </p>

              <p className="text-xs text-gray-500">
                awaiting verification
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CodeInput
              value={code}
              onChange={(value) => {
                setCode(value)
                setPreview(null)
                setSelectedItemIds([])
              }}
            />

            <CentrePicker
              centres={centres}
              value={verifyCentre}
              onChange={setVerifyCentre}
              placeholder="Centre (older donations only)..."
              className="flex-1 min-w-56"
            />

            <button
              type="submit"
              disabled={
                previewLoading ||
                !/^\d{6}$/.test(code.trim())
              }
              className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {previewLoading
                ? 'Loading...'
                : 'Preview Donation'}
            </button>
          </div>

          {result && (
            <p
              className={`text-sm font-medium ${
                result.ok
                  ? 'text-green-700'
                  : 'text-red-600'
              }`}
            >
              {result.text}
            </p>
          )}
        </form>

        {/* Donation item preview */}
        {preview && (
          <form
            onSubmit={handleVerify}
            className="bg-white rounded-xl shadow p-6 space-y-4"
          >
            <div>
              <h2 className="text-lg font-bold text-green-700">
                Donation Items
              </h2>

              <p className="text-sm text-gray-600">
                Donor: {preview.donorName}
              </p>

              <p className="text-sm text-gray-600">
                Centre: {preview.centreName || 'Not specified'}
              </p>

              <p className="text-sm text-gray-500 mt-2">
                Select the items actually received by the
                donation centre. Unselected items will be
                returned to the donor's basket.
              </p>
            </div>

            {/* Item selection */}
            <div className="space-y-3">
              {preview.items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-green-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(event) =>
                      toggleItem(item.id, event.target.checked)
                    }
                    className="w-4 h-4 accent-green-600"
                  />

                  <div className="flex-1">
                    <p className="font-medium capitalize">
                      {item.category}
                    </p>

                    <p className="text-sm text-gray-500">
                      {item.pointsPerItem} points
                    </p>
                  </div>

                  {selectedItemIds.includes(item.id) && (
                    <span className="text-sm font-medium text-green-700">
                      Accepted
                    </span>
                  )}
                </label>
              ))}
            </div>

            {/* Selection summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Accepted items</span>
                <span className="font-medium">
                  {selectedItemIds.length}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Rejected items</span>
                <span className="font-medium">
                  {preview.items.length - selectedItemIds.length}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="font-medium">
                  Points to award
                </span>

                <span className="font-bold text-green-700">
                  {selectedPoints} points
                </span>
              </div>
            </div>

            {/* Verification buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  checking ||
                  selectedItemIds.length === 0
                }
                className="flex-1 bg-green-600 text-white rounded-lg py-3 font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {checking
                  ? 'Verifying...'
                  : 'Confirm Verification'}
              </button>

              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={checking}
                className="px-5 py-3 border rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Activity log */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800">
            Activity log
          </h2>

          {/* Search and filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
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
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setStatus(filter.value)
                    setPage(1)
                  }}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    status === filter.value
                      ? 'bg-green-600 text-white'
                      : 'bg-white border hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}

              <button
                type="button"
                onClick={load}
                className="text-sm bg-white border hover:bg-gray-50 rounded-lg px-3 py-2"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-600">{error}</p>
          )}

          {/* Donation table */}
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
                {donations.map((donation) => (
                  <tr
                    key={donation.id}
                    className="border-t"
                  >
                    <td className="px-4 py-3 font-mono tracking-widest">
                      {donation.code}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {donation.donor
                          ? donation.donor.name
                          : '-'}
                      </p>

                      {donation.donor && (
                        <p className="text-xs text-gray-500">
                          {donation.donor.email}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {donation.itemCount}
                    </td>

                    <td className="px-4 py-3">
                      {donation.totalPoints}
                    </td>

                    <td className="px-4 py-3">
                      {donation.centre
                        ? donation.centre.name
                        : '-'}
                    </td>

                    <td className="px-4 py-3">
                      {donation.verifiedBy
                        ? donation.verifiedBy.name
                        : '-'}
                    </td>

                    <td className="px-4 py-3">
                      {donation.status === 'verified' ? (
                        <span className="text-green-700 font-medium">
                          Verified
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(
                        donation.verifiedAt ||
                        donation.createdAt
                      )}
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

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              {loading
                ? 'Loading...'
                : `${total} donation(s)`}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  setPage((current) => current - 1)
                }
                className="px-3 py-1.5 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => current + 1)
                }
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
