import { useState, useRef } from 'react'
import { secondsToTimeStr, timeStrToSeconds } from '../../lib/utils'
import { Trash2 } from 'lucide-react'

export default function SetRow({ set, setNumber, isSingleKB, onUpdate, onDelete }) {
  // Local state for reps — fully decoupled from parent while focused
  const [repsStr, setRepsStr] = useState(set.reps != null ? String(set.reps) : '')
  const [timeStr, setTimeStr] = useState(secondsToTimeStr(set.durationSeconds) || '')
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
    // Only allow digits (type="text" with inputMode="numeric")
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setRepsStr(raw)
  }

  function handleRepsFocus() {
    repsFocused.current = true
  }

  function handleRepsBlur() {
    repsFocused.current = false
    const val = repsStr.trim() === '' ? null : parseInt(repsStr, 10)
    lastParentReps.current = val
    if (val !== set.reps) {
      onUpdate({ reps: val })
    }
  }

  function handleTimeFocus() {
    timeFocused.current = true
  }

  function handleTimeBlur() {
    timeFocused.current = false
    const secs = timeStrToSeconds(timeStr)
    lastParentTime.current = secs
    if (secs !== set.durationSeconds) {
      onUpdate({ durationSeconds: secs })
    }
  }

  const repsNum = repsStr.trim() === '' ? null : parseInt(repsStr, 10)

  return (
    <div className="flex items-center gap-2">
      {/* Set number */}
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{setNumber}</span>

      {/* Reps — use type="text" + inputMode="numeric" to avoid mobile number input quirks */}
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

      {/* Optional time */}
      <input
        type="text"
        value={timeStr}
        onChange={e => setTimeStr(e.target.value)}
        onFocus={handleTimeFocus}
        onBlur={handleTimeBlur}
        placeholder="0:00"
        className="w-14 rounded-lg bg-gray-900 border border-gray-700
                   px-1 py-2.5 text-gray-500 text-center text-sm min-h-[44px]
                   focus:outline-none focus:border-gray-500 transition-colors"
      />

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="p-2 text-gray-700 hover:text-red-400 active:text-red-500
                   min-h-[44px] min-w-[36px] flex items-center justify-center
                   transition-colors"
        aria-label="Delete set"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
