import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getWorkoutFeed } from '../../lib/db'
import { ChevronDown, ChevronUp } from 'lucide-react'

const PAGE_SIZE = 20

export default function WorkoutFeed() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [hasMore, setHasMore]   = useState(true)
  const [expanded, setExpanded] = useState({})
  const loaderRef = useRef(null)

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
                  const sets = ex.exercise_sets ?? []
                  const totalReps = sets.reduce((a, s) => a + (s.reps ?? 0), 0)
                  const weightStr = ex.weight_type === 'bodyweight' || !ex.weight_kg
                    ? 'BW'
                    : ex.weight_type === 'double'
                      ? `2\u00d7${ex.weight_kg}kg`
                      : `${ex.weight_kg}kg`

                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm text-gray-200 font-medium">
                          {ex.exercise_name || 'Unnamed'}
                        </p>
                        <p className="text-xs text-gray-500">{weightStr}</p>
                      </div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {sets.map((s, si) => (
                          <span key={si} className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-1.5 py-0.5">
                            {s.reps ?? '—'}
                          </span>
                        ))}
                        <span className="text-[11px] text-gray-500 ml-1">
                          = {totalReps} reps
                        </span>
                      </div>
                    </div>
                  )
                })}
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
