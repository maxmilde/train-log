import { useState } from 'react'
import { X } from 'lucide-react'
import BodyMap from './BodyMap'
import { useMuscles } from '../../context/MuscleContext'
import {
  AREAS, MUSCLE_GROUPS, LEVELS, LEVEL_LABEL, LEVEL_WEIGHT, looksLikeCombo,
} from '../../lib/muscles'

// Chip colours per level, strongest first (matches the heat scale: red = most)
const LEVEL_CHIP = {
  primary:    'bg-red-600 text-white border-red-500',
  secondary:  'bg-orange-500 text-gray-900 border-orange-400',
  tertiary:   'bg-yellow-500 text-gray-900 border-yellow-400',
  quaternary: 'bg-yellow-200 text-gray-900 border-yellow-100',
}

// Pick which muscles an exercise trains. Tapping a muscle cycles
// off → 1st → 2nd → 3rd → 4th → off. `isNew` shows "Later" instead of "Cancel".
export default function MuscleEditor({ name, isNew = false, onClose }) {
  const { lookup, save } = useMuscles()
  const initial = lookup(name)
  const [levels, setLevels] = useState(() => {
    const map = new Map()
    for (const level of LEVELS) for (const id of initial?.[level] ?? []) map.set(id, level)
    return map
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function cycle(id) {
    setLevels(prev => {
      const next = new Map(prev)
      const i = LEVELS.indexOf(prev.get(id))
      if (i === LEVELS.length - 1) next.delete(id)
      else next.set(id, LEVELS[i + 1])
      return next
    })
  }

  async function submit(notCounted) {
    const classification = { notCounted }
    for (const level of LEVELS) {
      classification[level] = notCounted ? [] : MUSCLE_GROUPS.filter(g => levels.get(g.id) === level).map(g => g.id)
    }
    setBusy(true)
    setError(null)
    try {
      await save(name, classification)
      onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  // Live preview: each muscle shaded by its level's weight
  const preview = new Map([...levels].map(([id, level]) => [id, LEVEL_WEIGHT[level]]))
  const combo = looksLikeCombo(name)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-800 gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-200 truncate">{name}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isNew ? 'New exercise: which muscles does it train?' : 'Which muscles does it train?'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 active:text-gray-300" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="mx-auto max-w-[200px]">
            <BodyMap sets={preview} onSelect={cycle} />
          </div>
          <p className="text-[11px] text-gray-500 text-center">
            Tap a muscle to cycle 1st → 2nd → 3rd → 4th → off
          </p>
          <div className="flex justify-center gap-1.5">
            {LEVELS.map(level => (
              <span key={level} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${LEVEL_CHIP[level]}`}>
                {LEVEL_LABEL[level]} ×{LEVEL_WEIGHT[level]}
              </span>
            ))}
          </div>

          {AREAS.map(area => (
            <div key={area.id}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{area.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.filter(g => g.area === area.id).map(g => {
                  const level = levels.get(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => cycle(g.id)}
                      className={`text-xs rounded-lg px-2.5 py-1.5 border transition-colors
                        ${level ? LEVEL_CHIP[level] : 'bg-gray-800 text-gray-400 border-gray-700 active:bg-gray-700'}`}
                    >
                      {g.label}
                      {level && <span className="ml-1 text-[10px] font-bold opacity-80">{LEVEL_LABEL[level]}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 space-y-2">
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="button"
            disabled={busy || levels.size === 0}
            onClick={() => submit(false)}
            className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold
                       active:bg-green-500 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submit(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border disabled:opacity-50
                ${combo
                  ? 'border-purple-700 text-purple-300 bg-purple-950/40'
                  : 'border-gray-700 text-gray-400'}`}
            >
              Combo, don't count{combo ? ' (has a number)' : ''}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-medium border border-gray-700 text-gray-400"
            >
              {isNew ? 'Later' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
