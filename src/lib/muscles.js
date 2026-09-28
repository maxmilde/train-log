// Muscle groups, the built-in classification of exercises, and per-muscle set counting.
// Pure helpers: no React, no database.

import { nameKey } from './workoutTemplates'

// Each group lists the body-diagram regions (from the body-muscles package) it colours.
// Regions are matched by prefix and cover both sides. Some package names don't match
// what's drawn, so these follow the drawing: e.g. 'abs-upper' sits on the flanks
// (obliques) and 'shoulder-front' is the top of the traps.
export const MUSCLE_GROUPS = [
  { id: 'chest',      label: 'Chest',      area: 'upper', regions: ['chest-'] },
  { id: 'shoulders',  label: 'Shoulders',  area: 'upper', regions: ['shoulder-side-', 'deltoid-rear-'] },
  { id: 'traps',      label: 'Traps',      area: 'upper', regions: ['shoulder-front-', 'traps-upper-', 'traps-lower-'] },
  { id: 'upperBack',  label: 'Upper back', area: 'upper', regions: ['traps-mid-', 'lats-upper-'] },
  { id: 'lats',       label: 'Lats',       area: 'upper', regions: ['lats-mid-', 'lats-lower-'] },
  { id: 'biceps',     label: 'Biceps',     area: 'upper', regions: ['biceps-'] },
  { id: 'triceps',    label: 'Triceps',    area: 'upper', regions: ['triceps-'] },
  { id: 'forearms',   label: 'Forearms',   area: 'upper', regions: ['forearm-'] },
  { id: 'abs',        label: 'Abs',        area: 'core',  regions: ['serratus-anterior-', 'obliques-', 'abs-lower-'] },
  { id: 'obliques',   label: 'Obliques',   area: 'core',  regions: ['abs-upper-'] },
  { id: 'lowerBack',  label: 'Lower back', area: 'core',  regions: ['lower-back-'] },
  { id: 'glutes',     label: 'Glutes',     area: 'lower', regions: ['gluteus-'] },
  { id: 'quads',      label: 'Quads',      area: 'lower', regions: ['quads-'] },
  { id: 'hamstrings', label: 'Hamstrings', area: 'lower', regions: ['hamstrings-'] },
  { id: 'adductors',  label: 'Inner thighs',  area: 'lower', regions: ['adductors-', 'hip-flexor-'] },
  { id: 'calves',     label: 'Calves',     area: 'lower', regions: ['calves-', 'tibialis-'] },
]

export const AREAS = [
  { id: 'upper', label: 'Upper body' },
  { id: 'core',  label: 'Core' },
  { id: 'lower', label: 'Lower body' },
]

const GROUP_IDS = new Set(MUSCLE_GROUPS.map(g => g.id))

// Diagram region id -> muscle group id (null for head, hands, knees etc.)
export function groupForRegion(regionId) {
  const g = MUSCLE_GROUPS.find(g => g.regions.some(prefix => regionId.startsWith(prefix)))
  return g?.id ?? null
}

// How much one set counts toward a muscle at each level
export const LEVEL_WEIGHT = { primary: 1, secondary: 0.75, tertiary: 0.5, quaternary: 0.25 }
export const LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary']
export const LEVEL_LABEL = { primary: '1st', secondary: '2nd', tertiary: '3rd', quaternary: '4th' }

// ── BUILT-IN CLASSIFICATION ───────────────────────────────────────────────────
// Pre-filled from the exercises logged so far. Anything saved in the app
// (exercise_muscles table) overrides these. Old chains are under CHAINS below.
const m = (primary, secondary = [], tertiary = [], quaternary = []) =>
  ({ primary, secondary, tertiary, quaternary, notCounted: false })

// Exercises chained into one (e.g. Clean-Squat): each muscle takes its highest level
function combine(...parts) {
  const best = new Map()  // muscle -> level index
  for (const part of parts) {
    LEVELS.forEach((level, i) => {
      for (const id of part[level]) if (!best.has(id) || i < best.get(id)) best.set(id, i)
    })
  }
  const out = m([], [], [], [])
  for (const [id, i] of best) out[LEVELS[i]].push(id)
  return out
}

const pushup      = m(['chest', 'triceps'], ['shoulders'], [], ['abs'])
// A burpee without the jump, with pushups at the bottom; core works least
const pump        = m(['chest', 'triceps'], ['shoulders'], ['quads', 'glutes'], ['abs'])
const row         = m(['lats', 'upperBack'], ['biceps'], ['shoulders', 'forearms'], ['lowerBack'])
const press       = m(['shoulders'], ['triceps'], ['traps'], ['abs'])
const pushPress   = m(['shoulders'], ['triceps', 'quads'], ['glutes'], ['traps', 'calves'])
// Heavy cleans work the biceps hard (owner's experience) on top of the hip drive
const clean       = m(['glutes', 'hamstrings', 'biceps'], ['forearms', 'lowerBack'], ['traps', 'quads'], ['abs'])
const jerk        = m(['shoulders', 'triceps', 'quads'], ['glutes', 'calves'], ['traps', 'upperBack', 'forearms'], ['abs'])
const snatch      = m(['shoulders', 'hamstrings', 'glutes'], ['forearms', 'traps', 'upperBack', 'lowerBack'], ['quads', 'biceps', 'lats'], ['abs'])
// Same as the snatch but the drop goes to the rack, so less grip
const halfSnatch  = m(['shoulders', 'hamstrings', 'glutes'], ['traps', 'upperBack', 'lowerBack'], ['forearms', 'quads', 'biceps', 'lats'], ['abs'])
const swing       = m(['glutes', 'hamstrings', 'lowerBack'], ['forearms'], ['abs', 'shoulders', 'lats'], ['quads', 'traps'])
const squat       = m(['quads', 'glutes'], ['adductors'], ['hamstrings', 'lowerBack'], ['abs'])
const lunge       = m(['quads', 'glutes'], ['hamstrings', 'adductors'], [], ['calves'])
const highPull    = m(['traps', 'upperBack', 'shoulders'], ['glutes', 'hamstrings'], ['lowerBack', 'biceps', 'forearms'], ['abs', 'calves'])
const triceps     = m(['triceps'])
const longCycle   = combine(clean, jerk)

const DEFAULTS = {
  '1 pump': pump,
  '2 pump': pump,
  '3 pump': pump,
  'pump pushups': pump,
  'navy seal pushup': pump,
  'pushups': pushup,
  'bring sally up': pushup,
  'hindu pushups': m(['chest', 'shoulders', 'triceps'], [], ['abs'], ['lowerBack']),
  'tricep pushups': m(['triceps'], ['chest'], ['shoulders'], ['abs']),
  'pullups': m(['lats'], ['biceps', 'upperBack'], ['forearms'], ['abs']),
  'bent row': row,
  'row': row,
  'gorilla row': m(['lats', 'upperBack'], ['biceps', 'shoulders'], ['forearms', 'lowerBack', 'obliques', 'abs'], ['glutes', 'hamstrings']),
  'high pulls': highPull,
  'shrugs': m(['traps'], [], ['forearms']),
  'bicep curls': m(['biceps'], [], ['forearms']),
  'skull crusher': triceps,
  'tricep extensions': triceps,
  'press': press,
  'side raises': m(['shoulders'], [], ['traps']),
  'side bend press': m(['shoulders', 'obliques'], ['triceps'], ['abs'], ['glutes', 'hamstrings']),
  'push press': pushPress,
  'clean press': combine(clean, press),
  'clean pp': combine(clean, pushPress),
  'clean': clean,
  'jerk': jerk,
  'long cycle': longCycle,
  // The Long Cycle with holds in each position; the holds load the grip heavily
  'hold-rack-top': combine(longCycle, m(['forearms'])),
  'half snatch': halfSnatch,
  'snatch': snatch,
  'swing': swing,
  'swings': swing,
  'deadlift': m(['glutes', 'hamstrings'], ['lowerBack'], ['forearms', 'traps'], ['quads']),
  'squats': squat,
  'lunges': lunge,
  'hindu squats': m(['quads'], ['glutes', 'calves'], ['hamstrings'], ['abs']),
  'thruster': m(['quads', 'glutes', 'shoulders'], ['triceps'], ['traps'], ['abs']),
  'sommersault': m(['glutes'], ['hamstrings'], ['lowerBack']),
  'calf raise': m(['calves']),
  'crunches': m(['abs'], ['obliques']),
  'plank': m(['abs'], ['obliques'], ['shoulders']),
}

// ── CHAINS ────────────────────────────────────────────────────────────────────
// Chains logged as one exercise before complexes existed (the history keeps them as
// they are). For the map they count as their parts: a part's reps are the number in
// the name (1 if none) × the logged reps, so "4HS-5Jerk" × 2 = 8 Half Snatch + 10 Jerk
// and "Clean-Squat" × 8 = 8 Clean + 8 Squats. DS = double snatch (two bells).
const part = (name, reps = 1) => ({ name, reps })
const CHAINS = {
  'clean-squat': [part('Clean'), part('Squats')],
  'clean-squat-lunge-lunge': [part('Clean'), part('Squats'), part('Lunges')],
  'squat-lunge-lunge': [part('Squats'), part('Lunges')],
  'ds-clean-press': [part('Snatch'), part('Clean'), part('Press')],
  'hs-jerk-fsquat': [part('Half Snatch'), part('Jerk'), part('Squats')],
  'hs-lc': [part('Half Snatch'), part('Long Cycle')],
  'hs-lc-squat': [part('Half Snatch'), part('Long Cycle'), part('Squats')],
  'hs-squat': [part('Half Snatch'), part('Squats')],
  'swing-clean-ppress-squat-hpull': [part('Swing'), part('Clean'), part('Push press'), part('Squats'), part('High pulls')],
  'swing-clean-ppress-squat-row': [part('Swing'), part('Clean'), part('Push press'), part('Squats'), part('Row')],
  'swing-hs': [part('Swing'), part('Half Snatch')],
  'swing-lc': [part('Swing'), part('Long Cycle')],
  'swing-snatch': [part('Swing'), part('Snatch')],
  '10pushup-10hindusquat': [part('Pushups', 10), part('Hindu squats', 10)],
  '10pushup-10hindusquat-5pullup': [part('Pushups', 10), part('Hindu squats', 10), part('Pullups', 5)],
  '1j-2hs-1lc': [part('Jerk'), part('Half Snatch', 2), part('Long Cycle')],
  '2clean-1press-3squat': [part('Clean', 2), part('Press'), part('Squats', 3)],
  '2hs-jerk-3lc': [part('Half Snatch', 2), part('Jerk'), part('Long Cycle', 3)],
  '2jerk-2/2row-10/10hs': [part('Jerk', 2), part('Row', 2), part('Half Snatch', 10)],
  '4hs-5jerk': [part('Half Snatch', 4), part('Jerk', 5)],
  '4hs-5press': [part('Half Snatch', 4), part('Press', 5)],
  '6/6gr-lc-jerk': [part('Gorilla row', 6), part('Long Cycle'), part('Jerk')],
}

// The parts of a chain, or null for a normal exercise
export function chainParts(name) {
  return CHAINS[nameKey(name)] ?? null
}

// A new name with a number in it is probably a combo; the popup suggests "don't count"
export function looksLikeCombo(name) {
  return /\d/.test(name ?? '')
}

// Saved row (exercise_muscles) -> classification shape, dropping unknown muscle ids
export function classificationFromRow(row) {
  const clean = (list) => (list ?? []).filter(id => GROUP_IDS.has(id))
  return {
    primary: clean(row.primary_muscles),
    secondary: clean(row.secondary_muscles),
    tertiary: clean(row.tertiary_muscles),
    quaternary: clean(row.quaternary_muscles),
    notCounted: !!row.not_counted,
  }
}

// The classification for an exercise name: saved override first, then the built-in
// default. null = unclassified. `saved` is a Map of nameKey -> classification.
export function classify(name, saved) {
  const key = nameKey(name)
  if (!key) return null
  if (CHAINS[key]) return { ...m([]), chain: CHAINS[key] }
  return saved?.get(key) ?? DEFAULTS[key] ?? null
}

// ── SET COUNTING ──────────────────────────────────────────────────────────────

// A normal set is up to ~20 reps (8 Long Cycles at 2×24, 20 at 2×20). Longer sets,
// like a 10-minute Long Cycle set, count as one set per REPS_PER_SET reps, so 100 reps
// count as about 7 sets instead of 1. An empty (planned) set counts as 1.
export const REPS_PER_SET = 15
export function setsForReps(reps) {
  if (reps == null) return 1
  return reps > 0 ? Math.max(1, Math.round(reps / REPS_PER_SET)) : 0
}

// Spread per-exercise set counts onto muscles.
// exerciseSets: Map of exercise name -> sets. Returns
// { sets: Map muscleId -> weighted sets, unclassified: [names] }.
export function muscleSets(exerciseSets, saved) {
  const sets = new Map(MUSCLE_GROUPS.map(g => [g.id, 0]))
  const unclassified = []
  for (const [name, count] of exerciseSets) {
    if (!count) continue
    const c = classify(name, saved)
    if (!c) { unclassified.push(name); continue }
    if (c.notCounted || c.chain) continue
    for (const level of LEVELS) {
      for (const id of c[level]) sets.set(id, sets.get(id) + count * LEVEL_WEIGHT[level])
    }
  }
  return { sets, unclassified }
}

// Add one logged set (reps, × multiplier for rounds) to a Map of exercise name -> sets.
// Chains are split into their parts.
export function addSets(counts, name, reps, multiplier = 1) {
  if (!name || !multiplier) return
  const parts = chainParts(name)
  const entries = parts
    ? parts.map(p => [p.name, reps == null ? null : p.reps * reps])
    : [[name, reps]]
  for (const [n, r] of entries) {
    const sets = setsForReps(r) * multiplier
    if (sets) counts.set(n, (counts.get(n) ?? 0) + sets)
  }
}

// Sets per exercise name for a day being logged (WorkoutDay state shape).
// A set with rounds ×3 is 3 sets; each complex round is one set of every exercise in it;
// very long sets count extra (setsForReps).
// With `planned`, empty sets count too and a complex counts at least one round,
// so the map previews a routine while you build it.
export function exerciseSetsForDay(exercises, complexes, { planned = false } = {}) {
  const out = new Map()
  for (const ex of exercises ?? []) {
    for (const set of ex.sets) {
      if (planned || set.reps) addSets(out, ex.exerciseName, set.reps, set.rounds ?? 1)
    }
  }
  for (const cx of complexes ?? []) {
    const rounds = planned ? Math.max(cx.rounds ?? 0, 1) : (cx.rounds ?? 0)
    for (const ex of cx.exercises ?? []) {
      const reps = ex.sets[0]?.reps
      if (planned || reps) addSets(out, ex.exerciseName, reps, rounds)
    }
  }
  return out
}

// Muscles with no sets, in list order
export function untrainedMuscles(sets) {
  return MUSCLE_GROUPS.filter(g => !(sets.get(g.id) > 0))
}

// Sets for display: 3, 2.5, 0.75 (quarters are exact, so two decimals at most)
export function formatSets(n) {
  return String(Math.round(n * 100) / 100)
}
