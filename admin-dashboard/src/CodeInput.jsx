import { useRef } from 'react'

const LENGTH = 6

// Six separate boxes for a 6-digit code. value is a string like "123".
export default function CodeInput({ value, onChange }) {
  const boxes = useRef([])
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || '')

  function focusBox(index) {
    boxes.current[Math.max(0, Math.min(index, LENGTH - 1))]?.focus()
  }

  function handleChange(index, event) {
    const typed = String(event.nativeEvent.data ?? event.target.value).replace(/\D/g, '')
    if (!typed) return

    // Always add to the end, so the code never has gaps.
    const start = Math.min(index, value.length)
    const next = (value.slice(0, start) + typed).slice(0, LENGTH)
    onChange(next)
    focusBox(next.length)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value.length === 0) return
      onChange(value.slice(0, -1))
      focusBox(value.length - 1)
    } else if (event.key === 'ArrowLeft') {
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      focusBox(index + 1)
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    onChange(pasted)
    focusBox(pasted.length)
  }

  return (
    <div className="flex gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (boxes.current[i] = el)}
          value={digit}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-12 text-center text-xl font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      ))}
    </div>
  )
}