import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
} from 'date-fns'

export function toDateStr(date) {
  return format(date, 'yyyy-MM-dd')
}

// The weight vest is its own weight_type ('vest'), distinct from kettlebell/dumbbell
// work. Reps are plain totals (never per-side "X/X") and there is no 1×/2× option.
// Load counts as reps × VEST_WEIGHT_KG × 1.
// NOTE: 10kg on its own is a normal weight (dumbbells) and keeps the 1×/2× toggle.
export const VEST_WEIGHT_KG = 10
export function isVestType(weightType) {
  return weightType === 'vest'
}
// ── WORKOUT DIFFICULTY ─────────────────────────────────────────────────────────
// Rated at the end of a workout. Heat gradient: lighter = easier.
// Class names are written out in full so Tailwind keeps them in the build.
export const DIFFICULTIES = [
  { value: 1, label: 'Easy',     bg: 'bg-yellow-200', onBg: 'text-gray-900' },
  { value: 2, label: 'Moderate', bg: 'bg-orange-400', onBg: 'text-gray-900' },
  { value: 3, label: 'Hard',     bg: 'bg-red-500',    onBg: 'text-white' },
  { value: 4, label: 'Brutal',   bg: 'bg-red-800',    onBg: 'text-white' },
]
// Colour for a submitted workout nobody has rated yet
export const UNRATED_BG = 'bg-green-500'

export function difficultyFor(value) {
  return DIFFICULTIES.find(d => d.value === value) ?? null
}

// Active Rest was retired; any day still stored as 'active_rest' is an Easy workout.
export function isWorkoutDay(day) {
  return day?.day_type === 'workout' || day?.day_type === 'active_rest'
}
export function dayDifficulty(day) {
  if (day?.difficulty) return day.difficulty
  return day?.day_type === 'active_rest' ? 1 : null
}

// Exercises that default to bodyweight when named. Matching ignores case, spaces,
// hyphens and a trailing plural "s", so "Pull-ups", "push ups" and "Crunch" all match.
const BW_DEFAULT_EXERCISES = new Set(['pullup', 'pushup', 'crunch'])
export function defaultsToBodyweight(exerciseName) {
  const key = (exerciseName ?? '').toLowerCase().replace(/[^a-z]/g, '').replace(/e?s$/, '')
  return BW_DEFAULT_EXERCISES.has(key)
}

// Label for any (weight_type, weight_kg) pair.
export function weightLabelFor(weightType, weightKg) {
  if (weightType === 'bodyweight' || weightKg == null) return 'BW'
  if (weightType === 'vest') return `Vest ${weightKg}kg`
  if (weightType === 'double') return `2×${weightKg}kg`
  return `${weightKg}kg`
}
// Reps read per-side ("20/20") only for single kettlebell work — not vest, not double, not BW.
export function repsAreParSide(weightType) {
  return weightType === 'single'
}

export function parseDateStr(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

export function buildHeatmapGrid(year) {
  const jan1  = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const gridStart = startOfWeek(jan1, { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(dec31, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(
      days.slice(i, i + 7).map(d => ({
        dateStr: toDateStr(d),
        isCurrentYear: d.getFullYear() === year,
      }))
    )
  }
  return weeks
}

export function buildMonthLabels(year) {
  const weeks = buildHeatmapGrid(year)
  const labels = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstDayOfYear = week.find(d => d.isCurrentYear)
    if (!firstDayOfYear) return
    const month = parseDateStr(firstDayOfYear.dateStr).getMonth()
    if (month !== lastMonth) {
      labels.push({ label: format(parseDateStr(firstDayOfYear.dateStr), 'MMM'), weekIndex: wi })
      lastMonth = month
    }
  })
  return labels
}

/**
 * Calculate goal stats for the dashboard.
 * Only submitted workouts count toward goals.
 */
export function calcGoalStats(days, weeklyGoal, now = new Date()) {
  // Only submitted workouts count for the goal. Legacy active-rest days count too:
  // they are Easy workouts now (the migration converts them).
  const workoutDays = new Map(
    days.filter(d => isWorkoutDay(d) && d.submitted).map(d => [d.date, d])
  )

  // THIS WEEK
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekDone  = weekDays.filter(d => workoutDays.has(toDateStr(d))).length
  const weekLabels = weekDays.map(d => {
    const ds = toDateStr(d)
    const day = workoutDays.get(ds)
    return {
      label: format(d, 'EEE'),
      done: !!day,
      difficulty: day ? dayDifficulty(day) : null,
      isFuture: d > now,
      dateStr: ds,
    }
  })

  // THIS MONTH
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const monthGoal  = Math.round((monthDays.length / 7) * weeklyGoal)
  const monthDone  = monthDays.filter(d => workoutDays.has(toDateStr(d))).length

  // THIS YEAR
  const yearStart  = startOfYear(now)
  const yearEnd    = endOfYear(now)
  const yearAllDays = eachDayOfInterval({ start: yearStart, end: yearEnd })
  const weeksInYear = Math.ceil(yearAllDays.length / 7)
  const yearGoal   = weeksInYear * weeklyGoal
  const yearDone   = yearAllDays.filter(d => workoutDays.has(toDateStr(d))).length

  // ON TRACK? — proportional to how far we are through the year
  const dayOfYear = Math.floor((now - yearStart) / 86400000) + 1
  const expected  = Math.round((dayOfYear / yearAllDays.length) * yearGoal)
  const track     = yearDone >= expected ? 'ahead' : yearDone < expected ? 'behind' : 'on-track'

  return {
    week:  { done: weekDone, goal: weeklyGoal, labels: weekLabels },
    month: { done: monthDone, goal: monthGoal },
    year:  { done: yearDone, goal: yearGoal, expected, track },
  }
}

export function pct(done, goal) {
  if (!goal) return 0
  return Math.min(100, Math.round((done / goal) * 100))
}

// ── PERIOD HELPERS (Day / Week / Month) ────────────────────────────────────────
// Week starts Monday. Used by Volume analytics.

export function getPeriodStart(granularity, refDate) {
  const d = new Date(refDate)
  if (granularity === 'day') {
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (granularity === 'week') {
    return startOfWeek(d, { weekStartsOn: 1 })
  }
  return startOfMonth(d)
}

export function getPeriodEnd(granularity, refDate) {
  const d = new Date(refDate)
  if (granularity === 'day') {
    d.setHours(23, 59, 59, 999)
    return d
  }
  if (granularity === 'week') {
    return endOfWeek(d, { weekStartsOn: 1 })
  }
  return endOfMonth(d)
}

// Stable key per period for grouping. Same date in same period returns same key.
export function getPeriodKey(granularity, date) {
  const d = new Date(date)
  if (granularity === 'day') return toDateStr(d)
  if (granularity === 'week') return toDateStr(startOfWeek(d, { weekStartsOn: 1 }))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftPeriod(granularity, refDate, delta) {
  if (granularity === 'day')   return addDays(refDate, delta)
  if (granularity === 'week')  return addWeeks(refDate, delta)
  return addMonths(refDate, delta)
}

export function formatPeriodLabel(granularity, refDate) {
  const start = getPeriodStart(granularity, refDate)
  const end   = getPeriodEnd(granularity, refDate)
  if (granularity === 'day') {
    return format(start, 'EEE, MMM d, yyyy')
  }
  if (granularity === 'week') {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
    }
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return format(start, 'MMMM yyyy')
}

// Short label for chart axes — e.g. 'Nov 4', 'W44', 'Nov'
export function formatPeriodShort(granularity, refDate) {
  const start = getPeriodStart(granularity, refDate)
  if (granularity === 'day')   return format(start, 'MMM d')
  if (granularity === 'week')  return format(start, 'MMM d')
  return format(start, 'MMM')
}

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatPB(pb) {
  if (!pb) return null
  const isSingle = repsAreParSide(pb.weight_type)
  const weightStr = ` @${weightLabelFor(pb.weight_type, pb.weight_kg)}`

  // New format: max volume + max set + weight
  if (pb.maxTotalReps !== undefined) {
    // Singles are per side, so both volume and best set read "32/32"; doubles stay "32"
    const perSide = (n) => (isSingle ? `${n}/${n}` : `${n}`)
    return `Vol: ${perSide(pb.maxTotalReps)} reps \u00b7 Best set: ${perSide(pb.maxSingleSetReps)}${weightStr}`
  }

  // Legacy fallback
  const repsStr = isSingle ? `${pb.reps}/${pb.reps}` : `${pb.reps}`
  const legacyWeightStr = pb.weight_type === 'bodyweight' || !pb.weight_kg
    ? ' @BW'
    : pb.weight_type === 'double'
      ? ` @2\u00d7${pb.weight_kg}kg`
      : ` @${pb.weight_kg}kg`
  return `${pb.sets} sets \u00d7 ${repsStr} reps${legacyWeightStr}`
}

export function secondsToTimeStr(secs) {
  if (!secs && secs !== 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function timeStrToSeconds(str) {
  if (!str || !str.trim()) return null
  const parts = str.trim().split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (isNaN(m) || isNaN(s)) return null
    return m * 60 + s
  }
  const n = parseInt(str, 10)
  return isNaN(n) ? null : n
}

export function buildWeeklyDuration(days) {
  const workoutDays = days.filter(d => isWorkoutDay(d) && d.submitted && d.duration_minutes)
  const weekMap = {}
  workoutDays.forEach(d => {
    const date = parseDateStr(d.date)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const key = format(weekStart, 'MMM d')
    weekMap[key] = (weekMap[key] ?? 0) + d.duration_minutes
  })
  return { labels: Object.keys(weekMap), values: Object.values(weekMap) }
}

export function buildMonthlyCount(days, year) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const counts = Array(12).fill(0)
  days.filter(d => isWorkoutDay(d) && d.submitted).forEach(d => {
    const month = parseInt(d.date.split('-')[1], 10) - 1
    counts[month]++
  })
  return { labels: MONTHS, values: counts }
}
