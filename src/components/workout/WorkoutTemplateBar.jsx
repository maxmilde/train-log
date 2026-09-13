import { useState, useEffect } from 'react'
import { ClipboardList, Download, Save, X, Trash2, Trophy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getWorkoutTemplates, deleteWorkoutTemplate } from '../../lib/db'

// Saved-workout controls at the top of the Log: load one, save this day as one,
// or — when the day is already linked — show which workout you're chasing.
export default function WorkoutTemplateBar({
  templateId,
  templateInfo,
  hasContent,
  onSave,
  onLoad,
  onUnlink,
}) {
  const [modal, setModal] = useState(null) // 'load' | 'save' | null

  if (templateId) {
    const best = templateInfo?.best
    return (
      <>
        <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-yellow-900/40 flex items-center gap-3">
          <ClipboardList size={16} className="text-yellow-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {templateInfo?.name ?? 'Saved workout'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
              {best ? (
                <>
                  <Trophy size={10} className="text-yellow-600" />
                  Beat your best: {best.totalReps} reps ({best.date}) · targets in grey
                </>
              ) : (
                'First session of this workout'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal('save')}
            className="text-[11px] text-gray-400 active:text-gray-200 px-2 py-1"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Stop linking this day to the saved workout? Your logged sets stay.')) onUnlink()
            }}
            className="p-1 text-gray-600 active:text-gray-400"
            aria-label="Unlink saved workout"
          >
            <X size={16} />
          </button>
        </div>
        {modal === 'save' && (
          <SaveModal initialName={templateInfo?.name ?? ''} onSave={onSave} onClose={() => setModal(null)} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setModal('load')}
          className="flex-1 py-3 rounded-2xl bg-gray-800 border border-gray-700
                     text-gray-300 text-sm font-medium flex items-center justify-center gap-2
                     active:bg-gray-700 transition-colors"
        >
          <Download size={14} />
          Load workout
        </button>
        {hasContent && (
          <button
            type="button"
            onClick={() => setModal('save')}
            className="flex-1 py-3 rounded-2xl bg-gray-800 border border-gray-700
                       text-gray-300 text-sm font-medium flex items-center justify-center gap-2
                       active:bg-gray-700 transition-colors"
          >
            <Save size={14} />
            Save as workout
          </button>
        )}
      </div>
      {modal === 'load' && <LoadModal onLoad={onLoad} onClose={() => setModal(null)} />}
      {modal === 'save' && <SaveModal initialName="" onSave={onSave} onClose={() => setModal(null)} />}
    </>
  )
}

function Modal({ title, onClose, children }) {
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
        {children}
      </div>
    </div>
  )
}

function useTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!user) return
    getWorkoutTemplates(user.id)
      .then(setTemplates)
      .catch(e => { setError(e.message); setTemplates([]) })
  }, [user])
  return { templates, setTemplates, error }
}

function LoadModal({ onLoad, onClose }) {
  const { templates, setTemplates, error } = useTemplates()
  const [busyId, setBusyId] = useState(null)
  const [loadError, setLoadError] = useState(null)

  async function pick(t) {
    setBusyId(t.id)
    setLoadError(null)
    try {
      await onLoad(t.id)
      onClose()
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(t) {
    if (!window.confirm(`Delete saved workout "${t.name}"? Past sessions stay in your history.`)) return
    try {
      await deleteWorkoutTemplate(t.id)
      setTemplates(list => list.filter(x => x.id !== t.id))
    } catch (e) {
      setLoadError(e.message)
    }
  }

  return (
    <Modal title="Load a saved workout" onClose={onClose}>
      <div className="flex-1 overflow-y-auto">
        {(error || loadError) && (
          <p className="text-xs text-red-300 bg-red-950 border-b border-red-900 px-4 py-2">{loadError ?? error}</p>
        )}
        {templates === null && (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-green-500 border-t-transparent" />
          </div>
        )}
        {templates && templates.length === 0 && !error && (
          <p className="text-gray-500 text-sm text-center py-8 px-4">
            No saved workouts yet. Log a workout, tap “Save as workout”, then submit it.
          </p>
        )}
        {templates && templates.map(t => (
          <div key={t.id} className="flex items-center border-b border-gray-800">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => pick(t)}
              className="flex-1 text-left px-4 py-3 active:bg-gray-800 disabled:opacity-50"
            >
              <p className="text-sm text-gray-100 font-medium">{t.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {busyId === t.id
                  ? 'Loading…'
                  : `${t.sessions} session${t.sessions !== 1 ? 's' : ''}${t.lastDate ? ` · last ${t.lastDate}` : ''}`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => remove(t)}
              className="p-3 text-gray-600 active:text-red-400"
              aria-label={`Delete ${t.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function SaveModal({ initialName, onSave, onClose }) {
  const { templates } = useTemplates()
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save(value) {
    setBusy(true)
    setError(null)
    try {
      await onSave(value)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Save as workout" onClose={onClose}>
      <div className="p-4 space-y-3 border-b border-gray-800">
        <input
          type="text"
          value={name}
          autoFocus
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Heavy Long Cycle day"
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5
                     text-sm text-gray-100 placeholder-gray-600
                     focus:outline-none focus:border-green-500"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => save(name)}
          className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold
                     active:bg-green-500 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <p className="text-[11px] text-gray-500">
          Saving under an existing name adds this day as another session of that workout.
        </p>
      </div>
      {templates && templates.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Existing workouts</p>
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              onClick={() => save(t.name)}
              className="w-full text-left px-4 py-2.5 border-b border-gray-800 active:bg-gray-800 disabled:opacity-50"
            >
              <p className="text-sm text-gray-200">{t.name}</p>
              <p className="text-[11px] text-gray-500">
                {t.sessions} session{t.sessions !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
