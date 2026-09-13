// Pure helpers for saved workouts ("templates"): normalizing past sessions,
// picking the best one, and deriving the grey target reps shown while logging.

const nameKey = (name) => (name ?? '').trim().toLowerCase()

// Structure key for a complex: its exercise names in order (reps/weights ignored)
export function complexSignature(names) {
  return names.map(nameKey).join('>')
}

// Raw workout_days row (with embedded exercises/sets/complexes) → session shape
export function normalizeTemplateSession(day) {
  const rawExercises = day.workout_exercises ?? []
  const byOrder = (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  const bySetNumber = (a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)

  const toSet = (s) => ({
    reps: s.reps,
    weightKg: s.weight_kg ?? null,
    weightType: s.weight_type ?? null,
    rounds: s.rounds ?? 1,
  })

  const exercises = rawExercises
    .filter(ex => !ex.complex_id && ex.exercise_name)
    .sort(byOrder)
    .map(ex => ({
      name: ex.exercise_name,
      displayOrder: ex.display_order ?? 0,
      weightKg: ex.weight_kg ?? null,
      weightType: ex.weight_type ?? 'single',
      sets: (ex.exercise_sets ?? []).filter(s => s.reps != null).sort(bySetNumber).map(toSet),
    }))
    .filter(ex => ex.sets.length > 0)

  const complexes = (day.workout_complexes ?? [])
    .slice()
    .sort(byOrder)
    .map(cx => ({
      rounds: cx.rounds ?? 0,
      displayOrder: cx.display_order ?? 0,
      exercises: rawExercises
        .filter(ex => ex.complex_id === cx.id && ex.exercise_name)
        .sort(byOrder)
        .map(ex => {
          const s = (ex.exercise_sets ?? []).slice().sort(bySetNumber)[0]
          return {
            name: ex.exercise_name,
            weightKg: s?.weight_kg ?? ex.weight_kg ?? null,
            weightType: s?.weight_type ?? ex.weight_type ?? 'single',
            reps: s?.reps ?? null,
          }
        })
        .filter(e => e.reps != null),
    }))
    .filter(cx => cx.exercises.length > 0)

  const session = { dayId: day.id, date: day.date, exercises, complexes }
  session.totalReps = [...exerciseTotalsForSession(session).values()].reduce((a, t) => a + t.reps, 0)
  return session
}

// Per-exercise total reps (sets × rounds, × complex rounds) for a past session
export function exerciseTotalsForSession(session) {
  const totals = new Map()
  const add = (name, reps) => {
    const k = nameKey(name)
    if (!totals.has(k)) totals.set(k, { name, reps: 0 })
    totals.get(k).reps += reps
  }
  for (const ex of session.exercises) {
    for (const s of ex.sets) add(ex.name, (s.reps ?? 0) * (s.rounds ?? 1))
  }
  for (const cx of session.complexes) {
    for (const e of cx.exercises) add(e.name, (e.reps ?? 0) * cx.rounds)
  }
  return totals
}

// Same totals, computed from the live WorkoutDay state
export function exerciseTotalsForState(exercises, complexes) {
  const totals = new Map()
  const add = (name, reps) => {
    if (!name) return
    const k = nameKey(name)
    if (!totals.has(k)) totals.set(k, { name, reps: 0 })
    totals.get(k).reps += reps
  }
  for (const ex of exercises ?? []) {
    for (const s of ex.sets) add(ex.exerciseName, (s.reps ?? 0) * (s.rounds ?? 1))
  }
  for (const cx of complexes ?? []) {
    for (const ex of cx.exercises) {
      for (const s of ex.sets) add(ex.exerciseName, (s.reps ?? 0) * (s.rounds ?? 1) * (cx.rounds ?? 0))
    }
  }
  return totals
}

export function pickBestSession(sessions) {
  if (!sessions || sessions.length === 0) return null
  return sessions.reduce((best, s) => (s.totalReps > best.totalReps ? s : best), sessions[0])
}

// Grey targets from the best session. Exercises are matched by name + occurrence
// (so reordering doesn't break them); complexes by exercise-name structure + occurrence.
export function buildGhosts(bestSession) {
  const exerciseSets = new Map()   // "pushups#0" -> [20, 18, 15]
  const complexRounds = new Map()  // "pushups>long cycle#0" -> 5
  if (!bestSession) return { exerciseSets, complexRounds }

  const seen = new Map()
  for (const ex of bestSession.exercises) {
    const base = nameKey(ex.name)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    exerciseSets.set(`${base}#${n}`, ex.sets.map(s => s.reps))
  }
  const seenCx = new Map()
  for (const cx of bestSession.complexes) {
    const sig = complexSignature(cx.exercises.map(e => e.name))
    const n = seenCx.get(sig) ?? 0
    seenCx.set(sig, n + 1)
    complexRounds.set(`${sig}#${n}`, cx.rounds)
  }
  return { exerciseSets, complexRounds }
}

export { nameKey }
