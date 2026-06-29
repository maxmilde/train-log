import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getDayFull,
  upsertDay,
  deleteDay,
  upsertExercise,
  deleteExercise,
  upsertSet,
  deleteSet,
  deleteEmptySetsForDay,
  getExerciseNames,
} from '../lib/db'
import { toDateStr } from '../lib/utils'
import DayLog from '../components/workout/DayLog'

function normDay(day) {
  return {
    dayId:           day.id,
    date:            day.date,
    dayType:         day.day_type ?? 'rest',
    durationMinutes: day.duration_minutes ?? null,
    notes:           day.notes ?? '',
    submitted:       day.submitted ?? false,
    exercises: (day.exercises ?? []).map(normExercise),
  }
}

function normExercise(ex) {
  return {
    id:           ex.id,
    exerciseName: ex.exercise_name ?? '',
    weightKg:     ex.weight_kg ?? 24,
    weightType:   ex.weight_type ?? 'single',
    displayOrder: ex.display_order ?? 0,
    sets: (ex.exercise_sets ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({
        id:         s.id,
        setNumber:  s.set_number,
        reps:       s.reps ?? null,
        // Per-set overrides; null = inherit exercise default
        weightKg:   s.weight_kg ?? null,
        weightType: s.weight_type ?? null,
        rounds:     s.rounds ?? 1,
      })),
  }
}

export default function WorkoutDayPage() {
  const { date: routeDate } = useParams()
  const { user }            = useAuth()
  const navigate            = useNavigate()
  const date                = routeDate ?? toDateStr(new Date())

  const [state, setState]           = useState(null)
  const [exerciseNames, setNames]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  const fromDashboard = !!routeDate

  // Load day data
  useEffect(() => {
    if (!user) return
    Promise.all([
      getDayFull(user.id, date),
      getExerciseNames(user.id),
    ]).then(([day, names]) => {
      setNames(names)
      setState(day
        ? normDay(day)
        : { dayId: null, date, dayType: 'workout', durationMinutes: null, notes: '', submitted: false, exercises: [] }
      )
      setLoading(false)
    }).catch(err => {
      console.error('WorkoutDay load error:', err)
      setLoading(false)
    })
  }, [user, date])

  // Ensure the day row exists in DB; returns dayId
  const ensureDay = useCallback(async (currentState) => {
    const day = await upsertDay(user.id, {
      date: currentState.date,
      day_type: currentState.dayType,
      duration_minutes: currentState.durationMinutes,
    })
    return day.id
  }, [user])

  // ── HANDLERS ────────────────────────────────────────────────────────────────

  const handleDayTypeChange = useCallback(async (dayType) => {
    setState(prev => ({ ...prev, dayType }))
    try {
      setSaving(true)
      await upsertDay(user.id, {
        date,
        day_type: dayType,
        duration_minutes: state?.durationMinutes ?? null,
      })
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [user, date, state])

  // Duration: only local state — saved on submit
  const handleDurationChange = useCallback((durationMinutes) => {
    setState(prev => ({ ...prev, durationMinutes }))
  }, [])

  // Keep latest state available to async closures (debounced save, visibilitychange)
  const stateRef = useRef(null)
  stateRef.current = state

  // Persist current state's notes to DB (creates day row if missing)
  const persistNotes = useCallback(async () => {
    const st = stateRef.current
    if (!user || !st) return
    try {
      const dayId = st.dayId ?? await ensureDay(st)
      await upsertDay(user.id, {
        date: st.date,
        day_type: st.dayType,
        duration_minutes: st.durationMinutes,
        notes: st.notes || null,
      })
      if (!st.dayId) {
        setState(prev => prev ? { ...prev, dayId } : prev)
      }
    } catch (e) { console.error('Save notes:', e) }
  }, [user, ensureDay])

  // Notes: optimistic local update + debounced DB save (~800ms idle)
  const notesTimerRef = useRef(null)
  const handleNotesChange = useCallback((notes) => {
    setState(prev => ({ ...prev, notes }))
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      notesTimerRef.current = null
      persistNotes()
    }, 800)
  }, [persistNotes])

  // Flush pending notes-save when tab is backgrounded or page unmounts
  useEffect(() => {
    const flush = () => {
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current)
        notesTimerRef.current = null
        persistNotes()
      }
    }
    document.addEventListener('visibilitychange', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [persistNotes])

  const handleAddExercise = useCallback(async () => {
    try {
      setSaving(true)
      const currentState = state
      const dayId = currentState.dayId ?? await ensureDay(currentState)

      const ex = await upsertExercise(user.id, dayId, {
        exercise_name: '',
        weight_kg: 24,
        weight_type: 'single',
        display_order: currentState.exercises.length,
      })

      setState(prev => ({
        ...prev,
        dayId,
        exercises: [...prev.exercises, normExercise(ex)],
      }))

      // Refresh exercise names
      getExerciseNames(user.id).then(setNames)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [user, state, ensureDay])

  const handleUpdateExercise = useCallback(async (exerciseId, patch) => {
    // Optimistic update
    setState(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, ...patch } : ex
      ),
    }))

    const dbFields = ['exerciseName', 'weightKg', 'weightType']
    if (!dbFields.some(f => f in patch)) return

    try {
      const ex = state.exercises.find(e => e.id === exerciseId)
      if (!ex) return
      const merged = { ...ex, ...patch }
      await upsertExercise(user.id, state.dayId, {
        id:            exerciseId,
        exercise_name: merged.exerciseName,
        weight_kg:     merged.weightKg,
        weight_type:   merged.weightType,
        display_order: merged.displayOrder,
      })
      if ('exerciseName' in patch) {
        getExerciseNames(user.id).then(setNames)
      }
    } catch (e) { console.error(e) }
  }, [user, state])

  const handleMoveExercise = useCallback(async (fromIndex, toIndex) => {
    setState(prev => {
      const newExercises = [...prev.exercises]
      const [moved] = newExercises.splice(fromIndex, 1)
      newExercises.splice(toIndex, 0, moved)
      return {
        ...prev,
        exercises: newExercises.map((ex, i) => ({ ...ex, displayOrder: i })),
      }
    })

    try {
      const exercises = state.exercises
      const exA = exercises[fromIndex]
      const exB = exercises[toIndex]
      if (!exA || !exB) return
      await Promise.all([
        upsertExercise(user.id, state.dayId, {
          id: exA.id,
          exercise_name: exA.exerciseName,
          weight_kg: exA.weightKg,
          weight_type: exA.weightType,
          display_order: toIndex,
        }),
        upsertExercise(user.id, state.dayId, {
          id: exB.id,
          exercise_name: exB.exerciseName,
          weight_kg: exB.weightKg,
          weight_type: exB.weightType,
          display_order: fromIndex,
        }),
      ])
    } catch (e) { console.error('Failed to save exercise order:', e) }
  }, [user, state])

  const handleDeleteExercise = useCallback(async (exerciseId) => {
    setState(prev => ({
      ...prev,
      exercises: prev.exercises.filter(ex => ex.id !== exerciseId),
    }))
    try {
      await deleteExercise(exerciseId)
    } catch (e) { console.error(e) }
  }, [])

  const handleAddSet = useCallback(async (exerciseId) => {
    try {
      const ex = state.exercises.find(e => e.id === exerciseId)
      if (!ex) return
      const setNumber = ex.sets.length + 1
      // New set inherits BOTH weight and type from the last set;
      // falls back to the exercise's defaults if no sets exist yet.
      // For first set on a non-BW exercise, default type is 'single'.
      const lastSet = ex.sets[ex.sets.length - 1]
      const defaultWeight = lastSet
        ? (lastSet.weightKg ?? ex.weightKg)
        : ex.weightKg
      const isBW = ex.weightType === 'bodyweight'
      const defaultType = isBW
        ? 'bodyweight'
        : lastSet
          ? (lastSet.weightType ?? ex.weightType ?? 'single')
          : 'single'
      // Rounds default to last set's rounds, else 1
      const lastSetRounds = lastSet ? (lastSet.rounds ?? 1) : 1
      const newSet = await upsertSet(user.id, exerciseId, {
        set_number: setNumber,
        reps: null,
        weight_kg: defaultWeight,
        weight_type: defaultType,
        rounds: lastSetRounds,
      })
      setState(prev => ({
        ...prev,
        exercises: prev.exercises.map(e =>
          e.id === exerciseId
            ? { ...e, sets: [...e.sets, {
                id: newSet.id,
                setNumber: newSet.set_number,
                reps: null,
                weightKg: newSet.weight_kg ?? defaultWeight,
                weightType: newSet.weight_type ?? defaultType,
                rounds: newSet.rounds ?? lastSetRounds,
              }] }
            : e
        ),
      }))
    } catch (e) { console.error(e) }
  }, [user, state])

  const handleUpdateSet = useCallback(async (exerciseId, setId, patch) => {
    // Optimistic
    setState(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map(s =>
              s.id === setId ? { ...s, ...patch } : s
            ) }
          : ex
      ),
    }))
    try {
      const ex  = state.exercises.find(e => e.id === exerciseId)
      const set = ex?.sets.find(s => s.id === setId)
      if (!set) return
      const merged = { ...set, ...patch }
      await upsertSet(user.id, exerciseId, {
        id:          setId,
        set_number:  merged.setNumber,
        reps:        merged.reps,
        weight_kg:   merged.weightKg ?? null,
        weight_type: merged.weightType ?? null,
        rounds:      merged.rounds ?? 1,
      })
    } catch (e) { console.error(e) }
  }, [user, state])

  const handleDeleteSet = useCallback(async (exerciseId, setId) => {
    setState(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
          : ex
      ),
    }))
    try {
      await deleteSet(setId)
    } catch (e) { console.error(e) }
  }, [])

  // ── SUBMIT & DELETE ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    try {
      setSaving(true)
      const day = await upsertDay(user.id, {
        date,
        day_type: state.dayType,
        duration_minutes: state.durationMinutes,
        notes: state.notes || null,
        submitted: true,
      })
      // Drop trailing empty sets (reps == null) so the feed/history stay clean
      try {
        await deleteEmptySetsForDay(user.id, day.id)
      } catch (e) { console.error('Failed to clean empty sets:', e) }
      // Reflect the cleanup in local state so the UI matches the DB
      setState(prev => ({
        ...prev,
        dayId: day.id,
        submitted: true,
        exercises: prev.exercises.map(ex => ({
          ...ex,
          sets: ex.sets.filter(s => s.reps != null),
        })),
      }))
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [user, date, state])

  const handleDeleteDay = useCallback(async () => {
    if (!state.dayId) return
    try {
      setSaving(true)
      await deleteDay(state.dayId)
      setState({
        dayId: null,
        date,
        dayType: 'workout',
        durationMinutes: null,
        notes: '',
        submitted: false,
        exercises: [],
      })
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [state, date])

  // ── DATE CHANGE ─────────────────────────────────────────────────────────────

  const handleDateChange = useCallback((newDate) => {
    navigate(`/workout/${newDate}`, { replace: true })
  }, [navigate])

  // ── RENDER ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (!state) return null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Back button (only when navigated from heatmap) */}
      {fromDashboard && (
        <div
          className="flex-shrink-0 px-4 pt-3 pb-1 flex items-center gap-2"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-green-400 text-sm py-2 -ml-1"
          >
            <ChevronLeft size={18} />
            Dashboard
          </button>
          {saving && (
            <span className="ml-auto text-xs text-gray-600">Saving…</span>
          )}
        </div>
      )}

      {/* Today indicator if no back button */}
      {!fromDashboard && (
        <div
          className="flex-shrink-0 px-4 pt-4 flex items-center justify-between"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider">Today</p>
          {saving && <span className="text-xs text-gray-600">Saving…</span>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-panel">
        <DayLog
          state={state}
          exerciseNames={exerciseNames}
          onDayTypeChange={handleDayTypeChange}
          onDurationChange={handleDurationChange}
          onNotesChange={handleNotesChange}
          onAddExercise={handleAddExercise}
          onUpdateExercise={handleUpdateExercise}
          onDeleteExercise={handleDeleteExercise}
          onMoveExercise={handleMoveExercise}
          onAddSet={handleAddSet}
          onUpdateSet={handleUpdateSet}
          onDeleteSet={handleDeleteSet}
          onSubmit={handleSubmit}
          onDeleteDay={handleDeleteDay}
          onDateChange={handleDateChange}
        />
      </div>
    </div>
  )
}
