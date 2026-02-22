import { ChevronDown } from 'lucide-react'

export default function ExerciseHistory({ names, selected, onSelect, history }) {
  function weightLabel(entry) {
    if (!entry.weight_kg) return ''
    return entry.weight_type === 'double'
      ? `2×${entry.weight_kg}kg`
      : `${entry.weight_kg}kg`
  }

  function totalReps(sets) {
    return sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  }

  // Find personal best
  let pb = null
  if (history.length > 0) {
    let bestVol = -1
    history.forEach(entry => {
      const maxReps = entry.sets.length > 0
        ? Math.max(...entry.sets.map(s => s.reps ?? 0))
        : 0
      const vol = maxReps * (entry.weight_kg ?? 0)
      if (vol > bestVol) {
        bestVol = vol
        pb = entry
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
      {pb && (
        <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3">
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-1">Personal Best</p>
          <p className="text-blue-200 text-sm">
            {pb.sets.length} sets · {Math.max(...pb.sets.map(s => s.reps ?? 0))} reps · {weightLabel(pb)}
          </p>
          <p className="text-blue-600 text-xs mt-0.5">{pb.date}</p>
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
                      {s.reps ?? '—'} reps
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
