import { useState, useEffect, useRef } from 'react'
import { Trash2, Plus, Minus, Layers, BookOpen, X } from 'lucide-react'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import ReorderControl from './ReorderControl'
import { useAuth } from '../../context/AuthContext'
import { getComplexTemplates } from '../../lib/db'
import { isVestWeight } from '../../lib/utils'

const WEIGHT_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

export default function ComplexRow({
  complex,
  exerciseNames,
  showReorder = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
  onAddExercise,
  onUpdateExercise,
  onUpdateSet,
  onDeleteExercise,
  onLoadTemplate,
}) {
  const { user } = useAuth()
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const rounds = complex.rounds ?? 0

  // Complexes can be 0 rounds (placeholder for a block done later in the session)
  function bumpRounds(delta) {
    const next = Math.max(0, Math.min(999, rounds + delta))
    if (next !== rounds) onUpdate({ rounds: next })
  }
  function handleRoundsInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') return
    const n = Math.max(0, Math.min(999, parseInt(raw, 10)))
    if (n !== rounds) onUpdate({ rounds: n })
  }

  function handleDelete() {
    if (window.confirm(`Delete this complex and all ${complex.exercises.length} exercises inside it?`)) {
      onDelete()
    }
  }

  async function openTemplates() {
    if (!user) return
    setShowTemplates(true)
    if (!templates) {
      setLoadingTemplates(true)
      try {
        const list = await getComplexTemplates(user.id)
        setTemplates(list)
      } catch (e) { console.error('Load templates:', e) }
      finally { setLoadingTemplates(false) }
    }
  }

  function pickTemplate(t) {
    setShowTemplates(false)
    onLoadTemplate?.(t)
  }

  const isEmpty = complex.exercises.length === 0

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3 border border-purple-900/40">
      {/* Header: reorder + 'Complex' label + rounds stepper + delete */}
      <div className="flex items-center gap-2">
        {showReorder && (
          <ReorderControl
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        )}
        <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold uppercase tracking-wider">
          <Layers size={13} />
          Complex
        </div>

        <div className="ml-auto flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-1 py-1">
          <button
            type="button"
            onClick={() => bumpRounds(-1)}
            className="h-8 w-8 rounded-md active:bg-gray-700 flex items-center justify-center text-gray-300"
            aria-label="Decrease rounds"
          >
            <Minus size={14} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={rounds}
            onChange={handleRoundsInput}
            className="w-10 bg-transparent text-center text-sm font-bold text-purple-300
                       focus:outline-none"
          />
          <button
            type="button"
            onClick={() => bumpRounds(1)}
            className="h-8 w-8 rounded-md active:bg-gray-700 flex items-center justify-center text-gray-300"
            aria-label="Increase rounds"
          >
            <Plus size={14} />
          </button>
        </div>
        <span className="text-[10px] text-gray-500 uppercase">rounds</span>

        <button
          type="button"
          onClick={handleDelete}
          className="p-2 text-gray-600 hover:text-red-400 active:text-red-500
                     min-h-[40px] min-w-[40px] flex items-center justify-center
                     transition-colors"
          aria-label="Delete complex"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Complex exercises — each one row */}
      {complex.exercises.length > 0 && (
        <div className="space-y-2">
          {complex.exercises.map((ex, idx) => (
            <ComplexExerciseRow
              key={ex.id}
              exercise={ex}
              index={idx + 1}
              exerciseNames={exerciseNames}
              onUpdate={patch => onUpdateExercise(ex.id, patch)}
              onUpdateSet={patch => onUpdateSet(ex.id, patch)}
              onDelete={() => onDeleteExercise(ex.id)}
            />
          ))}
        </div>
      )}

      {/* Add exercise + (only when empty) Load previous complex */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddExercise}
          className="flex-1 py-2.5 rounded-xl border border-dashed border-gray-700
                     text-gray-500 text-xs font-medium
                     active:bg-gray-750 transition-colors
                     flex items-center justify-center gap-2"
        >
          <Plus size={12} />
          Add exercise
        </button>
        {isEmpty && (
          <button
            type="button"
            onClick={openTemplates}
            className="flex-1 py-2.5 rounded-xl border border-dashed border-purple-800/50
                       text-purple-400 text-xs font-medium
                       active:bg-purple-950/30 transition-colors
                       flex items-center justify-center gap-2"
          >
            <BookOpen size={12} />
            Load previous
          </button>
        )}
      </div>

      {/* Template picker modal */}
      {showTemplates && (
        <TemplatePicker
          templates={templates}
          loading={loadingTemplates}
          onPick={pickTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}

function TemplatePicker({ templates, loading, onPick, onClose }) {
  function fmtLabel(t) {
    if (!t.exercises || t.exercises.length === 0) return 'Empty complex'
    const summary = t.exercises.slice(0, 4).map(e => e.name).join(' → ')
    return t.exercises.length > 4 ? summary + ' …' : summary
  }
  function fmtDetail(t) {
    return t.exercises.map(e => {
      const w = e.weight_type === 'bodyweight' || !e.weight_kg
        ? 'BW'
        : e.weight_type === 'double'
          ? `2×${e.weight_kg}kg`
          : `${e.weight_kg}kg`
      return `${e.name} ${w} × ${e.reps}`
    }).join(' · ')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.6)' }}
         onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">Load a previous complex</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 active:text-gray-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 rounded-full border-2 border-green-500 border-t-transparent" />
            </div>
          )}
          {!loading && templates && templates.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8 px-4">
              You haven't submitted any complexes yet. Build and submit one, then it'll appear here.
            </p>
          )}
          {!loading && templates && templates.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(t)}
              className="w-full text-left px-4 py-3 border-b border-gray-800 active:bg-gray-800"
            >
              <p className="text-sm text-gray-100 font-medium">{fmtLabel(t)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ×{t.rounds} rounds · last done {t.lastDate ?? '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1 truncate">{fmtDetail(t)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// A single row inside a complex — name + type + weight + reps + delete.
// One implicit set only.
function ComplexExerciseRow({ exercise, index, exerciseNames, onUpdate, onUpdateSet, onDelete }) {
  const [showWeightPicker, setShowWeightPicker] = useState(false)
  const [repsStr, setRepsStr] = useState('')
  const repsFocused = useRef(false)
  const lastParentReps = useRef(null)

  const set = exercise.sets[0] ?? { reps: null, weightKg: null, weightType: null }

  // Sync reps input from parent when not focused
  if (!repsFocused.current && set.reps !== lastParentReps.current) {
    lastParentReps.current = set.reps
    setRepsStr(set.reps != null ? String(set.reps) : '')
  }

  const effectiveType = set.weightType ?? exercise.weightType ?? 'single'
  const effectiveKg = set.weightKg ?? exercise.weightKg ?? null
  const isBW = effectiveType === 'bodyweight' || effectiveKg == null
  const isVest = !isBW && isVestWeight(effectiveKg)

  function handleRepsChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setRepsStr(raw)
  }
  function handleRepsBlur() {
    repsFocused.current = false
    const val = repsStr.trim() === '' ? null : parseInt(repsStr, 10)
    lastParentReps.current = val
    if (val !== set.reps) onUpdateSet({ reps: val })
  }

  function handleSelectBW() {
    setShowWeightPicker(false)
    onUpdateSet({ weightKg: null, weightType: 'bodyweight' })
  }
  function handleSelectWeight(w) {
    setShowWeightPicker(false)
    const nextType = isVestWeight(w)
      ? 'single'
      : (effectiveType === 'bodyweight') ? 'single' : effectiveType
    onUpdateSet({ weightKg: w, weightType: nextType })
  }
  function handleToggleType(nextType) {
    if (nextType !== effectiveType) onUpdateSet({ weightType: nextType })
  }

  let chipLabel
  if (isBW) chipLabel = 'BW'
  else chipLabel = effectiveType === 'double' ? `2×${effectiveKg}` : `${effectiveKg}`

  return (
    <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded-xl p-2">
      <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{index}</span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <ExerciseAutocomplete
          value={exercise.exerciseName}
          options={exerciseNames}
          onChange={name => onUpdate({ exerciseName: name })}
          className=""
        />
      </div>

      {/* Reps input */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={repsStr}
        onChange={handleRepsChange}
        onFocus={() => { repsFocused.current = true }}
        onBlur={handleRepsBlur}
        placeholder="Reps"
        className="w-14 rounded-md bg-gray-800 border border-gray-700
                   px-2 py-2 text-gray-100 text-center text-sm min-h-[40px]
                   focus:outline-none focus:border-green-500 flex-shrink-0"
      />

      {/* 1×/2× toggle — hidden when BW or vest (10kg) */}
      {!isBW && !isVest ? (
        <div className="flex rounded-md overflow-hidden border border-gray-700 flex-shrink-0">
          {['single', 'double'].map(wt => (
            <button
              key={wt}
              type="button"
              onClick={() => handleToggleType(wt)}
              className={`px-1.5 text-[10px] font-bold min-h-[40px] w-[22px] transition-colors
                ${effectiveType === wt
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-500 active:text-gray-300'}`}
            >
              {wt === 'single' ? '1×' : '2×'}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-[46px] flex-shrink-0" />
      )}

      {/* Weight chip */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowWeightPicker(v => !v)}
          className="px-2 rounded-md bg-gray-800 border border-gray-700
                     text-[11px] text-gray-300 min-h-[40px] w-[52px]
                     active:bg-gray-700 transition-colors"
          aria-label="Set weight"
        >
          {chipLabel}
          {!isBW && <span className="text-[9px] text-gray-600 ml-0.5">kg</span>}
        </button>
        {showWeightPicker && (
          <>
            <button
              type="button"
              onClick={() => setShowWeightPicker(false)}
              className="fixed inset-0 z-10 bg-transparent cursor-default"
              aria-label="Close weight picker"
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700
                            rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={handleSelectBW}
                className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                  ${isBW ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
              >
                BW
              </button>
              {WEIGHT_OPTIONS.map(w => {
                const selected = !isBW && w === effectiveKg
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSelectWeight(w)}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap
                      ${selected ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`}
                  >
                    {w}kg
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 text-gray-700 hover:text-red-400 active:text-red-500
                   min-h-[40px] min-w-[32px] flex items-center justify-center
                   transition-colors flex-shrink-0"
        aria-label="Delete exercise from complex"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
