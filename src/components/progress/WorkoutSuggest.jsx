import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSuggestionStats, createWorkoutFromSuggestions } from '../../lib/db'
import { toDateStr } from '../../lib/utils'
import { Sparkles, RefreshCw } from 'lucide-react'

// Exercises that should NOT be checked by default in the suggestion pool.
// Matched case-insensitively against trimmed exercise names.
const DEFAULT_EXCLUDED = new Set([
  '1 pump', '2 pump', '3 pump',
  'high pulls',
  'navy seal pushup',
  'skull crusher',
  'steps',
  'swing',
  'tricep pushups',
].map(s => s.toLowerCase()))

function isDefaultExcluded(name) {
  return DEFAULT_EXCLUDED.has((name ?? '').trim().toLowerCase())
}

// Score: lower = higher priority for suggestion
function rankExercise(ex, today) {
  const last = ex.lastDate ? new Date(ex.lastDate + 'T00:00:00') : null
  const daysSince = last ? Math.floor((today - last) / 86400000) : 9999
  return ex.recentSessions * 1000 + ex.recentReps * 0.1 - daysSince
}

// Stable shuffle via Fisher–Yates
function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Pick `count` exercises from the pool:
 *  - Rank by least-used (current algorithm)
 *  - Take the top `count * 2` candidates
 *  - Shuffle them and pick `count`
 *  - Ensure result is not identical (as a set) to `lastResultKey`
 */
function pickSuggestions(pool, count, lastResultKey) {
  if (pool.length === 0) return []
  const ranked = [...pool]
    .map(e => ({ e, score: rankExercise(e, new Date()) }))
    .sort((a, b) => a.score - b.score)
    .map(x => x.e)

  const poolSize = Math.min(ranked.length, Math.max(count * 2, count + 1))
  const candidates = ranked.slice(0, poolSize)

  // Try up to 6 shuffles to find a different combination than last time
  for (let attempt = 0; attempt < 6; attempt++) {
    const picked = shuffle(candidates).slice(0, count)
    const key = picked.map(p => p.name).sort().join('|')
    if (key !== lastResultKey || candidates.length <= count) {
      return picked
    }
  }
  return shuffle(candidates).slice(0, count)
}

export default function WorkoutSuggest() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPool, setSelectedPool] = useState(new Set())
  const [suggestions, setSuggestions] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const lastResultKeyRef = useRef(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getSuggestionStats(user.id, 30)
      .then(s => {
        setStats(s)
        // Default selection: everything EXCEPT the default-excluded names
        const defaults = new Set(
          s.exercises.map(e => e.name).filter(n => !isDefaultExcluded(n))
        )
        setSelectedPool(defaults)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user])

  const togglePool = (name) => {
    setSelectedPool(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAll = () => {
    if (!stats) return
    setSelectedPool(new Set(stats.exercises.map(e => e.name)))
  }
  const selectNone = () => setSelectedPool(new Set())
  const resetDefaults = () => {
    if (!stats) return
    setSelectedPool(new Set(
      stats.exercises.map(e => e.name).filter(n => !isDefaultExcluded(n))
    ))
  }

  const generate = useCallback(() => {
    if (!stats) return
    setError(null)
    setBusy(true)
    try {
      const pool = stats.exercises.filter(e => selectedPool.has(e.name))
      if (pool.length === 0) {
        setError('Select at least one exercise')
        setSuggestions(null)
        return
      }
      const count = Math.min(stats.avgWorkoutSize, pool.length)
      const picks = pickSuggestions(pool, count, lastResultKeyRef.current)
      lastResultKeyRef.current = picks.map(p => p.name).sort().join('|')
      setSuggestions(picks)
    } finally {
      setBusy(false)
    }
  }, [stats, selectedPool])

  const useSuggestions = useCallback(async () => {
    if (!user || !suggestions || suggestions.length === 0) return
    const today = toDateStr(new Date())
    const ok = window.confirm(
      `Add these ${suggestions.length} exercise${suggestions.length !== 1 ? 's' : ''} to today's workout?`
    )
    if (!ok) return
    setBusy(true)
    try {
      const payload = suggestions.map(s => ({
        name: s.name,
        weight_kg: s.weight_kg,
        weight_type: s.weight_type,
      }))
      await createWorkoutFromSuggestions(user.id, today, payload)
      navigate('/workout')
    } catch (e) {
      setError('Could not create workout: ' + e.message)
    } finally {
      setBusy(false)
    }
  }, [user, suggestions, navigate])

  const sortedExercises = useMemo(() => {
    if (!stats) return []
    return [...stats.exercises]
  }, [stats])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }
  if (!stats || stats.exercises.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-12">Log some workouts first, then come back for suggestions.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-gray-200">Workout Suggestions</h3>
        </div>
        <p className="text-xs text-gray-500">
          Picks {stats.avgWorkoutSize} exercise{stats.avgWorkoutSize !== 1 ? 's' : ''} (your average) from your selected pool, prioritizing what you've done less in the last 30 days. Tap Suggest again for a different combo.
        </p>
      </div>

      {/* Pool selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Pool ({selectedPool.size}/{stats.exercises.length})</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetDefaults}
              className="text-[11px] text-purple-400 active:text-purple-300"
              title="Reset to default selection"
            >Reset</button>
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-blue-400 active:text-blue-300"
            >All</button>
            <button
              type="button"
              onClick={selectNone}
              className="text-[11px] text-gray-500 active:text-gray-400"
            >None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortedExercises.map(ex => {
            const selected = selectedPool.has(ex.name)
            return (
              <button
                key={ex.name}
                type="button"
                onClick={() => togglePool(ex.name)}
                className={`text-xs rounded-lg px-2.5 py-1.5 transition-colors
                  ${selected
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-800 text-gray-500 active:bg-gray-700'}`}
              >
                {ex.name}
                <span className="ml-1.5 opacity-70 text-[10px]">{ex.recentSessions}×</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                   active:bg-green-500 disabled:opacity-50
                   flex items-center justify-center gap-2"
      >
        <RefreshCw size={14} />
        {suggestions ? 'Suggest different' : 'Suggest'}
      </button>

      {error && (
        <div className="bg-red-950 border border-red-900 rounded-xl px-4 py-3">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Suggested for today</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => {
              const cfg = s.weight_type === 'bodyweight' || !s.weight_kg
                ? 'BW'
                : s.weight_type === 'double'
                  ? `2×${s.weight_kg}kg`
                  : `${s.weight_kg}kg`
              return (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-sm text-gray-100 font-medium">{i + 1}. {s.name}</p>
                  <span className="text-[10px] bg-gray-700 text-gray-400 rounded px-1.5 py-0.5">{cfg}</span>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={useSuggestions}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                       active:bg-green-500 disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Use these for today'}
          </button>
        </div>
      )}
    </div>
  )
}
