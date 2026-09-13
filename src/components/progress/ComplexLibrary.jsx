import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Layers, Search, Trophy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getComplexTemplates } from '../../lib/db'
import { weightLabelFor } from '../../lib/utils'

// Browse every complex you've done, grouped by structure (exercise order + reps),
// with the full session history and best session for each.
export default function ComplexLibrary() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState(null)
  const [query, setQuery] = useState('')
  const [openSig, setOpenSig] = useState(null)

  useEffect(() => {
    if (!user) return
    getComplexTemplates(user.id)
      .then(setTemplates)
      .catch(e => { console.error('Complex library:', e); setTemplates([]) })
  }, [user])

  if (!templates) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? templates.filter(t => t.exercises.some(e => e.name.toLowerCase().includes(q)))
    : templates

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by exercise…"
          className="w-full rounded-xl bg-gray-800 border border-gray-700 pl-9 pr-3 py-3
                     text-sm text-gray-100 placeholder-gray-600
                     focus:outline-none focus:border-green-500"
        />
      </div>

      {templates.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-12">
          No complexes yet. Submit a workout with a complex and it will show up here.
        </p>
      )}
      {templates.length > 0 && visible.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">No complexes with “{query}”</p>
      )}

      {visible.map(t => {
        const isOpen = openSig === t.signature
        return (
          <div key={t.signature} className="bg-gray-800 rounded-xl border border-purple-900/40">
            <button
              type="button"
              onClick={() => setOpenSig(isOpen ? null : t.signature)}
              className="w-full text-left px-4 py-3 flex items-start gap-3"
            >
              <Layers size={14} className="text-purple-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-100 font-medium">
                  {t.exercises.map(e => `${e.name} ${e.reps}`).join(' → ')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {t.sessions.length} session{t.sessions.length !== 1 ? 's' : ''} · last {t.lastDate}
                </p>
                {t.best.totalReps > 0 && (
                  <p className="text-[11px] text-yellow-500 mt-0.5 flex items-center gap-1">
                    <Trophy size={10} />
                    Best: {t.best.rounds} rounds · {t.best.totalReps} reps ({t.best.date})
                  </p>
                )}
              </div>
              {isOpen
                ? <ChevronUp size={16} className="text-gray-600 mt-1 flex-shrink-0" />
                : <ChevronDown size={16} className="text-gray-600 mt-1 flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-3 space-y-2 border-t border-gray-700 pt-3">
                {t.sessions.map((s, i) => (
                  <div key={i} className="bg-gray-900 rounded-lg px-3 py-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs text-gray-200 font-medium">{s.date}</p>
                      <p className="text-[11px] text-gray-500">
                        × {s.rounds} round{s.rounds !== 1 ? 's' : ''} = {s.totalReps} reps
                      </p>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {s.exercises.map((e, ei) => (
                        <div key={ei} className="flex items-baseline justify-between text-[11px]">
                          <span className="text-gray-400">{e.name}</span>
                          <span className="text-gray-500">
                            {weightLabelFor(e.weight_type, e.weight_kg)} · {e.reps} × {s.rounds} = {e.reps * s.rounds}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
