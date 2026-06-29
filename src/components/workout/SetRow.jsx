import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'

const WEIGHT_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]
const ROUNDS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function SetRow({
  set,
  setNumber,
  exerciseWeightType,   // 'single' | 'double' | 'bodyweight' (exercise default)
  exerciseWeightKg,     // exercise default weight (used when set.weightKg is null)
  onUpdate,
  onDelete,
}) {
  // Local state for reps — decoupled from parent while focused
  const [repsStr, setRepsStr] = useState(set.reps != null ? String(set.reps) : '')
  const [showWeightPicker, setShowWeightPicker] = useState(false)
  const [showRoundsPicker, setShowRoundsPicker] = useState(false)
  const repsFocused = useRef(false)
  const lastParentReps = useRef(set.reps)

  if (!repsFocused.current && set.reps !== lastParentReps.current) {
    lastParentReps.current = set.reps
    setRepsStr(set.reps != null ? String(set.reps) : '')
  }

  function handleRepsChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setRepsStr(raw)
  }
  function handleRepsFocus() { repsFocused.current = true }
  function handleRepsBlur() {
    repsFocused.current = false
    const val = repsStr.trim() === '' ? null : parseInt(repsStr, 10)
    lastParentReps.current = val
    if (val !== set.reps) onUpdate({ reps: val })
  }

  const isBW = exerciseWeightType === 'bodyweight'
  const effectiveType = set.weightType ?? exerciseWeightType ?? (isBW ? 'bodyweight' : 'single')
  const effectiveWeight = set.weightKg ?? exerciseWeightKg
  const setIsBWLoad = isBW && (effectiveWeight == null || effectiveType === 'bodyweight')
  const rounds = set.rounds ?? 1

  function handleSelectWeightedKg(weight) {
    setShowWeightPicker(false)
    if (isBW) {
      onUpdate({ weightKg: weight, weightType: 'single' })
    } else if (weight !== effectiveWeight) {
      onUpdate({ weightKg: weight })
    }
  }
  function handleSelectBW() {
    setShowWeightPicker(false)
    onUpdate({ weightKg: null, weightType: 'bodyweight' })
  }
  function handleToggleType(nextType) {
    if (nextType !== effectiveType) onUpdate({ weightType: nextType })
  }
  function handleSelectRounds(n) {
    setShowRoundsPicker(false)
    if (n !== rounds) onUpdate({ rounds: n })
  }

  const repsNum = repsStr.trim() === '' ? null : parseInt(repsStr, 10)

  // Chip label for the weight chip
  let chipLabel
  if (setIsBWLoad) chipLabel = 'BW'
  else if (effectiveWeight == null) chipLabel = '—'
  else chipLabel = effectiveType === 'double' ? `2×${effectiveWeight}` : `${effectiveWeight}`

  return (
    <div className="flex items-center gap-1.5">
      {/* Set number */}
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{setNumber}</span>

      {/* Reps input + rounds × badge */}
      <div className="flex-1 relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={repsStr}
          onChange={handleRepsChange}
          onFocus={handleRepsFocus}
          onBlur={handleRepsBlur}
          placeholder="Reps"
          className={`w-full rounded-lg bg-gray-900 border border-gray-700
                     pl-3 pr-8 py-2.5 text-gray-100 text-center text-base min-h-[44px]
                     focus:outline-none focus:border-green-500 transition-colors
                     ${effectiveType === 'single' && repsNum ? 'text-transparent' : ''}`}
        />
        {effectiveType === 'single' && repsNum != null && (
          <span className="absolute inset-y-0 left-3 right-8 flex items-center justify-center text-base text-gray-100 pointer-events-none">
            {repsNum}/{repsNum}
          </span>
        )}
        {/* Rounds badge — sits inside the reps cell, top-right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowRoundsPicker(v => !v) }}
          className={`absolute top-1/2 -translate-y-1/2 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors
            ${rounds > 1
              ? 'bg-green-700 text-white'
              : 'bg-gray-800 text-gray-600 active:text-gray-400'}`}
          aria-label="Set rounds"
        >
          ×{rounds}
        </button>
        {showRoundsPicker && (
          <>
            <button
              type="button"
              onClick={() => setShowRoundsPicker(false)}
              className="fixed inset-0 z-10 bg-transparent cursor-default"
              aria-label="Close rounds picker"
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700
                            rounded-lg shadow-xl py-1 max-h-56 overflow-y-auto min-w-[80px]">
              {ROUNDS_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSelectRounds(n)}
                  className={`block w-full text-left px-3 py-1.5 text-sm whitespace-nowrap
                    ${n === rounds ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
                >
                  ×{n} rounds
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 1×/2× toggle — only for non-BW exercises */}
      {!isBW && (
        <div className="flex rounded-md overflow-hidden border border-gray-700 flex-shrink-0">
          {['single', 'double'].map(wt => (
            <button
              key={wt}
              type="button"
              onClick={() => handleToggleType(wt)}
              className={`px-2 text-[10px] font-bold min-h-[44px] w-[22px] transition-colors
                ${effectiveType === wt
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-900 text-gray-500 active:text-gray-300'}`}
            >
              {wt === 'single' ? '1×' : '2×'}
            </button>
          ))}
        </div>
      )}

      {/* Weight chip */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowWeightPicker(v => !v)}
          className="px-2 rounded-md bg-gray-900 border border-gray-700
                     text-[11px] text-gray-300 min-h-[44px] w-[52px]
                     active:bg-gray-700 transition-colors"
          aria-label="Set weight"
        >
          {chipLabel}
          {!setIsBWLoad && chipLabel !== '—' && (
            <span className="text-[9px] text-gray-600 ml-0.5">kg</span>
          )}
        </button>
        {showWeightPicker && (
          <>
            <button
              type="button"
              onClick={() => setShowWeightPicker(false)}
              className="fixed inset-0 z-10 bg-transparent cursor-default"
              aria-label="Close weight picker"
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700
                            rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
              {isBW && (
                <button
                  type="button"
                  onClick={handleSelectBW}
                  className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                    ${setIsBWLoad ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
                >
                  BW
                </button>
              )}
              {WEIGHT_OPTIONS.map(w => {
                const selected = !setIsBWLoad && w === effectiveWeight
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSelectWeightedKg(w)}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                      ${selected ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
                  >
                    {isBW ? `+${w}kg` : `${w}kg`}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="p-2 text-gray-700 hover:text-red-400 active:text-red-500
                   min-h-[44px] min-w-[36px] flex items-center justify-center
                   transition-colors flex-shrink-0"
        aria-label="Delete set"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
