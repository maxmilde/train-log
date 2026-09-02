import { supabase } from './supabase'
import {
  getPeriodStart, getPeriodEnd, getPeriodKey, shiftPeriod,
  formatPeriodLabel, formatPeriodShort, toDateStr,
} from './utils'

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

  const [{ data: exercises, error: exError }, { data: complexes, error: cxError }] = await Promise.all([
    supabase
      .from('workout_exercises')
      .select('*, exercise_sets(*)')
      .eq('workout_day_id', day.id)
      .order('display_order', { ascending: true }),
    supabase
      .from('workout_complexes')
      .select('*')
      .eq('workout_day_id', day.id)
      .order('display_order', { ascending: true }),
  ])
  if (exError) throw exError
  if (cxError) throw cxError

  return {
    ...day,
    exercises: exercises ?? [],
    complexes: complexes ?? [],
  }
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
  const { id, exercise_name, weight_kg, weight_type, display_order, complex_id } = exercise
  const payload = {
    user_id: userId,
    workout_day_id: workoutDayId,
    exercise_name,
    weight_kg,
    weight_type,
    display_order: display_order ?? 0,
  }
  if (complex_id !== undefined) payload.complex_id = complex_id
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

// ── COMPLEXES ───────────────────────────────────────────────────────────────────

export async function upsertComplex(userId, workoutDayId, complex) {
  const { id, rounds, display_order } = complex
  const payload = {
    user_id: userId,
    workout_day_id: workoutDayId,
    rounds: rounds ?? 1,
    display_order: display_order ?? 0,
  }
  if (id) payload.id = id
  const { data, error } = await supabase
    .from('workout_complexes')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteComplex(complexId) {
  // Cascades to workout_exercises rows (which cascade to exercise_sets)
  const { error } = await supabase
    .from('workout_complexes')
    .delete()
    .eq('id', complexId)
  if (error) throw error
}

// Volume analytics — returns everything the Volume tab needs for a granularity + reference date.
// Fetches ALL submitted sets ever, then aggregates client-side (fast enough for personal-use DBs).
export async function getVolumeAnalytics(userId, granularity, referenceDate) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      exercise_name, weight_kg, weight_type, complex_id,
      workout_days!inner(date, submitted),
      exercise_sets(reps, weight_kg, weight_type, rounds),
      workout_complexes(rounds)
    `)
    .eq('user_id', userId)
    .eq('workout_days.submitted', true)
  if (error) throw error

  // Flatten every set into (name, type, weight, date, effective_reps, load_kg_reps).
  const records = []
  for (const ex of data ?? []) {
    if (!ex.exercise_name) continue
    const day = ex.workout_days
    if (!day?.submitted) continue
    const complexRounds = ex.workout_complexes?.rounds ?? 1
    for (const set of ex.exercise_sets ?? []) {
      if (set.reps == null) continue
      const effType = set.weight_type ?? ex.weight_type ?? 'single'
      const isBW = effType === 'bodyweight' || (ex.weight_type === 'bodyweight' && set.weight_kg == null)
      const effKg = isBW ? null : (set.weight_kg ?? ex.weight_kg)
      const effReps = (set.reps ?? 0) * (set.rounds ?? 1) * complexRounds
      const load = isBW ? 0 : effReps * effKg * (effType === 'double' ? 2 : 1)
      records.push({
        name: ex.exercise_name,
        type: isBW ? 'bodyweight' : effType,
        weight: isBW ? null : effKg,
        date: day.date,
        reps: effReps,
        load,
        isBW,
      })
    }
  }

  // Group by bucket (name, type, weight) → per-period + per-day accumulators
  const buckets = new Map()
  for (const r of records) {
    const bkey = `${r.name}|${r.type}|${r.weight ?? 'bw'}`
    if (!buckets.has(bkey)) {
      buckets.set(bkey, {
        name: r.name, type: r.type, weight: r.weight, isBW: r.isBW,
        periods: new Map(),  // periodKey -> { reps, load, dates:Set, periodDate }
        days:    new Map(),  // dateStr  -> { reps, load }
      })
    }
    const bucket = buckets.get(bkey)
    const pkey = getPeriodKey(granularity, r.date)
    if (!bucket.periods.has(pkey)) {
      bucket.periods.set(pkey, { reps: 0, load: 0, dates: new Set(), periodDate: getPeriodStart(granularity, r.date) })
    }
    const p = bucket.periods.get(pkey)
    p.reps += r.reps
    p.load += r.load
    p.dates.add(r.date)
    if (!bucket.days.has(r.date)) bucket.days.set(r.date, { reps: 0, load: 0 })
    const dEntry = bucket.days.get(r.date)
    dEntry.reps += r.reps
    dEntry.load += r.load
  }

  const currentKey = getPeriodKey(granularity, referenceDate)
  const currentStart = getPeriodStart(granularity, referenceDate)
  const currentEnd   = getPeriodEnd(granularity, referenceDate)
  const currentStartStr = toDateStr(currentStart)
  const currentEndStr   = toDateStr(currentEnd)

  // Build per-bucket + per-exercise views for THIS period
  const exerciseMap = new Map()
  for (const bucket of buckets.values()) {
    const current = bucket.periods.get(currentKey)
    if (!current || current.reps === 0) continue  // skip buckets with no activity in current period

    // Best period ever for this bucket (max reps for BW, max load for weighted)
    let bestPeriodEver = { key: null, reps: 0, load: 0, date: null }
    for (const [pkey, p] of bucket.periods) {
      const metric = bucket.isBW ? p.reps : p.load
      const bestMetric = bucket.isBW ? bestPeriodEver.reps : bestPeriodEver.load
      if (metric > bestMetric) {
        bestPeriodEver = { key: pkey, reps: p.reps, load: p.load, date: p.periodDate }
      }
    }

    // Best day within the current period for this bucket
    let bestDayInPeriod = { date: null, reps: 0 }
    for (const [date, dayData] of bucket.days) {
      if (date >= currentStartStr && date <= currentEndStr) {
        if (dayData.reps > bestDayInPeriod.reps) {
          bestDayInPeriod = { date, reps: dayData.reps }
        }
      }
    }

    // Sparkline data — last 8 periods (including current, may include zero-reps periods)
    const sparkline = []
    for (let i = 7; i >= 0; i--) {
      const dt = shiftPeriod(granularity, referenceDate, -i)
      const key = getPeriodKey(granularity, dt)
      const p = bucket.periods.get(key)
      sparkline.push({
        key,
        label: formatPeriodShort(granularity, dt),
        reps: p?.reps ?? 0,
        load: p?.load ?? 0,
        isCurrent: i === 0,
      })
    }

    const bucketResult = {
      name: bucket.name,
      type: bucket.type,
      weight: bucket.weight,
      isBW: bucket.isBW,
      currentReps: current.reps,
      currentLoad: current.load,
      currentSessions: current.dates.size,
      bestPeriodEver, // { key, reps, load, date }
      bestDayInPeriod,
      isNewPB: (bucket.isBW ? current.reps : current.load) >= (bucket.isBW ? bestPeriodEver.reps : bestPeriodEver.load) && current.reps > 0,
      sparkline,
    }

    if (!exerciseMap.has(bucket.name)) {
      exerciseMap.set(bucket.name, {
        name: bucket.name,
        totalReps: 0,
        totalLoad: 0,
        allBW: true,   // becomes false when any bucket is weighted
        heaviest: null, // { weight_type, weight_kg, reps }
        buckets: [],
      })
    }
    const exEntry = exerciseMap.get(bucket.name)
    exEntry.totalReps += bucketResult.currentReps
    exEntry.totalLoad += bucketResult.currentLoad
    if (!bucket.isBW) {
      exEntry.allBW = false
      // Track heaviest weighted bucket with activity
      if (!exEntry.heaviest || (bucket.weight ?? 0) > (exEntry.heaviest.weight_kg ?? 0)) {
        exEntry.heaviest = { weight_type: bucket.type, weight_kg: bucket.weight, reps: bucketResult.currentReps }
      }
    }
    exEntry.buckets.push(bucketResult)
  }

  // Sort each exercise's buckets by weight ascending (BW first, then light → heavy)
  for (const ex of exerciseMap.values()) {
    ex.buckets.sort((a, b) => {
      if (a.isBW && !b.isBW) return -1
      if (!a.isBW && b.isBW) return 1
      // Both weighted: sort by (type single before double), then by weight
      if (a.type !== b.type) return a.type === 'single' ? -1 : 1
      return (a.weight ?? 0) - (b.weight ?? 0)
    })
  }

  // Overall period totals + best-ever period (across all exercises)
  const periodTotals = new Map()
  for (const bucket of buckets.values()) {
    for (const [pkey, p] of bucket.periods) {
      if (!periodTotals.has(pkey)) {
        periodTotals.set(pkey, { reps: 0, load: 0, dates: new Set(), periodDate: p.periodDate })
      }
      const t = periodTotals.get(pkey)
      t.reps += p.reps
      t.load += p.load
      for (const d of p.dates) t.dates.add(d)
    }
  }
  const currentTotal = periodTotals.get(currentKey) ?? { reps: 0, load: 0, dates: new Set() }
  let bestPeriodTotalEver = { key: null, reps: 0, load: 0, date: null }
  for (const [pkey, t] of periodTotals) {
    if (t.load > bestPeriodTotalEver.load) {
      bestPeriodTotalEver = { key: pkey, reps: t.reps, load: t.load, date: t.periodDate }
    }
  }

  // Top chart — last 12 periods total load + reps
  const chart = []
  for (let i = 11; i >= 0; i--) {
    const dt = shiftPeriod(granularity, referenceDate, -i)
    const key = getPeriodKey(granularity, dt)
    const t = periodTotals.get(key)
    chart.push({
      key,
      label: formatPeriodShort(granularity, dt),
      reps: t?.reps ?? 0,
      load: t?.load ?? 0,
      sessions: t?.dates?.size ?? 0,
      isCurrent: i === 0,
    })
  }

  // Sort exercises by total reps done in the period (descending).
  // Reps is a universal measure — puts the most-done exercises on top regardless of
  // whether they're weighted or bodyweight.
  const exercises = [...exerciseMap.values()].sort((a, b) => b.totalReps - a.totalReps)

  return {
    granularity,
    referenceDate: toDateStr(new Date(referenceDate)),
    currentLabel: formatPeriodLabel(granularity, referenceDate),
    totals: {
      reps: currentTotal.reps,
      load: currentTotal.load,
      sessions: currentTotal.dates?.size ?? 0,
    },
    bestEver: bestPeriodTotalEver,
    chart,
    exercises,
  }
}

// Templates: distinct past complexes (by ordered exercise-name signature),
// most-recent version returned. Used by the "Load previous complex" picker.
export async function getComplexTemplates(userId) {
  const { data, error } = await supabase
    .from('workout_complexes')
    .select(`
      id, rounds, workout_day_id,
      workout_days(date, submitted),
      workout_exercises(id, exercise_name, weight_kg, weight_type, display_order, exercise_sets(reps, weight_kg, weight_type, rounds, set_number))
    `)
    .eq('user_id', userId)
  if (error) throw error

  // Build template objects (skip empty complexes and unsubmitted days)
  const templates = []
  for (const cx of data ?? []) {
    if (!cx.workout_days?.submitted) continue
    const exs = (cx.workout_exercises ?? [])
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(ex => {
        const s = (ex.exercise_sets ?? [])
          .slice()
          .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))[0]
        return {
          name: ex.exercise_name ?? '',
          weight_kg: s?.weight_kg ?? ex.weight_kg ?? null,
          weight_type: s?.weight_type ?? ex.weight_type ?? 'single',
          reps: s?.reps ?? null,
        }
      })
      .filter(e => e.name && e.reps != null)
    if (exs.length === 0) continue
    templates.push({
      lastDate: cx.workout_days?.date ?? null,
      exercises: exs,
      // Templates capture STRUCTURE + REPS only. Weight and rounds are deliberately
      // excluded so the same complex done at different loads dedupes into one entry —
      // you pick the template, then dial in kg and rounds for the session.
      signature: exs.map(e => `${e.name}|${e.reps}`).join('>'),
    })
  }

  // Dedup by signature — keep the most recent per signature
  const bySig = new Map()
  for (const t of templates) {
    const existing = bySig.get(t.signature)
    if (!existing || (t.lastDate ?? '') > (existing.lastDate ?? '')) {
      bySig.set(t.signature, t)
    }
  }
  return [...bySig.values()].sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
}

// Populate an existing (empty) complex with a template's exercises.
// Applies STRUCTURE + REPS only — weight defaults to 24kg single and rounds stay at 0,
// so you dial in the load and count rounds fresh for this session.
export async function applyComplexTemplate(userId, complexId, workoutDayId, template) {
  const { exercises } = template

  const created = []
  for (let i = 0; i < exercises.length; i++) {
    const tex = exercises[i]
    const { data: newEx, error: exErr } = await supabase
      .from('workout_exercises')
      .insert({
        user_id: userId,
        workout_day_id: workoutDayId,
        exercise_name: tex.name,
        weight_kg: 24,
        weight_type: 'single',
        display_order: i,
        complex_id: complexId,
      })
      .select()
      .single()
    if (exErr) throw exErr
    const { data: newSet, error: setErr } = await supabase
      .from('exercise_sets')
      .insert({
        user_id: userId,
        workout_exercise_id: newEx.id,
        set_number: 1,
        reps: tex.reps,
        weight_kg: 24,
        weight_type: 'single',
        rounds: 1,
      })
      .select()
      .single()
    if (setErr) throw setErr
    created.push({ exercise: newEx, set: newSet })
  }
  // Rounds intentionally left as-is (0 for a freshly-added complex)
  return { exercises: created }
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
    .select('exercise_name, weight_kg, weight_type, complex_id, workout_days(date, submitted), exercise_sets(reps, rounds), workout_complexes(rounds)')
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
      const complexRounds = ex.workout_complexes?.rounds ?? 1
      s.recentSessions += 1
      s.recentReps += (ex.exercise_sets ?? [])
        .reduce((a, ss) => a + (ss.reps ?? 0) * (ss.rounds ?? 1) * complexRounds, 0)
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

// Copy a previous workout's structure (top-level exercises + complexes with their inner
// exercises) to a target date. Does NOT copy logged reps/sets. Appends if the target
// day already has content.
export async function copyWorkoutToDate(userId, sourceDayId, targetDate) {
  // Read source exercises (both top-level and complex-linked)
  const { data: sourceExs, error: srcErr } = await supabase
    .from('workout_exercises')
    .select('id, exercise_name, weight_kg, weight_type, display_order, complex_id, exercise_sets(reps, weight_kg, weight_type, rounds, set_number)')
    .eq('user_id', userId)
    .eq('workout_day_id', sourceDayId)
    .order('display_order', { ascending: true })
  if (srcErr) throw srcErr

  // Read source complexes
  const { data: sourceCxs, error: cxErr } = await supabase
    .from('workout_complexes')
    .select('id, rounds, display_order')
    .eq('user_id', userId)
    .eq('workout_day_id', sourceDayId)
    .order('display_order', { ascending: true })
  if (cxErr) throw cxErr

  if ((!sourceExs || sourceExs.length === 0) && (!sourceCxs || sourceCxs.length === 0)) {
    throw new Error('Source workout has nothing to copy')
  }

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

  // Compute base display order across BOTH tables so appended content follows any existing rows
  const [{ data: existingExs }, { data: existingCxs }] = await Promise.all([
    supabase.from('workout_exercises').select('display_order').eq('user_id', userId).eq('workout_day_id', targetDay.id),
    supabase.from('workout_complexes').select('display_order').eq('user_id', userId).eq('workout_day_id', targetDay.id),
  ])
  const existingMax = Math.max(
    (existingExs ?? []).reduce((m, e) => Math.max(m, e.display_order ?? 0), -1),
    (existingCxs ?? []).reduce((m, c) => Math.max(m, c.display_order ?? 0), -1),
  )
  const baseOrder = existingMax + 1

  // 1) Copy top-level exercises (complex_id IS NULL)
  const topLevel = (sourceExs ?? []).filter(e => !e.complex_id)
  if (topLevel.length > 0) {
    const rows = topLevel.map((ex, i) => ({
      user_id: userId,
      workout_day_id: targetDay.id,
      exercise_name: ex.exercise_name,
      weight_kg: ex.weight_kg,
      weight_type: ex.weight_type,
      display_order: baseOrder + i,
    }))
    const { error: insErr } = await supabase.from('workout_exercises').insert(rows)
    if (insErr) throw insErr
  }

  // 2) Copy each complex: create the complex row, then insert its inner exercises + one implicit set per exercise
  const complexOffset = baseOrder + topLevel.length
  for (let cxIdx = 0; cxIdx < (sourceCxs ?? []).length; cxIdx++) {
    const srcCx = sourceCxs[cxIdx]
    const { data: newCx, error: newCxErr } = await supabase
      .from('workout_complexes')
      .insert({
        user_id: userId,
        workout_day_id: targetDay.id,
        rounds: srcCx.rounds ?? 1,
        display_order: complexOffset + cxIdx,
      })
      .select()
      .single()
    if (newCxErr) throw newCxErr

    // Exercises that belonged to this source complex
    const cxExercises = (sourceExs ?? []).filter(e => e.complex_id === srcCx.id)
    for (let exIdx = 0; exIdx < cxExercises.length; exIdx++) {
      const srcEx = cxExercises[exIdx]
      // Insert the exercise
      const { data: newEx, error: exInsErr } = await supabase
        .from('workout_exercises')
        .insert({
          user_id: userId,
          workout_day_id: targetDay.id,
          exercise_name: srcEx.exercise_name,
          weight_kg: srcEx.weight_kg,
          weight_type: srcEx.weight_type,
          display_order: exIdx,
          complex_id: newCx.id,
        })
        .select()
        .single()
      if (exInsErr) throw exInsErr

      // Copy the ONE implicit set structure (name/weight only — NOT reps).
      // Prefer set_number=1 from the source; fall back to sensible defaults.
      const templateSet = (srcEx.exercise_sets ?? [])
        .slice()
        .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))[0]
      const { error: setInsErr } = await supabase
        .from('exercise_sets')
        .insert({
          user_id: userId,
          workout_exercise_id: newEx.id,
          set_number: 1,
          reps: null,
          weight_kg: templateSet?.weight_kg ?? srcEx.weight_kg,
          weight_type: templateSet?.weight_type ?? srcEx.weight_type,
          rounds: 1,
        })
      if (setInsErr) throw setInsErr
    }
  }

  return targetDay
}

// Catalog: list all unique exercises with usage stats.
// Skips exercise instances that have zero non-empty sets so they don't inflate counts.
export async function getExerciseCatalog(userId) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('exercise_name, weight_type, weight_kg, complex_id, workout_days(date, submitted), exercise_sets(reps, rounds), workout_complexes(rounds)')
    .eq('user_id', userId)
  if (error) throw error

  const map = new Map()
  for (const ex of data ?? []) {
    const name = ex.exercise_name
    if (!name) continue
    const day = ex.workout_days
    if (!day?.submitted) continue
    const nonEmptySets = (ex.exercise_sets ?? []).filter(s => s.reps != null)
    if (nonEmptySets.length === 0) continue
    const complexRounds = ex.workout_complexes?.rounds ?? 1
    if (!map.has(name)) {
      map.set(name, { name, sessions: 0, lastDate: null, totalReps: 0, configs: new Set() })
    }
    const entry = map.get(name)
    entry.sessions += 1
    if (!entry.lastDate || day.date > entry.lastDate) entry.lastDate = day.date
    entry.totalReps += nonEmptySets.reduce(
      (a, s) => a + ((s.reps ?? 0) * (s.rounds ?? 1) * complexRounds),
      0
    )
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
  // Also fetch parent complex's rounds so complex-linked exercises get their multiplier.
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('id, weight_kg, weight_type, complex_id, exercise_sets(reps, weight_kg, weight_type, rounds), workout_complexes(rounds)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
  if (error) throw error
  if (!data || data.length === 0) return null

  let maxTotalReps = 0
  let maxSingleSetReps = 0

  for (const ex of data) {
    const exDefaultType   = ex.weight_type
    const exDefaultWeight = ex.weight_kg
    const complexRounds   = ex.workout_complexes?.rounds ?? 1
    const matchingSets = (ex.exercise_sets ?? []).filter(s => {
      if (s.reps == null) return false
      const eType = s.weight_type ?? exDefaultType
      if (eType !== weightType) return false
      if (weightType === 'bodyweight') return true
      const eWeight = s.weight_kg ?? exDefaultWeight
      return eWeight === weightKg
    })
    if (matchingSets.length === 0) continue
    // Session total = sum(reps * per-set rounds * complex rounds)
    const sessionTotal = matchingSets.reduce(
      (sum, s) => sum + ((s.reps ?? 0) * (s.rounds ?? 1) * complexRounds),
      0
    )
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
    .select(`
      *,
      workout_exercises(exercise_name, weight_kg, weight_type, complex_id, display_order, exercise_sets(reps, weight_kg, weight_type, set_number, rounds)),
      workout_complexes(id, rounds, display_order)
    `)
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
    .select('id, weight_kg, weight_type, complex_id, workout_days(date), exercise_sets(set_number, reps, weight_kg, weight_type, rounds), workout_complexes(rounds)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(ex => {
    const complexRounds = ex.workout_complexes?.rounds ?? 1
    return {
      date: ex.workout_days?.date,
      weight_kg: ex.weight_kg,
      weight_type: ex.weight_type,
      complex_rounds: complexRounds,
      sets: (ex.exercise_sets ?? [])
        .filter(s => s.reps != null)
        .map(s => ({
          ...s,
          rounds: s.rounds ?? 1,
          complex_rounds: complexRounds,
          effective_weight_kg: s.weight_kg ?? ex.weight_kg,
          effective_weight_type: s.weight_type ?? ex.weight_type,
        })),
    }
  })
  // Drop entries with no date or zero non-empty sets — these are orphan
  // exercise rows from sessions where nothing was actually logged.
  .filter(e => e.date && e.sets.length > 0)
}
