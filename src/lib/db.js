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
  const { id, exercise_name, weight_kg, weight_type, display_order } = exercise
  const payload = {
    user_id: userId,
    workout_day_id: workoutDayId,
    exercise_name,
    weight_kg,
    weight_type,
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
  const { id, set_number, reps, duration_seconds, weight_kg, weight_type, rounds } = set
  const payload = {
    user_id: userId,
    workout_exercise_id: workoutExerciseId,
    set_number,
    reps,
    duration_seconds,
  }
  if (weight_kg   !== undefined) payload.weight_kg = weight_kg
  if (weight_type !== undefined) payload.weight_type = weight_type
  if (rounds      !== undefined) payload.rounds = rounds
  if (id) payload.id = id

  const { data, error } = await supabase
    .from('exercise_sets')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Remove empty (reps = null) sets from this workout day to keep displays clean.
// Used on Submit so trailing blank set rows don't pollute the feed/history.
export async function deleteEmptySetsForDay(userId, dayId) {
  // Fetch exercise IDs for the day
  const { data: exs, error: exErr } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('user_id', userId)
    .eq('workout_day_id', dayId)
  if (exErr) throw exErr
  const ids = (exs ?? []).map(e => e.id)
  if (ids.length === 0) return
  const { error } = await supabase
    .from('exercise_sets')
    .delete()
    .in('workout_exercise_id', ids)
    .is('reps', null)
  if (error) throw error
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

// Get usage stats for the past N days, used by the suggestion engine.
// Returns: [{ name, sessions, totalReps, lastDate }] across all logged exercises (submitted only).
// Also returns avgWorkoutSize: rounded average exercise count per workout day.
export async function getSuggestionStats(userId, daysBack = 30) {
  const since = new Date()
  since.setDate(since.getDate() - daysBack)
  const sinceStr = since.toISOString().split('T')[0]

  // 1) Fetch ALL exercises (for the catalog of names + their typical configs)
  const { data: allExs, error: allErr } = await supabase
    .from('workout_exercises')
    .select('exercise_name, weight_kg, weight_type, workout_days(date, submitted), exercise_sets(reps)')
    .eq('user_id', userId)
  if (allErr) throw allErr

  // Aggregate into per-name buckets
  const stats = new Map()
  let workoutDates = new Set()

  for (const ex of allExs ?? []) {
    const name = ex.exercise_name
    if (!name) continue
    const day = ex.workout_days
    if (!day?.submitted) continue
    if (!stats.has(name)) {
      stats.set(name, {
        name,
        // ALL-TIME
        allSessions: 0,
        // RECENT (within daysBack)
        recentSessions: 0,
        recentReps: 0,
        lastDate: null,
        // Most-used config (latest)
        weight_kg: ex.weight_kg,
        weight_type: ex.weight_type,
      })
    }
    const s = stats.get(name)
    s.allSessions += 1
    if (!s.lastDate || day.date > s.lastDate) {
      s.lastDate = day.date
      s.weight_kg = ex.weight_kg
      s.weight_type = ex.weight_type
    }
    if (day.date >= sinceStr) {
      s.recentSessions += 1
      s.recentReps += (ex.exercise_sets ?? []).reduce((a, ss) => a + (ss.reps ?? 0), 0)
    }
    workoutDates.add(day.date)
  }

  // 2) Fetch workout day count + exercise counts to compute avg workout size
  const { data: dayCounts, error: dcErr } = await supabase
    .from('workout_days')
    .select('id, workout_exercises(id)')
    .eq('user_id', userId)
    .eq('submitted', true)
    .eq('day_type', 'workout')
  if (dcErr) throw dcErr

  const sizes = (dayCounts ?? [])
    .map(d => (d.workout_exercises ?? []).length)
    .filter(n => n > 0)
  const avgWorkoutSize = sizes.length > 0
    ? Math.max(2, Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length))
    : 4

  return {
    exercises: [...stats.values()].sort((a, b) => a.name.localeCompare(b.name)),
    avgWorkoutSize,
  }
}

// Create a new workout day from a list of suggested exercises (just names + most-recent weight config).
// suggestions: [{ name, weight_kg, weight_type }]. Appends to existing if today already has any.
export async function createWorkoutFromSuggestions(userId, targetDate, suggestions) {
  if (!suggestions || suggestions.length === 0) throw new Error('No suggestions provided')

  // Ensure target day
  const { data: existingDay, error: dayErr } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .maybeSingle()
  if (dayErr && dayErr.code !== 'PGRST116') throw dayErr

  let targetDay = existingDay
  if (!targetDay) {
    const { data, error } = await supabase
      .from('workout_days')
      .insert({ user_id: userId, date: targetDate, day_type: 'workout' })
      .select()
      .single()
    if (error) throw error
    targetDay = data
  }

  const { data: existingExs } = await supabase
    .from('workout_exercises')
    .select('display_order')
    .eq('user_id', userId)
    .eq('workout_day_id', targetDay.id)
  const baseOrder = (existingExs ?? []).reduce((m, e) => Math.max(m, e.display_order ?? 0), -1) + 1

  const rows = suggestions.map((s, i) => ({
    user_id: userId,
    workout_day_id: targetDay.id,
    exercise_name: s.name,
    weight_kg: s.weight_kg ?? null,
    weight_type: s.weight_type ?? 'single',
    display_order: baseOrder + i,
  }))
  const { error: insErr } = await supabase.from('workout_exercises').insert(rows)
  if (insErr) throw insErr

  return targetDay
}

// Copy a previous workout's exercise structure (names, weight config) to a target date.
// Does NOT copy logged reps/sets — fresh sets only. Appends to existing exercises if the target day already has any.
export async function copyWorkoutToDate(userId, sourceDayId, targetDate) {
  // Read source exercises
  const { data: sourceExs, error: srcErr } = await supabase
    .from('workout_exercises')
    .select('exercise_name, weight_kg, weight_type, display_order')
    .eq('user_id', userId)
    .eq('workout_day_id', sourceDayId)
    .order('display_order', { ascending: true })
  if (srcErr) throw srcErr
  if (!sourceExs || sourceExs.length === 0) throw new Error('Source workout has no exercises')

  // Ensure target day exists (default day_type=workout)
  const { data: existingDay, error: dayErr } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .maybeSingle()
  if (dayErr && dayErr.code !== 'PGRST116') throw dayErr

  let targetDay = existingDay
  if (!targetDay) {
    const { data, error } = await supabase
      .from('workout_days')
      .insert({ user_id: userId, date: targetDate, day_type: 'workout' })
      .select()
      .single()
    if (error) throw error
    targetDay = data
  }

  // Find current max display_order at target so we append, not overwrite
  const { data: existingExs } = await supabase
    .from('workout_exercises')
    .select('display_order')
    .eq('user_id', userId)
    .eq('workout_day_id', targetDay.id)
  const baseOrder = (existingExs ?? []).reduce((m, e) => Math.max(m, e.display_order ?? 0), -1) + 1

  const rows = sourceExs.map((ex, i) => ({
    user_id: userId,
    workout_day_id: targetDay.id,
    exercise_name: ex.exercise_name,
    weight_kg: ex.weight_kg,
    weight_type: ex.weight_type,
    display_order: baseOrder + i,
  }))
  const { error: insErr } = await supabase.from('workout_exercises').insert(rows)
  if (insErr) throw insErr

  return targetDay
}

// Catalog: list all unique exercises with usage stats.
// Skips exercise instances that have zero non-empty sets so they don't inflate counts.
export async function getExerciseCatalog(userId) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('exercise_name, weight_type, weight_kg, workout_days(date, submitted), exercise_sets(reps, rounds)')
    .eq('user_id', userId)
  if (error) throw error

  const map = new Map()
  for (const ex of data ?? []) {
    const name = ex.exercise_name
    if (!name) continue
    const day = ex.workout_days
    if (!day?.submitted) continue
    const nonEmptySets = (ex.exercise_sets ?? []).filter(s => s.reps != null)
    if (nonEmptySets.length === 0) continue  // orphan exercise — nothing logged
    if (!map.has(name)) {
      map.set(name, { name, sessions: 0, lastDate: null, totalReps: 0, configs: new Set() })
    }
    const entry = map.get(name)
    entry.sessions += 1
    if (!entry.lastDate || day.date > entry.lastDate) entry.lastDate = day.date
    entry.totalReps += nonEmptySets.reduce((a, s) => a + ((s.reps ?? 0) * (s.rounds ?? 1)), 0)
    if (ex.weight_type === 'bodyweight') entry.configs.add('BW')
    else if (ex.weight_type === 'double') entry.configs.add(`2×${ex.weight_kg}kg`)
    else entry.configs.add(`${ex.weight_kg}kg`)
  }
  return [...map.values()]
    .map(e => ({ ...e, configs: [...e.configs] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Rename exercise across ALL of the user's workout_exercises rows
export async function renameExercise(userId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return
  const { error } = await supabase
    .from('workout_exercises')
    .update({ exercise_name: newName })
    .eq('user_id', userId)
    .eq('exercise_name', oldName)
  if (error) throw error
}

// Delete ALL workout_exercises rows for this user with the given name.
// exercise_sets cascade-delete via FK. workout_days are NOT deleted.
export async function deleteExerciseByName(userId, name) {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_name', name)
  if (error) throw error
}

// PBs respect per-set type+weight overrides AND the rounds multiplier:
//   - Each set's effective type/weight = per-set override or exercise default
//   - "max single set" = best per-round reps (e.g. 10 x 5 rounds → best = 10, not 50)
//   - "max session total volume" = sum of (reps * rounds) across matching sets
//   - Empty sets (reps == null) skipped
export async function getPersonalBest(userId, exerciseName, weightType, weightKg) {
  if (!exerciseName) return null
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('id, weight_kg, weight_type, exercise_sets(reps, weight_kg, weight_type, rounds)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
  if (error) throw error
  if (!data || data.length === 0) return null

  let maxTotalReps = 0
  let maxSingleSetReps = 0

  for (const ex of data) {
    const exDefaultType   = ex.weight_type
    const exDefaultWeight = ex.weight_kg
    const matchingSets = (ex.exercise_sets ?? []).filter(s => {
      if (s.reps == null) return false
      const eType = s.weight_type ?? exDefaultType
      if (eType !== weightType) return false
      if (weightType === 'bodyweight') return true
      const eWeight = s.weight_kg ?? exDefaultWeight
      return eWeight === weightKg
    })
    if (matchingSets.length === 0) continue
    // Session total = sum(reps * rounds) for the matching sets
    const sessionTotal = matchingSets.reduce((sum, s) => sum + ((s.reps ?? 0) * (s.rounds ?? 1)), 0)
    // Best single set = max(reps) — per-round, NOT multiplied by rounds
    const sessionMax = Math.max(...matchingSets.map(s => s.reps ?? 0))
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
    .select('*, workout_exercises(exercise_name, weight_kg, weight_type, exercise_sets(reps, weight_kg, weight_type, set_number, rounds))')
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
    .select('id, weight_kg, weight_type, workout_days(date), exercise_sets(set_number, reps, weight_kg, weight_type, rounds)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(ex => ({
    date: ex.workout_days?.date,
    weight_kg: ex.weight_kg,
    weight_type: ex.weight_type,
    sets: (ex.exercise_sets ?? [])
      .filter(s => s.reps != null)
      .map(s => ({
        ...s,
        rounds: s.rounds ?? 1,
        effective_weight_kg: s.weight_kg ?? ex.weight_kg,
        effective_weight_type: s.weight_type ?? ex.weight_type,
      })),
  }))
  // Drop entries with no date or zero non-empty sets — these are orphan
  // exercise rows from sessions where nothing was actually logged.
  .filter(e => e.date && e.sets.length > 0)
}
