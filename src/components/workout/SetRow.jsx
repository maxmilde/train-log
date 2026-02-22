import { useState, useEffect } from 'react'
import { secondsToTimeStr, timeStrToSeconds } from '../../lib/utils'
import { Trash2 } from 'lucide-react'

export default function SetRow({ set, setNumber, onUpdate, onDelete }) {
  const [timeStr, setTimeStr] = useState(secondsToTimeStr(set.durationSeconds) || '')

  // Sync if parent changes
  useEffect(() => {
    setTimeStr(secondsToTimeStr(set.durationSeconds) || '')
  }, [set.durationSeconds])

  function handleTimeBlur() {
    const secs = timeStrToSeconds(timeStr)
    if (secs !== set.durationSeconds) {
      onUpdate({ durationSeconds: secs })
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Set number */}
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{setNumber}</span>

      {/* Reps */}
      <input
        type="number"
        inputMode="numeric"
        value={set.reps ?? ''}
        onChange={e => onUpdate({ reps: e.target.value === '' ? null : Number(e.target.value) })}
        placeholder="Reps"
        className="flex-1 rounded-lg bg-gray-900 border border-gray-700
                   px-3 py-2.5 text-gray-100 text-center text-base min-h-[44px]
                   focus:outline-none focus:border-green-500 transition-colors"
      />

      {/* Optional time */}
      <input
        type="text"
        value={timeStr}
        onChange={e => setTimeStr(e.target.value)}
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
