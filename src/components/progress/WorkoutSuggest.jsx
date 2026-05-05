import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSuggestionStats, createWorkoutFromSuggestions } from '../../lib/db'
import { toDateStr } from '../../lib/utils'
import { Sparkles, Wand2, RefreshCw } from 'lucide-react'

// Score: lower = higher priority for suggestion
function rankExercise(ex, today) {
  const last = ex.lastDate ? new Date(ex.lastDate + 'T00:00:00') : null
  const daysSince = last ? Math.floor((today - last) / 86400000) : 9999
  // Heavily penalize recent use
  return ex.recentSessions * 1000 + ex.recentReps * 0.1 - daysSince
}

function pickWithoutAI(pool, count, today) {
  const ranked = [...pool]
    .map(e => ({ e, score: rankExercise(e, today) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(x => x.e)
  return ranked
}

async function pickWithAI(pool, count, recentLog) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Add VITE_ANTHROPIC_API_KEY to your .env.local file to enable AI suggestions.')
  }
  const promptPool = pool.map(e => ({
    name: e.name,
    recent_sessions_30d: e.recentSessions,
    recent_total_reps_30d: e.recentReps,
    last_done: e.lastDate,
  }))
  const body = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content:
`You are suggesting ${count} kettlebell/bodyweight exercises for the user's next workout.

Selected exercise pool (with recent usage stats):
${JSON.stringify(promptPool, null, 2)}

Recent workouts (last 5 sessions):
${JSON.stringify(recentLog, null, 2)}

Pick exactly ${count} exercises from the pool above. Prioritize:
1. Exercises the user has done LESS RECENTLY or LESS OFTEN
2. Variety — try not to pick exercises that hit identical movement patterns
3. Balance push/pull/squat/hinge/carry where possible

Respond with ONLY a JSON array of exercise names (strings), no commentary. Example: ["Pushups", "Long Cycle", "Pullups"]`
    }],
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`AI request failed (${res.status}): ${txt}`)
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text ?? '[]'
  // Extract JSON array
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) throw new Error('AI response not parseable')
  const names = JSON.parse(match[0])
  return pool.filter(e => names.includes(e.name)).slice(0, count)
}

export default function WorkoutSuggest() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPool, setSelectedPool] = useState(new Set())
  const [suggestions, setSuggestions] = useState(null)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getSuggestionStats(user.id, 30)
      .then(s => {
        setStats(s)
        // Default: select all exercises into the pool
        setSelectedPool(new Set(s.exercises.map(e => e.name)))
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

  const generate = useCallback(() => {
    if (!stats) return
    setError(null)
    setBusy(true)
    try {
      const pool = stats.exercises.filter(e => selectedPool.has(e.name))
      if (pool.length === 0) { setError('Select at least one exercise'); setSuggestions(null); return }
      const count = Math.min(stats.avgWorkoutSize, pool.length)
      const picks = pickWithoutAI(pool, count, new Date())
      setSuggestions(picks)
    } finally {
      setBusy(false)
    }
  }, [stats, selectedPool])

  const generateAI = useCallback(async () => {
    if (!stats) return
    setError(null)
    setAiBusy(true)
    try {
      const pool = stats.exercises.filter(e => selectedPool.has(e.name))
      if (pool.length === 0) { setError('Select at least one exercise'); return }
      const count = Math.min(stats.avgWorkoutSize, pool.length)
      // Recent workout log for context — last 5 entries (just names + dates)
      const recentLog = pool
        .filter(e => e.lastDate)
        .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
        .slice(0, 5)
        .map(e => ({ name: e.name, last_date: e.lastDate }))
      const picks = await pickWithAI(pool, count, recentLog)
      if (picks.length === 0) {
        setError('AI returned no valid suggestions')
        return
      }
      setSuggestions(picks)
    } catch (e) {
      setError(e.message)
    } finally {
      setAiBusy(false)
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
          Picks {stats.avgWorkoutSize} exercise{stats.avgWorkoutSize !== 1 ? 's' : ''} (your average) from your selected pool, prioritizing what you've done less in the last 30 days.
        </p>
      </div>

      {/* Pool selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Pool ({selectedPool.size}/{stats.exercises.length})</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-blue-400 active:text-blue-300"
            >Select all</button>
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

      {/* Generate buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={busy || aiBusy}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold
                     active:bg-green-500 disabled:opacity-50
                     flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          Suggest
        </button>
        <button
          type="button"
          onClick={generateAI}
          disabled={busy || aiBusy}
          className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold
                     active:bg-purple-500 disabled:opacity-50
                     flex items-center justify-center gap-2"
        >
          <Wand2 size={14} />
          {aiBusy ? 'Thinking…' : 'AI Suggest'}
        </button>
      </div>

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
