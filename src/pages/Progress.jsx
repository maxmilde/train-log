import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDaysForYear, getExerciseNames, getExerciseHistory } from '../lib/db'
import DurationChart from '../components/dashboard/DurationChart'
import MonthlyChart from '../components/progress/Charts'
import ExerciseHistory from '../components/progress/ExerciseHistory'

const VIEWS = [
  { id: 'duration', label: 'Duration' },
  { id: 'monthly',  label: 'Monthly' },
  { id: 'exercise', label: 'Exercise' },
]

export default function ProgressPage() {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  const [activeView, setActiveView]       = useState('duration')
  const [yearDays, setYearDays]           = useState([])
  const [exerciseNames, setExerciseNames] = useState([])
  const [selectedEx, setSelectedEx]       = useState('')
  const [exHistory, setExHistory]         = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getDaysForYear(user.id, year),
      getExerciseNames(user.id),
    ]).then(([days, names]) => {
      setYearDays(days)
      setExerciseNames(names)
      setLoading(false)
    }).catch(err => {
      console.error('Progress load error:', err)
      setLoading(false)
    })
  }, [user, year])

  useEffect(() => {
    if (!user || !selectedEx) { setExHistory([]); return }
    getExerciseHistory(user.id, selectedEx)
      .then(setExHistory)
      .catch(console.error)
  }, [user, selectedEx])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-3"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <h2 className="text-xl font-bold text-gray-100 mb-3">Progress</h2>

        {/* Tab pills */}
        <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${activeView === id
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-panel px-4 pb-6">
        {activeView === 'duration' && (
          <div className="space-y-4">
            <DurationChart days={yearDays} />
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total time"
                value={yearDays
                  .filter(d => d.day_type === 'workout' && d.duration_minutes)
                  .reduce((a, d) => a + d.duration_minutes, 0)}
                unit="minutes"
              />
              <StatCard
                label="Avg duration"
                value={(() => {
                  const w = yearDays.filter(d => d.day_type === 'workout' && d.duration_minutes)
                  return w.length > 0 ? Math.round(w.reduce((a, d) => a + d.duration_minutes, 0) / w.length) : 0
                })()}
                unit="min / session"
              />
            </div>
          </div>
        )}

        {activeView === 'monthly' && (
          <MonthlyChart days={yearDays} year={year} />
        )}

        {activeView === 'exercise' && (
          <ExerciseHistory
            names={exerciseNames}
            selected={selectedEx}
            onSelect={setSelectedEx}
            history={exHistory}
          />
        )}
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
