import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getWorkoutFeed, copyWorkoutToDate } from '../../lib/db'
import { toDateStr, weightLabelFor, effectiveSetWeight, isWorkoutDay, dayDifficulty, difficultyFor } from '../../lib/utils'
import { ChevronDown, ChevronUp, Copy } from 'lucide-react'

const PAGE_SIZE = 20

export default function WorkoutFeed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [hasMore, setHasMore]   = useState(true)
  const [expanded, setExpanded] = useState({})
  const [copyingId, setCopyingId] = useState(null)
  const loaderRef = useRef(null)

  const handleCopy = useCallback(async (workout, e) => {
    e.stopPropagation()
    if (!user) return
    const today = toDateStr(new Date())
    const ok = window.confirm(
      `Copy ${workout.workout_exercises?.length || 0} exercise${workout.workout_exercises?.length !== 1 ? 's' : ''} from ${workout.date} to today?`
    )
    if (!ok) return
    setCopyingId(workout.id)
    try {
      await copyWorkoutToDate(user.id, workout.id, today)
      navigate('/workout')
    } catch (err) {
      alert('Copy failed: ' + err.message)
    } finally {
      setCopyingId(null)
    }
  }, [user, navigate])

  const loadMore = useCallback(async (reset = false) => {
    if (!user) return
    const offset = reset ? 0 : workouts.length
    try {
      const data = await getWorkoutFeed(user.id, { limit: PAGE_SIZE, offset })
      if (reset) {
        setWorkouts(data)
      } else {
        setWorkouts(prev => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) {
      console.error('Feed load error:', e)
    } finally {
      setLoading(false)
    }
  }, [user, workouts.length])

  useEffect(() => {
    if (user) loadMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loading) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading && workouts.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (workouts.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-12">No submitted workouts yet</p>
  }

  return (
    <div className="space-y-3">
      {workouts.map(w => {
        // Hide orphan exercises (nothing logged) so they don't show as '0 reps' rows
        const allExercises = (w.workout_exercises ?? []).filter(ex =>
          (ex.exercise_sets ?? []).some(s => s.reps != null)
        )
        // Split top-level exercises from complex-linked ones
        const topLevelExercises = allExercises.filter(ex => !ex.complex_id)
        const complexes = (w.workout_complexes ?? []).map(cx => ({
          ...cx,
          exercises: allExercises
            .filter(ex => ex.complex_id === cx.id)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        })).filter(cx => cx.exercises.length > 0)
        const exercises = topLevelExercises  // keep var name for below
        const isOpen = expanded[w.id]
        const dateObj = new Date(w.date + 'T00:00:00')
        const dateLabel = dateObj.toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        })
        const totalExercises = exercises.length + complexes.length
        const isWorkout = isWorkoutDay(w)
        const diff = difficultyFor(dayDifficulty(w))

        return (
          <button
            key={w.id}
            type="button"
            onClick={() => toggleExpand(w.id)}
            className="w-full text-left bg-gray-800 rounded-xl px-4 py-3 active:bg-gray-750 transition-colors"
          >
            {/* Summary row */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-100">{dateLabel}</p>
                  {/* Difficulty badge in the same colour as the heatmap; unrated shows 'Workout' */}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    diff ? `${diff.bg} ${diff.onBg}` : 'bg-green-900/50 text-green-400'
                  }`}>
                    {diff ? diff.label : 'Workout'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
                  {w.duration_minutes ? ` · ${w.duration_minutes} min` : ''}
                </p>
                {/* One-line preview only while collapsed; the full note shows when expanded */}
                {w.notes && !isOpen && (
                  <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">{w.notes}</p>
                )}
              </div>
              {isOpen ? (
                <ChevronUp size={16} className="text-gray-600 mt-1 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-600 mt-1 flex-shrink-0" />
              )}
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2.5">
                {w.notes && (
                  <p className="text-xs text-gray-400 italic">{w.notes}</p>
                )}
                {exercises.map((ex, i) => {
                  const sets = (ex.exercise_sets ?? [])
                    .slice()
                    .filter(s => s.reps != null)  // skip empty sets
                    .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                  // Total reps respects per-set rounds
                  const totalReps = sets.reduce((a, s) => a + (s.reps ?? 0) * (s.rounds ?? 1), 0)
                  // Effective per-set label: respects per-set weight_type + weight_kg overrides
                  const effLabel = (s) => {
                    const { type, kg } = effectiveSetWeight(ex.weight_type, ex.weight_kg, s.weight_type, s.weight_kg)
                    return weightLabelFor(type, kg)
                  }
                  // Weight badge leads the row and reappears only where the weight changes:
                  // [2×24kg] 5 5 5 [2×28kg] 4 4 = 23 reps
                  let prevLabel = null

                  return (
                    <div key={i}>
                      <p className="text-sm text-gray-200 font-medium">
                        {ex.exercise_name || 'Unnamed'}
                      </p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {sets.map((s, si) => {
                          const lbl = effLabel(s)
                          const showLabel = lbl !== prevLabel
                          prevLabel = lbl
                          const r = s.rounds ?? 1
                          return (
                            <span key={si} className="contents">
                              {/* Weight change marker is its own badge, never inside the reps chip */}
                              {showLabel && (
                                <span className="text-[11px] text-blue-400 bg-blue-950/40 border border-blue-900/50 rounded-md px-1.5 py-0.5">
                                  {lbl}
                                </span>
                              )}
                              <span className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-1.5 py-0.5">
                                {s.reps ?? '—'}
                                {r > 1 && <span className="text-gray-500">×{r}</span>}
                              </span>
                            </span>
                          )
                        })}
                        <span className="text-[11px] text-gray-500 ml-1">
                          = {totalReps} reps
                        </span>
                      </div>
                    </div>
                  )
                })}
                {/* Complex blocks */}
                {complexes.map((cx, ci) => {
                  const rounds = cx.rounds ?? 1
                  return (
                    <div key={`cx-${ci}`} className="border border-purple-900/40 rounded-lg p-2">
                      <p className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold mb-1.5">
                        Complex × {rounds} round{rounds !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-2.5">
                        {cx.exercises.map((ex, ei) => {
                          const oneSet = (ex.exercise_sets ?? []).find(s => s.reps != null)
                          if (!oneSet) return null
                          const { type, kg } = effectiveSetWeight(ex.weight_type, ex.weight_kg, oneSet.weight_type, oneSet.weight_kg)
                          const lbl = weightLabelFor(type, kg)
                          const perRound = (oneSet.reps ?? 0) * (oneSet.rounds ?? 1)
                          const total = perRound * rounds
                          return (
                            // Same shape as a standalone exercise: name on top, then
                            // weight badge, reps chip and grey total.
                            <div key={ei}>
                              <p className="text-sm text-gray-200 font-medium">
                                {ex.exercise_name || 'Unnamed'}
                              </p>
                              <div className="flex gap-1.5 mt-1 flex-wrap items-baseline">
                                <span className="text-[11px] text-blue-400 bg-blue-950/40 border border-blue-900/50 rounded-md px-1.5 py-0.5">
                                  {lbl}
                                </span>
                                <span className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-1.5 py-0.5">
                                  {oneSet.reps}
                                  {rounds > 1 && <span className="text-gray-500">×{rounds}</span>}
                                </span>
                                <span className="text-[11px] text-gray-500 ml-1">
                                  = {total} reps
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {/* Copy to today */}
                {isWorkout && (exercises.length > 0 || complexes.length > 0) && (
                  <div className="pt-2 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(w, e)}
                      disabled={copyingId === w.id}
                      className="w-full py-2.5 rounded-xl bg-gray-700 active:bg-gray-600
                                 text-sm text-gray-200 font-medium
                                 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Copy size={14} />
                      {copyingId === w.id ? 'Copying…' : 'Copy to today'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </button>
        )
      })}

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 rounded-full border-2 border-green-500 border-t-transparent" />
        </div>
      )}

      {!hasMore && workouts.length > 0 && (
        <p className="text-center text-xs text-gray-700 py-4">That's all your workouts</p>
      )}
    </div>
  )
}
