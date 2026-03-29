import { supabase } from './supabase'

// ── USER SETTINGS ──────────────────────────────────────────────────────────────

export async function getSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertSettings(userId, { weekly_goal }) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, weekly_goal }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── WORKOUT DAYS ────────────────────────────────────────────────────────────────

export async function getDaysForYear(userId, year) {
  const start = `${year}-01-01`
  const end   = `${year}-12-31`
  const { data, error } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getDayFull(userId, date) {
  const { data: day, error: dayError } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single()
  if (dayError && dayError.code === 'PGRST116') return null
  if (dayError) throw dayError

  const { data: exercises, error: exError } = await supabase
    .from('workout_exercises')
    .select('*, exercise_sets(*)')
    .eq('workout_day_id', day.id)
    .order('display_order', { ascending: true })
  if (exError) throw exError

  return { ...day, exercises: exercises ?? [] }
}

export async function upsertDay(userId, { date, day_type, duration_minutes, notes, submitted }) {
  const payload = { user_id: userId, date, day_type, duration_minutes, notes }
  if (submitted !== undefined) payload.submitted = submitted
  const { data, error } = await supabase
    .from('workout_days')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDay(dayId) {
  const { error } = await supabase
    .from('workout_days')
    .delete()
    .eq('id', dayId)
  if (error) throw error
}

// ── WORKOUT EXERCISES ───────────────────────────────────────────────────────────

export async function upsertExercise(userId, workoutDayId, exercise) {
  const { id, exercise_name, weight_kg, weight_type, goal_sets, display_order } = exercise
  const payload = {
    user_id: userId,
    workout_day_id: workoutDayId,
    exercise_name,
    weight_kg,
    weight_type,
    goal_sets,
    display_order: display_order ?? 0,
  }
  if (id) payload.id = id

  const { data, error } = await supabase
    .from('workout_exercises')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExercise(exerciseId) {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('id', exerciseId)
  if (error) throw error
}

// ── EXERCISE SETS ───────────────────────────────────────────────────────────────

export async function upsertSet(userId, workoutExerciseId, set) {
  const { id, set_number, reps, duration_seconds } = set
  const payload = {
    user_id: userId,
    workout_exercise_id: workoutExerciseId,
    set_number,
    reps,
    duration_seconds,
  }
  if (id) payload.id = id

  const { data, error } = await supabase
    .from('exercise_sets')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSet(setId) {
  const { error } = await supabase
    .from('exercise_sets')
    .delete()
    .eq('id', setId)
  if (error) throw error
}

// ── AUTOCOMPLETE & PERSONAL BESTS ──────────────────────────────────────────────

export async function getExerciseNames(userId) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('exercise_name')
    .eq('user_id', userId)
    .order('exercise_name')
  if (error) throw error
  const names = [...new Set((data ?? []).map(r => r.exercise_name).filter(Boolean))]
  return names.sort()
}

export async function getPersonalBest(userId, exerciseName, weightType, weightKg) {
  if (!exerciseName) return null
  let query = supabase
    .from('workout_exercises')
    .select('id, weight_kg, weight_type, exercise_sets(reps)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)

  // Filter by weight configuration so 1×24kg and 2×24kg have separate PBs
  if (weightType && weightType !== 'bodyweight') {
    query = query.eq('weight_type', weightType).eq('weight_kg', weightKg)
  } else if (weightType === 'bodyweight') {
    query = query.eq('weight_type', 'bodyweight')
  }

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) return null

  let maxTotalReps = 0      // best total reps in a single session
  let maxSingleSetReps = 0  // best reps in any single set ever

  for (const ex of data) {
    const sets = ex.exercise_sets ?? []
    const sessionTotal = sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)
    const sessionMax = sets.length > 0 ? Math.max(...sets.map(s => s.reps ?? 0)) : 0
    if (sessionTotal > maxTotalReps) maxTotalReps = sessionTotal
    if (sessionMax > maxSingleSetReps) maxSingleSetReps = sessionMax
  }

  return {
    maxTotalReps,
    maxSingleSetReps,
    weight_kg: weightKg ?? null,
    weight_type: weightType ?? 'single',
  }
}

export async function getWorkoutFeed(userId, { limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('workout_days')
    .select('*, workout_exercises(exercise_name, weight_kg, weight_type, exercise_sets(reps))')
    .eq('user_id', userId)
    .eq('submitted', true)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}

export async function getExerciseHistory(userId, exerciseName) {
  if (!exerciseName) return []
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('id, weight_kg, weight_type, workout_days(date), exercise_sets(set_number, reps, duration_seconds)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(ex => ({
    date: ex.workout_days?.date,
    weight_kg: ex.weight_kg,
    weight_type: ex.weight_type,
    sets: ex.exercise_sets ?? [],
  })).filter(e => e.date)
}
