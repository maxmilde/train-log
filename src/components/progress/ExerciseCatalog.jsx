import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getExerciseCatalog, renameExercise, deleteExerciseByName } from '../../lib/db'
import { Pencil, Trash2, Check, X, PersonStanding } from 'lucide-react'
import { useMuscles } from '../../context/MuscleContext'
import { MUSCLE_GROUPS, LEVELS, LEVEL_LABEL } from '../../lib/muscles'
import MuscleEditor from '../muscles/MuscleEditor'

const GROUP_LABEL = Object.fromEntries(MUSCLE_GROUPS.map(g => [g.id, g.label]))

// One-line muscle summary: "Glutes, Hamstrings · 2nd Lower back · …"
function MuscleLine({ classification }) {
  if (!classification) {
    return <span className="text-[10px] text-yellow-600 bg-yellow-950/40 border border-yellow-900/50 rounded px-1.5 py-0.5">No muscles set</span>
  }
  if (classification.chain) {
    return (
      <span className="text-[11px] text-gray-400">
        <span className="text-purple-300">Chain:</span> counts as{' '}
        {classification.chain.map(p => (p.reps > 1 ? `${p.reps} ${p.name}` : p.name)).join(' + ')}
      </span>
    )
  }
  if (classification.notCounted) {
    return <span className="text-[10px] text-purple-300 bg-purple-950/40 border border-purple-900/50 rounded px-1.5 py-0.5">Combo, not counted</span>
  }
  const parts = LEVELS
    .filter(level => classification[level].length > 0)
    .map(level => ({ level, names: classification[level].map(id => GROUP_LABEL[id]).join(', ') }))
  return (
    <span className="text-[11px] text-gray-400">
      {parts.map((p, i) => (
        <span key={p.level}>
          {i > 0 && <span className="text-gray-600"> · </span>}
          {i > 0 && <span className="text-gray-500">{LEVEL_LABEL[p.level]} </span>}
          <span className={i === 0 ? 'text-gray-300' : ''}>{p.names}</span>
        </span>
      ))}
    </span>
  )
}

const SORTS = [
  { id: 'az',     label: 'A–Z' },
  { id: 'za',     label: 'Z–A' },
  { id: 'volDesc', label: 'Volume ↓' },
  { id: 'volAsc',  label: 'Volume ↑' },
]

export default function ExerciseCatalog() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [sortId, setSortId] = useState('az')
  const { lookup, refresh: refreshMuscles } = useMuscles()
  const [musclesFor, setMusclesFor] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getExerciseCatalog(user.id)
      setItems(data)
    } catch (e) {
      console.error('Catalog load:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const startRename = (name) => {
    setEditingName(name)
    setEditValue(name)
  }

  const cancelRename = () => {
    setEditingName(null)
    setEditValue('')
  }

  const saveRename = async (oldName) => {
    const newName = editValue.trim()
    if (!newName || newName === oldName) { cancelRename(); return }
    if (items.some(i => i.name === newName)) {
      const merge = window.confirm(
        `"${newName}" already exists. Merge "${oldName}" into "${newName}"? All history of "${oldName}" will be combined.`
      )
      if (!merge) return
    }
    setBusy(true)
    try {
      await renameExercise(user.id, oldName, newName)
      await load()
      refreshMuscles().catch(e => console.error('Refresh muscle tags:', e))
      setEditingName(null)
      setEditValue('')
    } catch (e) {
      alert('Rename failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (name) => {
    const ok = window.confirm(
      `Delete "${name}" and ALL its history? This removes every set you've logged for this exercise. This cannot be undone.`
    )
    if (!ok) return
    setBusy(true)
    try {
      await deleteExerciseByName(user.id, name)
      await load()
      refreshMuscles().catch(e => console.error('Refresh muscle tags:', e))
    } catch (e) {
      alert('Delete failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-12">No exercises logged yet</p>
  }

  const sortedItems = (() => {
    const arr = [...items]
    switch (sortId) {
      case 'za':      return arr.sort((a, b) => b.name.localeCompare(a.name))
      case 'volDesc': return arr.sort((a, b) => (b.totalReps ?? 0) - (a.totalReps ?? 0))
      case 'volAsc':  return arr.sort((a, b) => (a.totalReps ?? 0) - (b.totalReps ?? 0))
      case 'az':
      default:        return arr.sort((a, b) => a.name.localeCompare(b.name))
    }
  })()

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 px-1 mb-2">
        {items.length} exercise{items.length !== 1 ? 's' : ''} · set muscles, rename or delete
      </p>

      {/* Sort selector */}
      <div className="flex bg-gray-800 rounded-lg p-1 gap-1 mb-2">
        {SORTS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSortId(s.id)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors
              ${sortId === s.id
                ? 'bg-green-600 text-white'
                : 'text-gray-400 active:text-gray-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sortedItems.map(item => {
        const isEditing = editingName === item.name
        return (
          <div key={item.name} className="bg-gray-800 rounded-xl px-4 py-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2
                             text-gray-100 text-sm focus:outline-none focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => saveRename(item.name)}
                  disabled={busy}
                  className="p-2 text-green-400 active:text-green-300 disabled:opacity-50"
                  aria-label="Save rename"
                >
                  <Check size={18} />
                </button>
                <button
                  type="button"
                  onClick={cancelRename}
                  disabled={busy}
                  className="p-2 text-gray-500 active:text-gray-400 disabled:opacity-50"
                  aria-label="Cancel rename"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{item.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {item.sessions} session{item.sessions !== 1 ? 's' : ''}
                    {item.totalReps > 0 ? ` · ${item.totalReps} total reps` : ''}
                    {item.lastDate ? ` · last ${item.lastDate}` : ''}
                  </p>
                  <div className="mt-1">
                    <MuscleLine classification={lookup(item.name)} />
                  </div>
                  {item.configs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.configs.map(c => (
                        <span key={c} className="text-[10px] bg-gray-700 text-gray-400 rounded px-1.5 py-0.5">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-1 flex-shrink-0">
                  {!lookup(item.name)?.chain && <button
                    type="button"
                    onClick={() => setMusclesFor(item.name)}
                    className="p-2 text-gray-500 hover:text-green-400 active:text-green-300"
                    aria-label="Set muscles"
                  >
                    <PersonStanding size={16} />
                  </button>}
                  <button
                    type="button"
                    onClick={() => startRename(item.name)}
                    className="p-2 text-gray-500 hover:text-blue-400 active:text-blue-300"
                    aria-label="Rename"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.name)}
                    className="p-2 text-gray-500 hover:text-red-400 active:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {musclesFor && <MuscleEditor name={musclesFor} onClose={() => setMusclesFor(null)} />}
    </div>
  )
}
