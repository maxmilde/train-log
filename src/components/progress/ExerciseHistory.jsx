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

  // Personal Bests — computed per (weight_type, effective_weight) bucket so 1×24 and 2×24 don't merge.
  // Bucket key examples: "single|24", "double|24", "bodyweight|null"
  const pbBuckets = new Map()
  if (history.length > 0) {
    history.forEach(entry => {
      // Group sets within this entry by their effective weight
      const setsByWeight = new Map()
      entry.sets.forEach(s => {
        const w = entry.weight_type === 'bodyweight' ? null : (s.effective_weight_kg ?? entry.weight_kg)
        const key = `${entry.weight_type}|${w}`
        if (!setsByWeight.has(key)) setsByWeight.set(key, { sets: [], weight_kg: w, weight_type: entry.weight_type })
        setsByWeight.get(key).sets.push(s)
      })
      for (const [key, group] of setsByWeight) {
        const sessionTotal = group.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)
        const sessionMax = Math.max(0, ...group.sets.map(s => s.reps ?? 0))
        const existing = pbBuckets.get(key) ?? {
          weight_kg: group.weight_kg,
          weight_type: group.weight_type,
          maxTotal: 0, totalDate: null,
          maxSet: 0, setDate: null,
        }
        if (sessionTotal > existing.maxTotal) { existing.maxTotal = sessionTotal; existing.totalDate = entry.date }
        if (sessionMax   > existing.maxSet)   { existing.maxSet   = sessionMax;   existing.setDate   = entry.date }
        pbBuckets.set(key, existing)
      }
    })
  }
  // Sort PB buckets so heavier weights appear first
  const pbList = [...pbBuckets.values()].sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0))

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

      {/* Personal best banner — one section per weight bucket */}
      {pbList.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold px-1">Personal Bests</p>
          {pbList.map((pb, idx) => (
            <div key={idx} className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-blue-300 text-xs font-semibold">{weightLabel(pb)}</p>
              <div className="flex justify-between items-baseline">
                <p className="text-blue-200 text-sm">
                  Max volume: <span className="font-bold">{pb.maxTotal} reps</span>
                </p>
                <p className="text-blue-700 text-[10px]">{pb.totalDate}</p>
              </div>
              <div className="flex justify-between items-baseline">
                <p className="text-blue-200 text-sm">
                  Best set: <span className="font-bold">{repsLabel(pb.maxSet, pb.weight_type)}</span>
                </p>
                <p className="text-blue-700 text-[10px]">{pb.setDate}</p>
              </div>
            </div>
          ))}
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

              {/* Set breakdown — show weight when it differs from the previous set */}
              {entry.sets.length > 0 && (() => {
                let prev = entry.weight_kg
                const isBW = entry.weight_type === 'bodyweight'
                const fmtW = (w) => entry.weight_type === 'double' ? `2×${w}` : `${w}`
                return (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {entry.sets.map((s, si) => {
                      const eff = s.effective_weight_kg ?? entry.weight_kg
                      const showW = !isBW && eff !== prev
                      prev = eff
                      return (
                        <span key={si} className="text-xs bg-gray-700 text-gray-300 rounded-md px-2 py-1">
                          {showW && <span className="text-blue-400 mr-1">@{fmtW(eff)}</span>}
                          {repsLabel(s.reps, entry.weight_type)} reps
                        </span>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
