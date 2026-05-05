import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getExerciseCatalog, renameExercise, deleteExerciseByName } from '../../lib/db'
import { Pencil, Trash2, Check, X } from 'lucide-react'

export default function ExerciseCatalog() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 px-1 mb-2">
        {items.length} exercise{items.length !== 1 ? 's' : ''} · tap to rename or delete
      </p>
      {items.map(item => {
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
    </div>
  )
}
