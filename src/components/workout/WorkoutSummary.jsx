import { Trophy, Clock } from 'lucide-react'

export default function WorkoutSummary({ exercises, durationMinutes }) {
  if (!exercises || exercises.length === 0) return null

  // Group by (name, weight_type, effective_weight) so mixed-weight sessions
  // appear as separate rows: "2x24kg Long Cycle: 10" + "2x28kg Long Cycle: 6"
  const groups = []
  const groupMap = new Map()

  for (const ex of exercises) {
    if (!ex.exerciseName) continue
    const isBW = ex.weightType === 'bodyweight'
    for (const set of ex.sets) {
      const effectiveKg = isBW ? null : (set.weightKg ?? ex.weightKg)
      const key = `${ex.exerciseName}|${ex.weightType}|${effectiveKg ?? 'bw'}`

      if (!groupMap.has(key)) {
        const group = {
          exerciseName: ex.exerciseName,
          weightType: ex.weightType,
          weightKg: effectiveKg,
          totalReps: 0,
        }
        groupMap.set(key, group)
        groups.push(group)
      }
      groupMap.get(key).totalReps += (set.reps ?? 0)
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
