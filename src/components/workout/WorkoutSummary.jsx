import { Trophy, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { weightLabelFor, repsAreParSide } from '../../lib/utils'
import { exerciseTotalsForState } from '../../lib/workoutTemplates'

export default function WorkoutSummary({ exercises, complexes = [], durationMinutes, templateInfo }) {
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
    return `${weightLabelFor(g.weightType, g.weightKg)} ${g.exerciseName}`
  }

  function formatReps(g) {
    if (g.totalReps === 0) return '0'
    // Per-side "X/X" only for kettlebell singles — not for the 10kg vest.
    if (repsAreParSide(g.weightType)) {
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

      {templateInfo?.sessions > 0 && (
        <BestComparison
          name={templateInfo.name}
          bestTotals={templateInfo.bestTotals}
          fastest={templateInfo.fastest}
          durationMinutes={durationMinutes}
          exercises={exercises}
          complexes={complexes}
          formatDuration={formatDuration}
        />
      )}
    </div>
  )
}

// Per-exercise total reps today vs that exercise's best session of this saved workout
// (the same numbers the grey targets came from), plus time vs the quickest session.
// No workout-wide total: exercises are compared one by one.
function BestComparison({ name, bestTotals, fastest, durationMinutes, exercises, complexes, formatDuration }) {
  const today = exerciseTotalsForState(exercises, complexes)

  const keys = [...new Set([...bestTotals.keys(), ...today.keys()])]
  const rows = keys
    .map(k => ({
      name: today.get(k)?.name ?? bestTotals.get(k)?.name,
      now: today.get(k)?.reps ?? 0,
      before: bestTotals.get(k)?.reps ?? 0,
    }))
    .filter(r => r.now > 0 || r.before > 0)

  return (
    <div className="pt-3 border-t border-gray-700 space-y-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
        vs best “{name}”
      </p>
      {rows.map((r, i) => (
        <DeltaRow key={i} label={r.name} now={r.now} before={r.before} />
      ))}
      {fastest != null && durationMinutes > 0 && (
        <div className="pt-2 border-t border-gray-700/60">
          <DeltaRow
            label="Time"
            now={durationMinutes}
            before={fastest}
            lowerIsBetter
            format={formatDuration}
          />
        </div>
      )}
    </div>
  )
}

// lowerIsBetter flips the colours and arrows (less time = progress)
function DeltaRow({ label, now, before, bold = false, lowerIsBetter = false, format = (n) => n }) {
  const diff = now - before
  const pct = before > 0 ? Math.round((diff / before) * 100) : null
  const better = lowerIsBetter ? diff < 0 : diff > 0
  const worse = lowerIsBetter ? diff > 0 : diff < 0
  const Icon = better ? TrendingUp : worse ? TrendingDown : Minus
  const tone = better ? 'text-green-400' : worse ? 'text-red-400' : 'text-gray-500'
  const diffStr = lowerIsBetter ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${format(Math.abs(diff)) ?? 0}` : `${diff > 0 ? '+' : ''}${diff}`
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm truncate ${bold ? 'text-gray-100 font-semibold' : 'text-gray-300'}`}>{label}</span>
      <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
        <span className={`text-sm ${bold ? 'text-gray-100 font-semibold' : 'text-gray-100'}`}>{format(now)}</span>
        <span className="text-[11px] text-gray-500">/ {format(before)}</span>
        <span className={`text-[11px] flex items-center gap-0.5 min-w-[4.5rem] justify-end ${tone}`}>
          <Icon size={11} />
          {diffStr}{pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
        </span>
      </span>
    </div>
  )
}
