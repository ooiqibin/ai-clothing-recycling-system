import { useState } from 'react'

// A type-to-search box for choosing a donation centre.
// value = chosen centre id; onChange(id) is called when the choice changes.
// extraOptions = extra choices shown first, e.g. [{ id: '', name: 'All centres' }].
export default function CentrePicker({
  centres,
  value,
  onChange,
  placeholder = 'Search centres...',
  extraOptions = [],
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const options = [
    ...extraOptions,
    ...centres.map((c) => ({ id: c._id, name: c.name })),
  ]

  const selected = options.find((o) => o.id === value)
  const shownText = open ? text : selected ? selected.name : ''

  const needle = text.trim().toLowerCase()
  const matches = options.filter((o) => o.name.toLowerCase().includes(needle))
  const visible = matches.slice(0, 8)

  function choose(option) {
    onChange(option.id)
    setOpen(false)
    setText('')
  }

  return (
    <div className={`relative ${className}`}>
      <input
        value={shownText}
        placeholder={placeholder}
        onFocus={() => {
          setText('')
          setOpen(true)
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        className="w-full border rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {value && !open && (
        <button
          type="button"
          aria-label="Clear"
          onMouseDown={(e) => {
            e.preventDefault()
            onChange('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
      )}

      {open && (
        <ul className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow max-h-64 overflow-auto">
          {visible.map((o) => (
            <li
              key={o.id || 'all'}
              // mousedown (not click) so the box does not close before the choice registers
              onMouseDown={(e) => {
                e.preventDefault()
                choose(o)
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${
                o.id === value ? 'font-semibold text-green-700' : ''
              }`}
            >
              {o.name}
            </li>
          ))}

          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No centre found</li>
          )}

          {matches.length > visible.length && (
            <li className="px-3 py-2 text-xs text-gray-500 border-t">
              {matches.length - visible.length} more. Keep typing to narrow down.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}