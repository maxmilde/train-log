import { useState, useRef } from 'react'
import { Trash2, Plus, Minus, Layers } from 'lucide-react'
import ExerciseAutocomplete from './ExerciseAutocomplete'

const WEIGHT_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

export default function ComplexRow({
  complex,
  exerciseNames,
  onUpdate,
  onDelete,
  onAddExercise,
  onUpdateExercise,
  onUpdateSet,
  onDeleteExercise,
}) {
  const rounds = complex.rounds ?? 1

  function bumpRounds(delta) {
    const next = Math.max(1, Math.min(999, rounds + delta))
    if (next !== rounds) onUpdate({ rounds: next })
  }
  function handleRoundsInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') return
    const n = Math.max(1, Math.min(999, parseInt(raw, 10)))
    if (n !== rounds) onUpdate({ rounds: n })
  }

  function handleDelete() {
    if (window.confirm(`Delete this complex and all ${complex.exercises.length} exercises inside it?`)) {
      onDelete()
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3 border border-purple-900/40">
      {/* Header: 'Complex' label + rounds stepper + delete */}
      <div className="flex items-center gap-2">
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

      {/* Add exercise inside the complex */}
      <button
        type="button"
        onClick={onAddExercise}
        className="w-full py-2.5 rounded-xl border border-dashed border-gray-700
                   text-gray-500 text-xs font-medium
                   active:bg-gray-750 transition-colors
                   flex items-center justify-center gap-2"
      >
        <Plus size={12} />
        Add exercise
      </button>
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
    const nextType = (effectiveType === 'bodyweight') ? 'single' : effectiveType
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

      {/* 1×/2× toggle — hidden when BW */}
      {!isBW ? (
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
