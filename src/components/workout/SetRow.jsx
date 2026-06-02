import { useState, useRef } from 'react'
import { secondsToTimeStr, timeStrToSeconds } from '../../lib/utils'
import { Trash2 } from 'lucide-react'

const WEIGHT_OPTIONS = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

export default function SetRow({
  set,
  setNumber,
  isSingleKB,
  weightType,           // 'single' | 'double' | 'bodyweight'
  exerciseWeightKg,     // exercise's default weight (used when set.weightKg is null)
  onUpdate,
  onDelete,
}) {
  // Local state for reps — fully decoupled from parent while focused
  const [repsStr, setRepsStr] = useState(set.reps != null ? String(set.reps) : '')
  const [timeStr, setTimeStr] = useState(secondsToTimeStr(set.durationSeconds) || '')
  const [showWeightPicker, setShowWeightPicker] = useState(false)
  const repsFocused = useRef(false)
  const timeFocused = useRef(false)
  // Track the last parent value we synced from
  const lastParentReps = useRef(set.reps)
  const lastParentTime = useRef(set.durationSeconds)

  // Sync from parent ONLY when not focused AND parent value actually changed
  if (!repsFocused.current && set.reps !== lastParentReps.current) {
    lastParentReps.current = set.reps
    setRepsStr(set.reps != null ? String(set.reps) : '')
  }
  if (!timeFocused.current && set.durationSeconds !== lastParentTime.current) {
    lastParentTime.current = set.durationSeconds
    setTimeStr(secondsToTimeStr(set.durationSeconds) || '')
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
    if (val !== set.reps) {
      onUpdate({ reps: val })
    }
  }

  function handleTimeFocus() { timeFocused.current = true }

  function handleTimeBlur() {
    timeFocused.current = false
    const secs = timeStrToSeconds(timeStr)
    lastParentTime.current = secs
    if (secs !== set.durationSeconds) {
      onUpdate({ durationSeconds: secs })
    }
  }

  function handleWeightSelect(weight) {
    setShowWeightPicker(false)
    if (weight !== (set.weightKg ?? exerciseWeightKg)) {
      onUpdate({ weightKg: weight })
    }
  }

  const repsNum = repsStr.trim() === '' ? null : parseInt(repsStr, 10)
  const effectiveWeight = set.weightKg ?? exerciseWeightKg
  const showWeightChip = weightType !== 'bodyweight'
  const weightLabel = weightType === 'double'
    ? `2×${effectiveWeight}`
    : `${effectiveWeight}`

  return (
    <div className="flex items-center gap-1.5">
      {/* Set number */}
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{setNumber}</span>

      {/* Reps */}
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
                     px-3 py-2.5 text-gray-100 text-center text-base min-h-[44px]
                     focus:outline-none focus:border-green-500 transition-colors
                     ${isSingleKB && repsNum ? 'text-transparent' : ''}`}
        />
        {isSingleKB && repsNum != null && (
          <span className="absolute inset-0 flex items-center justify-center text-base text-gray-100 pointer-events-none">
            {repsNum}/{repsNum}
          </span>
        )}
      </div>

      {/* Per-set weight chip */}
      {showWeightChip && (
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowWeightPicker(v => !v)}
            className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700
                       text-[11px] text-gray-300 min-h-[44px] min-w-[44px]
                       active:bg-gray-700 transition-colors"
            aria-label="Set weight"
          >
            {weightLabel}
            <span className="text-[9px] text-gray-600 ml-0.5">kg</span>
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
                              rounded-lg shadow-xl py-1 max-h-56 overflow-y-auto">
                {WEIGHT_OPTIONS.map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleWeightSelect(w)}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                      ${w === effectiveWeight
                        ? 'bg-green-700 text-white'
                        : 'text-gray-200 active:bg-gray-700'}`}
                  >
                    {weightType === 'double' ? `2×${w}kg` : `${w}kg`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Optional time */}
      <input
        type="text"
        value={timeStr}
        onChange={e => setTimeStr(e.target.value)}
        onFocus={handleTimeFocus}
        onBlur={handleTimeBlur}
        placeholder="0:00"
        className="w-12 rounded-lg bg-gray-900 border border-gray-700
                   px-1 py-2.5 text-gray-500 text-center text-sm min-h-[44px]
                   focus:outline-none focus:border-gray-500 transition-colors flex-shrink-0"
      />

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
