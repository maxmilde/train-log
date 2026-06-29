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
    // Total respects the rounds multiplier on each set
    return sets.reduce((a, s) => a + (s.reps ?? 0) * (s.rounds ?? 1), 0)
  }

  // PB buckets keyed by (per-set effective type, per-set effective weight).
  // Empty sets are pre-filtered upstream in getExerciseHistory.
  const pbBuckets = new Map()
  if (history.length > 0) {
    history.forEach(entry => {
      const exDefaultIsBW = entry.weight_type === 'bodyweight'
      const setsByBucket = new Map()
      entry.sets.forEach(s => {
        const t = s.effective_weight_type ?? entry.weight_type
        const isBWSet = t === 'bodyweight' || (exDefaultIsBW && s.weight_kg == null)
        const normType = isBWSet ? 'bodyweight' : t
        const w = isBWSet ? null : (s.effective_weight_kg ?? entry.weight_kg)
        const key = `${normType}|${w ?? 'bw'}`
        if (!setsByBucket.has(key)) {
          setsByBucket.set(key, { sets: [], weight_kg: w, weight_type: normType })
        }
        setsByBucket.get(key).sets.push(s)
      })
      for (const [key, group] of setsByBucket) {
        // Session total = sum(reps * rounds); best single set = max(reps) (per-round, not multiplied)
        const sessionTotal = group.sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.rounds ?? 1), 0)
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

              {/* Set breakdown — show label when type/weight differs from previous set */}
              {entry.sets.length > 0 && (() => {
                const exDefaultIsBW = entry.weight_type === 'bodyweight'
                const effLabel = (s) => {
                  const t = s.effective_weight_type ?? entry.weight_type
                  if (t === 'bodyweight' || (exDefaultIsBW && s.weight_kg == null)) return 'BW'
                  const w = s.effective_weight_kg ?? entry.weight_kg
                  return t === 'double' ? `2×${w}` : `${w}`
                }
                const effReps = (s) => {
                  const t = s.effective_weight_type ?? entry.weight_type
                  return repsLabel(s.reps, t)
                }
                let prev = null
                return (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {entry.sets.map((s, si) => {
                      const lbl = effLabel(s)
                      const show = lbl !== prev
                      prev = lbl
                      const r = s.rounds ?? 1
                      return (
                        <span key={si} className="text-xs bg-gray-700 text-gray-300 rounded-md px-2 py-1">
                          {show && <span className="text-blue-400 mr-1">@{lbl}</span>}
                          {effReps(s)} reps
                          {r > 1 && <span className="text-green-400 ml-1">×{r}</span>}
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
