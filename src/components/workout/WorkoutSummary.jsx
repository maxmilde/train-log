import { Trophy, Clock } from 'lucide-react'

export default function WorkoutSummary({ exercises, complexes = [], durationMinutes }) {
  const hasWork = (exercises && exercises.length > 0) || (complexes && complexes.length > 0)
  if (!hasWork) return null

  // Group by (name, set's effective type, set's effective weight). Mixed sessions split into rows:
  // "1×24kg Long Cycle: 10" + "2×24kg Long Cycle: 5" + "2×28kg Long Cycle: 4".
  // Empty sets (reps null/0) are ignored.
  // Complex-linked exercises get a complex.rounds multiplier applied.
  const groups = []
  const groupMap = new Map()

  const addSet = (exerciseName, exWeightType, exWeightKg, set, extraMultiplier = 1) => {
    if (set.reps == null || set.reps === 0) return
    const exDefaultIsBW = exWeightType === 'bodyweight'
    const effType = set.weightType ?? exWeightType ?? 'single'
    const isBWSet = effType === 'bodyweight' || (exDefaultIsBW && set.weightKg == null)
    const effKg = isBWSet ? null : (set.weightKg ?? exWeightKg)
    const normType = isBWSet ? 'bodyweight' : effType
    const key = `${exerciseName}|${normType}|${effKg ?? 'bw'}`
    if (!groupMap.has(key)) {
      const group = { exerciseName, weightType: normType, weightKg: effKg, totalReps: 0 }
      groupMap.set(key, group)
      groups.push(group)
    }
    groupMap.get(key).totalReps += (set.reps ?? 0) * (set.rounds ?? 1) * extraMultiplier
  }

  // Top-level exercises
  for (const ex of exercises ?? []) {
    if (!ex.exerciseName) continue
    for (const set of ex.sets) addSet(ex.exerciseName, ex.weightType, ex.weightKg, set, 1)
  }
  // Complex-linked exercises: multiply each contribution by complex.rounds
  for (const cx of complexes ?? []) {
    const mult = cx.rounds ?? 1
    for (const ex of cx.exercises ?? []) {
      if (!ex.exerciseName) continue
      for (const set of ex.sets) addSet(ex.exerciseName, ex.weightType, ex.weightKg, set, mult)
    }
  }

  if (groups.length === 0) return null

  function formatGroupLabel(g) {
    if (g.weightType === 'bodyweight' || !g.weightKg) {
      return g.exerciseName
    }
    if (g.weightType === 'double') {
      return `2\u00d7${g.weightKg}kg ${g.exerciseName}`
    }
    return `${g.weightKg}kg ${g.exerciseName}`
  }

  function formatReps(g) {
    if (g.totalReps === 0) return '0'
    if (g.weightType === 'single') {
      return `${g.totalReps}/${g.totalReps}`
    }
    return `${g.totalReps}`
  }

  function formatDuration(mins) {
    if (!mins) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`
    return `${m} min`
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy size={14} className="text-yellow-500" />
        <span className="text-xs text-yellow-500 uppercase tracking-wider font-semibold">
          Session Summary
        </span>
      </div>

      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-300 truncate">{formatGroupLabel(g)}</span>
            <span className="text-sm text-gray-100 font-medium tabular-nums whitespace-nowrap">
              {formatReps(g)}
            </span>
          </div>
        ))}
      </div>

      {durationMinutes != null && durationMinutes > 0 && (
        <div className="pt-2 border-t border-gray-700 flex items-center gap-1.5">
          <Clock size={12} className="text-gray-500" />
          <span className="text-sm text-gray-400">
            Total time: {formatDuration(durationMinutes)}
          </span>
        </div>
      )}
    </div>
  )
}
