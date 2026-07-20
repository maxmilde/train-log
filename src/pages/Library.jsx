import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getExerciseNames, getExerciseHistory } from '../lib/db'
import ExerciseHistory from '../components/progress/ExerciseHistory'
import WorkoutFeed from '../components/progress/WorkoutFeed'
import ExerciseCatalog from '../components/progress/ExerciseCatalog'
import WorkoutSuggest from '../components/progress/WorkoutSuggest'
import VolumeAnalytics from '../components/progress/VolumeAnalytics'

const VIEWS = [
  { id: 'volume',   label: 'Volume' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'feed',     label: 'Feed' },
  { id: 'catalog',  label: 'Catalog' },
  { id: 'suggest',  label: 'Suggest' },
]

export default function LibraryPage() {
  const { user } = useAuth()

  const [activeView, setActiveView]       = useState('volume')
  const [exerciseNames, setExerciseNames] = useState([])
  const [selectedEx, setSelectedEx]       = useState('')
  const [exHistory, setExHistory]         = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!user) return
    getExerciseNames(user.id)
      .then(names => {
        setExerciseNames(names)
        setLoading(false)
      })
      .catch(err => {
        console.error('Library load error:', err)
        setLoading(false)
      })
  }, [user])

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
        <h2 className="text-xl font-bold text-gray-100 mb-3">Library</h2>

        {/* Tab pills — horizontally scrollable to fit 5 tabs on mobile */}
        <div className="flex bg-gray-800 rounded-xl p-1 gap-1 overflow-x-auto scrollbar-none">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors flex-shrink-0
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
        {activeView === 'volume' && (
          <VolumeAnalytics />
        )}

        {activeView === 'exercise' && (
          <ExerciseHistory
            names={exerciseNames}
            selected={selectedEx}
            onSelect={setSelectedEx}
            history={exHistory}
          />
        )}

        {activeView === 'feed' && (
          <WorkoutFeed />
        )}

        {activeView === 'catalog' && (
          <ExerciseCatalog />
        )}

        {activeView === 'suggest' && (
          <WorkoutSuggest />
        )}
      </div>
    </div>
  )
}
