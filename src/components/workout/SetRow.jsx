import { useState, useRef } from 'react'
import { Trash2, Minus, Plus } from 'lucide-react'
import { isVestWeight } from '../../lib/utils'

const WEIGHT_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

export default function SetRow({
  set,
  setNumber,
  exerciseWeightType,   // exercise default — used only as initial fallback
  exerciseWeightKg,     // exercise default — used only as initial fallback
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

  // Effective values (with exercise-level fallbacks)
  const effectiveType = set.weightType ?? exerciseWeightType ?? 'single'
  const effectiveWeight = set.weightKg ?? exerciseWeightKg ?? null
  // This individual SET is "bodyweight" if its type says so, or if it has no weight
  const setIsBW = effectiveType === 'bodyweight' || effectiveWeight == null
  // 10kg = weight vest: plain reps, no 1×/2× toggle
  const isVest = !setIsBW && isVestWeight(effectiveWeight)
  const rounds = set.rounds ?? 1

  function handleSelectWeight(weight) {
    setShowWeightPicker(false)
    // Vest weight is always 'single'. Otherwise keep current type (default single from BW).
    const nextType = isVestWeight(weight)
      ? 'single'
      : (effectiveType === 'bodyweight' || effectiveType == null) ? 'single' : effectiveType
    onUpdate({ weightKg: weight, weightType: nextType })
  }
  function handleSelectBW() {
    setShowWeightPicker(false)
    onUpdate({ weightKg: null, weightType: 'bodyweight' })
  }
  function handleToggleType(nextType) {
    if (nextType !== effectiveType) onUpdate({ weightType: nextType })
  }

  function bumpRounds(delta) {
    const next = Math.max(1, Math.min(999, rounds + delta))
    if (next !== rounds) onUpdate({ rounds: next })
  }
  function handleRoundsInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') return
    const n = Math.max(1, Math.min(999, parseInt(raw, 10)))
    if (n !== rounds) onUpdate({ rounds: n })
  }

  const repsNum = repsStr.trim() === '' ? null : parseInt(repsStr, 10)

  // Chip label
  let chipLabel
  if (setIsBW) chipLabel = 'BW'
  else chipLabel = effectiveType === 'double' ? `2×${effectiveWeight}` : `${effectiveWeight}`

  return (
    <div className="flex items-center gap-1.5">
      {/* Set number */}
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{setNumber}</span>

      {/* Reps input + rounds badge inside */}
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
                     pl-3 pr-10 py-2.5 text-gray-100 text-center text-base min-h-[44px]
                     focus:outline-none focus:border-green-500 transition-colors
                     ${effectiveType === 'single' && !isVest && repsNum ? 'text-transparent' : ''}`}
        />
        {effectiveType === 'single' && !isVest && repsNum != null && (
          <span className="absolute inset-y-0 left-3 right-10 flex items-center justify-center text-base text-gray-100 pointer-events-none">
            {repsNum}/{repsNum}
          </span>
        )}
        {/* Rounds badge */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowRoundsPicker(v => !v) }}
          className={`absolute top-1/2 -translate-y-1/2 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors min-w-[28px]
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
                            rounded-lg shadow-xl p-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => bumpRounds(-1)}
                className="h-8 w-8 rounded-md bg-gray-800 active:bg-gray-700
                           flex items-center justify-center text-gray-200"
                aria-label="Decrease rounds"
              >
                <Minus size={14} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={rounds}
                onChange={handleRoundsInput}
                className="w-12 bg-gray-800 border border-gray-700 rounded-md
                           px-2 py-1 text-center text-sm text-gray-100
                           focus:outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => bumpRounds(1)}
                className="h-8 w-8 rounded-md bg-gray-800 active:bg-gray-700
                           flex items-center justify-center text-gray-200"
                aria-label="Increase rounds"
              >
                <Plus size={14} />
              </button>
              <span className="text-[10px] text-gray-500 ml-1">rounds</span>
            </div>
          </>
        )}
      </div>

      {/* 1×/2× toggle — hidden when BW or vest (10kg) */}
      {!setIsBW && !isVest ? (
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
      ) : (
        // Reserve column space so rows stay aligned with the header
        <div className="w-[46px] flex-shrink-0" />
      )}

      {/* Weight chip — always includes BW option in the picker */}
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
          {!setIsBW && (
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
              <button
                type="button"
                onClick={handleSelectBW}
                className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                  ${setIsBW ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
              >
                BW
              </button>
              {WEIGHT_OPTIONS.map(w => {
                const selected = !setIsBW && w === effectiveWeight
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSelectWeight(w)}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                      ${selected ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
                  >
                    {w}kg
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
