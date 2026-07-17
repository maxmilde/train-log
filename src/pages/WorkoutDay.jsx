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
  upsertComplex,
  deleteComplex,
  applyComplexTemplate,
  getExerciseNames,
} from '../lib/db'
import { toDateStr } from '../lib/utils'
import DayLog from '../components/workout/DayLog'

function normDay(day) {
  const complexes = (day.complexes ?? []).map(normComplex)
  // Attach exercises to their complexes; standalone go into top-level list
  const complexMap = new Map(complexes.map(c => [c.id, c]))
  const topLevelExercises = []
  for (const ex of day.exercises ?? []) {
    const nex = normExercise(ex)
    if (ex.complex_id && complexMap.has(ex.complex_id)) {
      complexMap.get(ex.complex_id).exercises.push(nex)
    } else {
      topLevelExercises.push(nex)
    }
  }
  // Sort complex exercises by their display_order
  for (const c of complexes) {
    c.exercises.sort((a, b) => a.displayOrder - b.displayOrder)
  }
  return {
    dayId:           day.id,
    date:            day.date,
    dayType:         day.day_type ?? 'rest',
    durationMinutes: day.duration_minutes ?? null,
    notes:           day.notes ?? '',
    submitted:       day.submitted ?? false,
    exercises: topLevelExercises,
    complexes,
  }
}

function normExercise(ex) {
  return {
    id:           ex.id,
    exerciseName: ex.exercise_name ?? '',
    weightKg:     ex.weight_kg ?? 24,
    weightType:   ex.weight_type ?? 'single',
    displayOrder: ex.display_order ?? 0,
    complexId:    ex.complex_id ?? null,
    sets: (ex.exercise_sets ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({
        id:         s.id,
        setNumber:  s.set_number,
        reps:       s.reps ?? null,
        weightKg:   s.weight_kg ?? null,
        weightType: s.weight_type ?? null,
        rounds:     s.rounds ?? 1,
      })),
  }
}

function normComplex(c) {
  return {
    id:           c.id,
    rounds:       c.rounds ?? 1,
    displayOrder: c.display_order ?? 0,
    exercises:    [],  // populated by normDay
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
        : { dayId: null, date, dayType: 'workout', durationMinutes: null, notes: '', submitted: false, exercises: [], complexes: [] }
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

  // Shared: what displayOrder should a new top-level item (exercise or complex) get?
  const nextItemOrder = (st) => {
    const mx = (st.exercises ?? []).reduce((m, e) => Math.max(m, e.displayOrder ?? 0), -1)
    const mc = (st.complexes ?? []).reduce((m, c) => Math.max(m, c.displayOrder ?? 0), -1)
    return Math.max(mx, mc) + 1
  }

  const handleAddExercise = useCallback(async () => {
    try {
      setSaving(true)
      const currentState = state
      const dayId = currentState.dayId ?? await ensureDay(currentState)

      const ex = await upsertExercise(user.id, dayId, {
        exercise_name: '',
        weight_kg: 24,
        weight_type: 'single',
        display_order: nextItemOrder(currentState),
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

  // Swap positions of two items in the mixed exercises+complexes list.
  const handleMoveItem = useCallback(async (fromIndex, toIndex) => {
    // Build the ordered mixed list (same logic DayLog uses)
    const items = [
      ...state.exercises.map(ex => ({ kind: 'exercise', item: ex, sortKey: ex.displayOrder ?? 0 })),
      ...state.complexes.map(cx => ({ kind: 'complex',  item: cx, sortKey: cx.displayOrder ?? 0 })),
    ].sort((a, b) => a.sortKey - b.sortKey)

    const a = items[fromIndex]
    const b = items[toIndex]
    if (!a || !b) return
    const orderA = a.sortKey
    const orderB = b.sortKey

    // Optimistic swap in state
    setState(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => {
        if (a.kind === 'exercise' && ex.id === a.item.id) return { ...ex, displayOrder: orderB }
        if (b.kind === 'exercise' && ex.id === b.item.id) return { ...ex, displayOrder: orderA }
        return ex
      }),
      complexes: prev.complexes.map(cx => {
        if (a.kind === 'complex' && cx.id === a.item.id) return { ...cx, displayOrder: orderB }
        if (b.kind === 'complex' && cx.id === b.item.id) return { ...cx, displayOrder: orderA }
        return cx
      }),
    }))

    // Persist to DB
    try {
      const write = async (side, newOrder) => {
        if (side.kind === 'exercise') {
          await upsertExercise(user.id, state.dayId, {
            id:            side.item.id,
            exercise_name: side.item.exerciseName,
            weight_kg:     side.item.weightKg,
            weight_type:   side.item.weightType,
            display_order: newOrder,
          })
        } else {
          await upsertComplex(user.id, state.dayId, {
            id:            side.item.id,
            rounds:        side.item.rounds,
            display_order: newOrder,
          })
        }
      }
      await Promise.all([write(a, orderB), write(b, orderA)])
    } catch (e) { console.error('Failed to save item order:', e) }
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

  // ── COMPLEX HANDLERS ─────────────────────────────────────────────────────────

  // Add a new complex to the day
  const handleAddComplex = useCallback(async () => {
    try {
      setSaving(true)
      const currentState = state
      const dayId = currentState.dayId ?? await ensureDay(currentState)
      const cx = await upsertComplex(user.id, dayId, {
        rounds: 1,
        display_order: nextItemOrder(currentState),
      })
      setState(prev => ({
        ...prev,
        dayId,
        complexes: [...prev.complexes, normComplex(cx)],
      }))
    } catch (e) { console.error('Add complex:', e) }
    finally { setSaving(false) }
  }, [user, state, ensureDay])

  // Update a complex (usually just the rounds count)
  const handleUpdateComplex = useCallback(async (complexId, patch) => {
    setState(prev => ({
      ...prev,
      complexes: prev.complexes.map(c =>
        c.id === complexId ? { ...c, ...patch } : c
      ),
    }))
    try {
      const cx = state.complexes.find(c => c.id === complexId)
      if (!cx) return
      const merged = { ...cx, ...patch }
      await upsertComplex(user.id, state.dayId, {
        id: complexId,
        rounds: merged.rounds,
        display_order: merged.displayOrder,
      })
    } catch (e) { console.error('Update complex:', e) }
  }, [user, state])

  const handleDeleteComplex = useCallback(async (complexId) => {
    setState(prev => ({
      ...prev,
      complexes: prev.complexes.filter(c => c.id !== complexId),
    }))
    try {
      await deleteComplex(complexId)
    } catch (e) { console.error('Delete complex:', e) }
  }, [])

  // Add an exercise inside a specific complex — creates the exercise AND one implicit set
  const handleAddExerciseToComplex = useCallback(async (complexId) => {
    try {
      setSaving(true)
      const cx = state.complexes.find(c => c.id === complexId)
      if (!cx) return
      const dayId = state.dayId
      const order = cx.exercises.length
      const ex = await upsertExercise(user.id, dayId, {
        exercise_name: '',
        weight_kg: 24,
        weight_type: 'single',
        display_order: order,
        complex_id: complexId,
      })
      // Create the one implicit set
      const s = await upsertSet(user.id, ex.id, {
        set_number: 1,
        reps: null,
        weight_kg: 24,
        weight_type: 'single',
        rounds: 1,
      })
      const nex = normExercise({ ...ex, exercise_sets: [s] })
      setState(prev => ({
        ...prev,
        complexes: prev.complexes.map(c =>
          c.id === complexId ? { ...c, exercises: [...c.exercises, nex] } : c
        ),
      }))
      getExerciseNames(user.id).then(setNames)
    } catch (e) { console.error('Add exercise to complex:', e) }
    finally { setSaving(false) }
  }, [user, state])

  // Update an exercise inside a complex (name, weight, type, or its one set's reps/rounds)
  const handleUpdateComplexExercise = useCallback(async (complexId, exerciseId, patch) => {
    // Optimistic
    setState(prev => ({
      ...prev,
      complexes: prev.complexes.map(c =>
        c.id === complexId
          ? {
              ...c,
              exercises: c.exercises.map(ex =>
                ex.id === exerciseId ? { ...ex, ...patch } : ex
              ),
            }
          : c
      ),
    }))
    const dbFields = ['exerciseName', 'weightKg', 'weightType']
    if (!dbFields.some(f => f in patch)) return
    try {
      const cx = state.complexes.find(c => c.id === complexId)
      const ex = cx?.exercises.find(e => e.id === exerciseId)
      if (!ex) return
      const merged = { ...ex, ...patch }
      await upsertExercise(user.id, state.dayId, {
        id:            exerciseId,
        exercise_name: merged.exerciseName,
        weight_kg:     merged.weightKg,
        weight_type:   merged.weightType,
        display_order: merged.displayOrder,
        complex_id:    complexId,
      })
      if ('exerciseName' in patch) {
        getExerciseNames(user.id).then(setNames)
      }
    } catch (e) { console.error('Update complex exercise:', e) }
  }, [user, state])

  // Update the single set inside a complex-exercise (reps or weight/type)
  const handleUpdateComplexSet = useCallback(async (complexId, exerciseId, patch) => {
    setState(prev => ({
      ...prev,
      complexes: prev.complexes.map(c =>
        c.id === complexId
          ? {
              ...c,
              exercises: c.exercises.map(ex =>
                ex.id === exerciseId
                  ? { ...ex, sets: ex.sets.map((s, i) => i === 0 ? { ...s, ...patch } : s) }
                  : ex
              ),
            }
          : c
      ),
    }))
    try {
      const cx = state.complexes.find(c => c.id === complexId)
      const ex = cx?.exercises.find(e => e.id === exerciseId)
      const set = ex?.sets[0]
      if (!set) return
      const merged = { ...set, ...patch }
      await upsertSet(user.id, exerciseId, {
        id:          set.id,
        set_number:  merged.setNumber ?? 1,
        reps:        merged.reps,
        weight_kg:   merged.weightKg ?? null,
        weight_type: merged.weightType ?? null,
        rounds:      merged.rounds ?? 1,
      })
    } catch (e) { console.error('Update complex set:', e) }
  }, [user, state])

  // Populate an existing (empty) complex from a template
  const handleLoadComplexTemplate = useCallback(async (complexId, template) => {
    try {
      setSaving(true)
      const result = await applyComplexTemplate(user.id, complexId, state.dayId, template)
      // Refresh state — replace the target complex's contents
      setState(prev => ({
        ...prev,
        complexes: prev.complexes.map(c =>
          c.id === complexId
            ? {
                ...c,
                rounds: result.rounds,
                exercises: result.exercises.map(({ exercise, set }) => ({
                  id:           exercise.id,
                  exerciseName: exercise.exercise_name ?? '',
                  weightKg:     exercise.weight_kg ?? 24,
                  weightType:   exercise.weight_type ?? 'single',
                  displayOrder: exercise.display_order ?? 0,
                  complexId:    complexId,
                  sets: [{
                    id:         set.id,
                    setNumber:  set.set_number,
                    reps:       set.reps ?? null,
                    weightKg:   set.weight_kg ?? null,
                    weightType: set.weight_type ?? null,
                    rounds:     set.rounds ?? 1,
                  }],
                })),
              }
            : c
        ),
      }))
      getExerciseNames(user.id).then(setNames)
    } catch (e) { console.error('Load template:', e) }
    finally { setSaving(false) }
  }, [user, state])

  const handleDeleteComplexExercise = useCallback(async (complexId, exerciseId) => {
    setState(prev => ({
      ...prev,
      complexes: prev.complexes.map(c =>
        c.id === complexId
          ? { ...c, exercises: c.exercises.filter(ex => ex.id !== exerciseId) }
          : c
      ),
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
      // Rounds always start at 1 for a fresh set — user tracks rounds live
      const newSet = await upsertSet(user.id, exerciseId, {
        set_number: setNumber,
        reps: null,
        weight_kg: defaultWeight,
        weight_type: defaultType,
        rounds: 1,
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
                rounds: newSet.rounds ?? 1,
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
        complexes: prev.complexes.map(c => ({
          ...c,
          exercises: c.exercises.map(ex => ({
            ...ex,
            sets: ex.sets.filter(s => s.reps != null),
          })),
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
        complexes: [],
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
          onMoveItem={handleMoveItem}
          onAddSet={handleAddSet}
          onUpdateSet={handleUpdateSet}
          onDeleteSet={handleDeleteSet}
          onAddComplex={handleAddComplex}
          onUpdateComplex={handleUpdateComplex}
          onDeleteComplex={handleDeleteComplex}
          onAddExerciseToComplex={handleAddExerciseToComplex}
          onUpdateComplexExercise={handleUpdateComplexExercise}
          onUpdateComplexSet={handleUpdateComplexSet}
          onDeleteComplexExercise={handleDeleteComplexExercise}
          onLoadComplexTemplate={handleLoadComplexTemplate}
          onSubmit={handleSubmit}
          onDeleteDay={handleDeleteDay}
          onDateChange={handleDateChange}
        />
      </div>
    </div>
  )
}
