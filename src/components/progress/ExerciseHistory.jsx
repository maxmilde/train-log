import { ChevronDown } from 'lucide-react'

export default function ExerciseHistory({ names, selected, onSelect, history }) {
  function weightLabel(entry) {
    if (entry.weight_type === 'bodyweight' || !entry.weight_kg) return 'Bodyweight'
    return entry.weight_type === 'double'
      ? `2×${entry.weight_kg}kg`
      : `${entry.weight_kg}kg`
  }

  function repsLabel(reps, weightType) {
    if (reps == null) return '—'
    return weightType === 'single' ? `${reps}/${reps}` : `${reps}`
  }

  function totalReps(sets) {
    return sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  }

  // Find personal bests across all history
  let maxTotalReps = 0
  let maxSingleSetReps = 0
  let bestVolumeEntry = null
  let bestSetEntry = null

  if (history.length > 0) {
    history.forEach(entry => {
      const sessionTotal = entry.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)
      const sessionMax = entry.sets.length > 0
        ? Math.max(...entry.sets.map(s => s.reps ?? 0))
        : 0
      if (sessionTotal > maxTotalReps) {
        maxTotalReps = sessionTotal
        bestVolumeEntry = entry
      }
      if (sessionMax > maxSingleSetReps) {
        maxSingleSetReps = sessionMax
        bestSetEntry = entry
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Exercise picker */}
      <div className="relative">
        <select
          value={selected}
          onChange={e => onSelect(e.target.value)}
          className="w-full appearance-none rounded-xl bg-gray-800 border border-gray-700
                     px-4 py-4 text-gray-100 text-base min-h-[52px]
                     focus:outline-none focus:border-green-500"
        >
          <option value="">Select an exercise…</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>

      {selected && history.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-12">No history for "{selected}"</p>
      )}

      {/* Personal best banner */}
      {bestVolumeEntry && (
        <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">Personal Bests</p>
          <div className="flex justify-between items-baseline">
            <p className="text-blue-200 text-sm">
              Max volume: <span className="font-bold">{maxTotalReps} reps</span>
            </p>
            <p className="text-blue-700 text-[10px]">{bestVolumeEntry.date}</p>
          </div>
          <div className="flex justify-between items-baseline">
            <p className="text-blue-200 text-sm">
              Best set: <span className="font-bold">{repsLabel(maxSingleSetReps, bestSetEntry?.weight_type)}</span>
            </p>
            <p className="text-blue-700 text-[10px]">{bestSetEntry?.date}</p>
          </div>
          {bestVolumeEntry.weight_kg && bestVolumeEntry.weight_type !== 'bodyweight' && (
            <p className="text-blue-600 text-xs">{weightLabel(bestVolumeEntry)}</p>
          )}
        </div>
      )}

      {/* History list */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider px-1">History</p>
          {[...history].reverse().map((entry, i) => (
            <div key={i} className="bg-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-100 font-medium">
                    {entry.sets.length} sets · {totalReps(entry.sets)} total reps
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{weightLabel(entry)}</p>
                </div>
                <p className="text-xs text-gray-600">{entry.date}</p>
              </div>

              {/* Set breakdown */}
              {entry.sets.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {entry.sets.map((s, si) => (
                    <span key={si} className="text-xs bg-gray-700 text-gray-300 rounded-md px-2 py-1">
                      {repsLabel(s.reps, entry.weight_type)} reps
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
