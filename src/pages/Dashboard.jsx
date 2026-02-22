import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDaysForYear, getSettings, upsertSettings } from '../lib/db'
import { calcGoalStats, toDateStr } from '../lib/utils'
import YearHeatmap from '../components/calendar/YearHeatmap'
import GoalTracker from '../components/dashboard/GoalTracker'
import DurationChart from '../components/dashboard/DurationChart'

export default function DashboardPage() {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  const [yearDays, setYearDays]   = useState([])
  const [settings, setSettings]   = useState({ weekly_goal: 4 })
  const [loading, setLoading]     = useState(true)

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

      {/* Duration chart */}
      <div className="px-4 mt-4 pb-6">
        <DurationChart days={yearDays} />
      </div>
    </div>
  )
}
