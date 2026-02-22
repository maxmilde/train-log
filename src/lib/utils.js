import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'

export function toDateStr(date) {
  return format(date, 'yyyy-MM-dd')
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
 * Active rest days are tracked separately.
 */
export function calcGoalStats(days, weeklyGoal, now = new Date()) {
  // Only submitted workouts count for the goal
  const workoutSet = new Set(
    days.filter(d => d.day_type === 'workout' && d.submitted).map(d => d.date)
  )
  // Active rest days (submitted)
  const activeRestSet = new Set(
    days.filter(d => d.day_type === 'active_rest' && d.submitted).map(d => d.date)
  )

  // THIS WEEK
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekDone  = weekDays.filter(d => workoutSet.has(toDateStr(d))).length
  const weekActiveRest = weekDays.filter(d => activeRestSet.has(toDateStr(d))).length
  const weekLabels = weekDays.map(d => {
    const ds = toDateStr(d)
    return {
      label: format(d, 'EEE'),
      done: workoutSet.has(ds),
      activeRest: activeRestSet.has(ds),
      isFuture: d > now,
      dateStr: ds,
    }
  })

  // THIS MONTH
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const monthGoal  = Math.round((monthDays.length / 7) * weeklyGoal)
  const monthDone  = monthDays.filter(d => workoutSet.has(toDateStr(d))).length
  const monthActiveRest = monthDays.filter(d => activeRestSet.has(toDateStr(d))).length

  // THIS YEAR
  const yearStart  = startOfYear(now)
  const yearEnd    = endOfYear(now)
  const yearAllDays = eachDayOfInterval({ start: yearStart, end: yearEnd })
  const weeksInYear = Math.ceil(yearAllDays.length / 7)
  const yearGoal   = weeksInYear * weeklyGoal
  const yearDone   = yearAllDays.filter(d => workoutSet.has(toDateStr(d))).length
  const yearActiveRest = yearAllDays.filter(d => activeRestSet.has(toDateStr(d))).length

  // ON TRACK?
  const dayOfYear = Math.floor((now - yearStart) / 86400000) + 1
  const expected  = Math.floor((dayOfYear / yearAllDays.length) * yearGoal)
  const track     = yearDone > expected ? 'ahead' : yearDone < expected - 1 ? 'behind' : 'on-track'

  return {
    week:  { done: weekDone, goal: weeklyGoal, labels: weekLabels, activeRest: weekActiveRest },
    month: { done: monthDone, goal: monthGoal, activeRest: monthActiveRest },
    year:  { done: yearDone, goal: yearGoal, track, activeRest: yearActiveRest },
  }
}

export function pct(done, goal) {
  if (!goal) return 0
  return Math.min(100, Math.round((done / goal) * 100))
}

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatPB(pb) {
  if (!pb || !pb.weight_kg) return null
  const weightStr = pb.weight_type === 'double'
    ? `2\u00d7${pb.weight_kg}kg`
    : `${pb.weight_kg}kg`
  return `${pb.sets} sets \u00d7 ${pb.reps} reps @ ${weightStr}`
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
  const workoutDays = days.filter(d => (d.day_type === 'workout' || d.day_type === 'active_rest') && d.submitted && d.duration_minutes)
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
  days.filter(d => d.day_type === 'workout' && d.submitted).forEach(d => {
    const month = parseInt(d.date.split('-')[1], 10) - 1
    counts[month]++
  })
  return { labels: MONTHS, values: counts }
}
