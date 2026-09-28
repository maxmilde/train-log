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
// (exercise_muscles table) overrides these. A name with a number in it is a combo
// logged as one exercise (e.g. "4HS-5Jerk") and isn't counted — except the pumps.
const m = (primary, secondary = [], tertiary = [], quaternary = []) =>
  ({ primary, secondary, tertiary, quaternary, notCounted: false })
const COMBO = { primary: [], secondary: [], tertiary: [], quaternary: [], notCounted: true }

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
  'thruster': m(['quads', 'glutes', 'shoulders'], ['triceps'], ['traps'], ['abs']),
  'sommersault': m(['glutes'], ['hamstrings'], ['lowerBack']),
  'calf raise': m(['calves']),
  'crunches': m(['abs'], ['obliques']),
  'plank': m(['abs'], ['obliques'], ['shoulders']),
  // Chained exercises without numbers count as one exercise
  'clean-squat': combine(clean, squat),
  'clean-squat-lunge-lunge': combine(clean, squat, lunge),
  'squat-lunge-lunge': combine(squat, lunge),
  'ds-clean-press': combine(snatch, clean, press),
  'hs-jerk-fsquat': combine(halfSnatch, jerk, squat),
  'hs-lc': combine(halfSnatch, longCycle),
  'hs-lc-squat': combine(halfSnatch, longCycle, squat),
  'hs-squat': combine(halfSnatch, squat),
  'swing-clean-ppress-squat-hpull': combine(swing, clean, pushPress, squat, highPull),
  'swing-clean-ppress-squat-row': combine(swing, clean, pushPress, squat, row),
  'swing-hs': combine(swing, halfSnatch),
  'swing-lc': combine(swing, longCycle),
  'swing-snatch': combine(swing, snatch),
  // Combos (numbers in the name) — not counted
  '10pushup-10hindusquat': COMBO,
  '10pushup-10hindusquat-5pullup': COMBO,
  '1j-2hs-1lc': COMBO,
  '2clean-1press-3squat': COMBO,
  '2hs-jerk-3lc': COMBO,
  '2jerk-2/2row-10/10hs': COMBO,
  '4hs-5jerk': COMBO,
  '4hs-5press': COMBO,
  '6/6gr-lc-jerk': COMBO,
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
    if (c.notCounted) continue
    for (const level of LEVELS) {
      for (const id of c[level]) sets.set(id, sets.get(id) + count * LEVEL_WEIGHT[level])
    }
  }
  return { sets, unclassified }
}

// Sets per exercise name for a day being logged (WorkoutDay state shape).
// A set with rounds ×3 is 3 sets; each complex round is one set of every exercise in it;
// very long sets count extra (setsForReps).
// With `planned`, empty sets count too and a complex counts at least one round,
// so the map previews a routine while you build it.
export function exerciseSetsForDay(exercises, complexes, { planned = false } = {}) {
  const out = new Map()
  const add = (name, n) => {
    if (!name || !n) return
    out.set(name, (out.get(name) ?? 0) + n)
  }
  for (const ex of exercises ?? []) {
    for (const s of ex.sets) {
      if (planned || s.reps) add(ex.exerciseName, setsForReps(s.reps) * (s.rounds ?? 1))
    }
  }
  for (const cx of complexes ?? []) {
    const rounds = planned ? Math.max(cx.rounds ?? 0, 1) : (cx.rounds ?? 0)
    for (const ex of cx.exercises ?? []) {
      if (planned || ex.sets[0]?.reps) add(ex.exerciseName, setsForReps(ex.sets[0]?.reps) * rounds)
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
