import { useState, useRef, useEffect } from 'react'

export default function ExerciseAutocomplete({ value, options, onChange, className = '' }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen]   = useState(false)
  const containerRef      = useRef(null)

  // Sync when parent value changes
  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = query.length > 0
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(name) {
    setQuery(name)
    onChange(name)
    setOpen(false)
  }

  function handleBlur() {
    // Delay to let onMouseDown on options fire first
    setTimeout(() => {
      setOpen(false)
      if (query !== value) onChange(query)
    }, 150)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder="Exercise name…"
        className="w-full rounded-xl bg-gray-900 border border-gray-700
                   px-4 py-3 text-gray-100 text-base min-h-[44px]
                   focus:outline-none focus:border-green-500 transition-colors"
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1
                       bg-gray-800 border border-gray-700 rounded-xl
                       max-h-44 overflow-y-auto shadow-xl">
          {filtered.slice(0, 10).map(name => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={() => select(name)}
                className="w-full text-left px-4 py-3 text-sm text-gray-200
                           hover:bg-gray-700 active:bg-gray-600 min-h-[44px]
                           first:rounded-t-xl last:rounded-b-xl"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
