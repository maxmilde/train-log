import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Trophy, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDaysForYear, getSettings, upsertSettings, getVolumeAnalytics } from '../lib/db'
import { calcGoalStats } from '../lib/utils'
import YearHeatmap from '../components/calendar/YearHeatmap'
import GoalTracker from '../components/dashboard/GoalTracker'
import DurationChart from '../components/dashboard/DurationChart'
import MonthlyChart from '../components/progress/Charts'

export default function DashboardPage() {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  const [yearDays, setYearDays]   = useState([])
  const [settings, setSettings]   = useState({ weekly_goal: 4 })
  const [loading, setLoading]     = useState(true)
  const [weekVolume, setWeekVolume] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    Promise.all([
      getDaysForYear(user.id, year),
      getSettings(user.id),
    ]).then(([days, cfg]) => {
      setYearDays(days)
      if (cfg) setSettings(cfg)
      setLoading(false)
    }).catch(err => {
      console.error('Dashboard load error:', err)
      setLoading(false)
    })
    // Small volume teaser fetch (async, doesn't block Dashboard render)
    getVolumeAnalytics(user.id, 'week', new Date())
      .then(setWeekVolume)
      .catch(err => console.error('Volume teaser:', err))
  }, [user, year])

  const dayMap = new Map(yearDays.map(d => [d.date, d]))
  const stats  = calcGoalStats(yearDays, settings.weekly_goal)

  async function handleGoalChange(newGoal) {
    setSettings(prev => ({ ...prev, weekly_goal: newGoal }))
    try {
      await upsertSettings(user.id, { weekly_goal: newGoal })
    } catch (err) {
      console.error('Failed to save goal:', err)
    }
  }

  // Aggregate totals for the Duration section
  const workoutsWithDuration = yearDays.filter(d => d.day_type === 'workout' && d.duration_minutes)
  const totalMins = workoutsWithDuration.reduce((a, d) => a + d.duration_minutes, 0)
  const avgMin = workoutsWithDuration.length > 0
    ? Math.round(totalMins / workoutsWithDuration.length)
    : 0
  const totalHM = `${Math.floor(totalMins / 60)}:${String(totalMins % 60).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scroll-panel">
      {/* Header */}
      <div
        className="px-4 pb-2 pt-4 flex items-center justify-between"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <h1 className="text-xl font-bold text-gray-100">Train Log</h1>
        <span className="text-sm text-gray-500">{year}</span>
      </div>

      {/* Goal tracker */}
      <GoalTracker
        stats={stats}
        weeklyGoal={settings.weekly_goal}
        onGoalChange={handleGoalChange}
      />

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-gray-800" />

      {/* Year heatmap */}
      <div className="px-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2">Year overview</p>
        <YearHeatmap year={year} dayMap={dayMap} />
      </div>

      {/* Volume teaser (this week) — links to Library › Volume */}
      {weekVolume && weekVolume.totals.reps > 0 && (
        <div className="px-4 mt-5">
          <VolumeTeaser data={weekVolume} onClick={() => navigate('/library')} />
        </div>
      )}

      {/* Duration section (moved from Progress > Duration) */}
      <div className="px-4 mt-5 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-1">Duration</p>
        <DurationChart days={yearDays} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total time" value={totalHM} unit="hours" />
          <StatCard label="Avg duration" value={avgMin} unit="min / session" />
        </div>
      </div>

      {/* Monthly section (moved from Progress > Monthly) */}
      <div className="px-4 mt-5 pb-6 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-1">Monthly</p>
        <MonthlyChart days={yearDays} year={year} />
      </div>
    </div>
  )
}

function StatCard({ label, value, unit }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-600">{unit}</p>
    </div>
  )
}

function VolumeTeaser({ data, onClick }) {
  const { totals, bestEver } = data
  const bestMetric = bestEver.load > 0 ? bestEver.load : bestEver.reps
  const currentMetric = totals.load > 0 ? totals.load : totals.reps
  const pctOfBest = bestMetric > 0 ? Math.round((currentMetric / bestMetric) * 100) : 0
  const isBestEver = pctOfBest >= 100 && currentMetric > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-gray-800 rounded-xl p-4 flex items-center gap-3
                 active:bg-gray-750 transition-colors text-left"
    >
      <div className="p-2 rounded-lg bg-green-900/40">
        <BarChart2 size={18} className="text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">This week</p>
        <p className="text-lg font-bold text-gray-100 tabular-nums">
          {totals.reps} reps
          {totals.load > 0 && <span className="text-sm text-gray-400 font-medium ml-2">· {totals.load >= 1000 ? (totals.load / 1000).toFixed(1) + 'k' : totals.load} load</span>}
        </p>
        {bestMetric > 0 && (
          <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${isBestEver ? 'text-yellow-500' : pctOfBest >= 90 ? 'text-green-400' : 'text-gray-500'}`}>
            {isBestEver && <Trophy size={11} />}
            {isBestEver ? 'New best week!' : `${pctOfBest}% of best week`}
          </p>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
    </button>
  )
}
