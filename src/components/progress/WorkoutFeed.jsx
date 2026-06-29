import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getWorkoutFeed, copyWorkoutToDate } from '../../lib/db'
import { toDateStr } from '../../lib/utils'
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
        const exercises = w.workout_exercises ?? []
        const isOpen = expanded[w.id]
        const dateObj = new Date(w.date + 'T00:00:00')
        const dateLabel = dateObj.toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        })
        const totalExercises = exercises.length
        const isWorkout = w.day_type === 'workout'

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
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isWorkout ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'
                  }`}>
                    {isWorkout ? 'Workout' : 'Active Rest'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
                  {w.duration_minutes ? ` · ${w.duration_minutes} min` : ''}
                </p>
                {w.notes && (
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
                  const exIsBW = ex.weight_type === 'bodyweight'
                  const headerWeight = exIsBW
                    ? 'BW'
                    : ex.weight_type === 'double'
                      ? `2\u00d7${ex.weight_kg}kg`
                      : `${ex.weight_kg}kg`
                  // Effective per-set label: respects per-set weight_type + weight_kg overrides
                  const effLabel = (s) => {
                    const t = s.weight_type ?? ex.weight_type
                    if (t === 'bodyweight' || (exIsBW && s.weight_kg == null)) return 'BW'
                    const w = s.weight_kg ?? ex.weight_kg
                    return t === 'double' ? `2\u00d7${w}` : `${w}`
                  }
                  let prevLabel = null

                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm text-gray-200 font-medium">
                          {ex.exercise_name || 'Unnamed'}
                        </p>
                        <p className="text-xs text-gray-500">{headerWeight}</p>
                      </div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {sets.map((s, si) => {
                          const lbl = effLabel(s)
                          const showLabel = lbl !== prevLabel
                          prevLabel = lbl
                          const r = s.rounds ?? 1
                          return (
                            <span key={si} className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-1.5 py-0.5">
                              {showLabel && (
                                <span className="text-blue-400 mr-0.5">@{lbl}</span>
                              )}
                              {s.reps ?? '—'}
                              {r > 1 && <span className="text-gray-500">×{r}</span>}
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
                {/* Copy to today */}
                {isWorkout && exercises.length > 0 && (
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
