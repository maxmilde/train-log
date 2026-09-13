import { useState, useEffect } from 'react'
import { X, Search, Plus, Layers } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getComplexTemplates } from '../../lib/db'

// Searchable list of complexes you've done before. `onPick(template)` receives the
// chosen template; if `allowEmpty` is set, an "Empty complex" row calls `onPick(null)`.
export default function ComplexPicker({ title = 'Choose a complex', allowEmpty = false, onPick, onClose }) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) return
    getComplexTemplates(user.id)
      .then(setTemplates)
      .catch(e => { console.error('Load complexes:', e); setTemplates([]) })
  }, [user])

  const q = query.trim().toLowerCase()
  const visible = (templates ?? []).filter(t =>
    !q || t.exercises.some(e => e.name.toLowerCase().includes(q))
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 active:text-gray-300" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by exercise…"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-9 pr-3 py-2
                         text-sm text-gray-100 placeholder-gray-600
                         focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="w-full text-left px-4 py-3 border-b border-gray-800 active:bg-gray-800 flex items-center gap-2"
            >
              <Plus size={14} className="text-gray-400" />
              <span className="text-sm text-gray-200">Empty complex</span>
            </button>
          )}

          {templates === null && (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 rounded-full border-2 border-green-500 border-t-transparent" />
            </div>
          )}
          {templates && templates.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8 px-4">
              No complexes yet. Build and submit one and it will appear here.
            </p>
          )}
          {templates && templates.length > 0 && visible.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8 px-4">No complexes with “{query}”</p>
          )}

          {visible.map(t => (
            <button
              key={t.signature}
              type="button"
              onClick={() => onPick(t)}
              className="w-full text-left px-4 py-3 border-b border-gray-800 active:bg-gray-800 flex items-start gap-2"
            >
              <Layers size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-100 font-medium">
                  {t.exercises.map(e => `${e.name} ${e.reps}`).join(' → ')}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {t.sessions.length} session{t.sessions.length !== 1 ? 's' : ''} · last done {t.lastDate ?? '—'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
