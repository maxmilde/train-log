import { useState, useEffect } from 'react'
import { Trash2, ChevronDown } from 'lucide-react'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import SetRow from './SetRow'
import { formatPB } from '../../lib/utils'
import { getPersonalBest } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'

const WEIGHTS = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

export default function ExerciseRow({
  exercise,
  exerciseNames,
  onUpdate,
  onDelete,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
}) {
  const { user } = useAuth()
  const [pb, setPb] = useState(null)
  const pbStr = formatPB(pb)
  const isBodyweight = exercise.weightType === 'bodyweight'

  // Load personal best when exercise name or weight config changes
  useEffect(() => {
    if (!user || !exercise.exerciseName) { setPb(null); return }
    getPersonalBest(user.id, exercise.exerciseName, exercise.weightType, exercise.weightKg)
      .then(setPb)
      .catch(console.error)
  }, [exercise.exerciseName, exercise.weightType, exercise.weightKg, user?.id])

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      {/* Exercise name row */}
      <div className="flex gap-2 items-start">
        <ExerciseAutocomplete
          value={exercise.exerciseName}
          options={exerciseNames}
          onChange={name => onUpdate({ exerciseName: name })}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onDelete}
          className="mt-1 p-2.5 text-gray-600 hover:text-red-400 active:text-red-500
                     min-h-[44px] min-w-[44px] flex items-center justify-center
                     transition-colors"
          aria-label="Delete exercise"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Personal best */}
      {pbStr && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">PB</span>
          <span className="text-xs text-blue-400">{pbStr}</span>
        </div>
      )}

      {/* Weight + goal sets row */}
      <div className="flex gap-2 items-center">
        {isBodyweight ? (
          /* Bodyweight mode — just a label + button to switch back */
          <button
            type="button"
            onClick={() => onUpdate({ weightType: 'single', weightKg: 24 })}
            className="rounded-lg bg-gray-900 border border-gray-700
                       px-3 py-2 text-xs text-gray-400 min-h-[40px]
                       active:bg-gray-700 transition-colors flex-1 text-left"
          >
            Bodyweight <span className="text-gray-600 ml-1">· tap to add weight</span>
          </button>
        ) : (
          <>
            {/* Single / Double toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
              {['single', 'double'].map(wt => (
                <button
                  key={wt}
                  type="button"
                  onClick={() => onUpdate({ weightType: wt })}
                  className={`px-3 py-2 text-xs font-medium capitalize min-h-[40px] transition-colors
                    ${exercise.weightType === wt
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-gray-300'}`}
                >
                  {wt === 'single' ? '1×' : '2×'}
                </button>
              ))}
            </div>

            {/* Weight dropdown */}
            <div className="relative flex-1">
              <select
                value={exercise.weightKg ?? 24}
                onChange={e => onUpdate({ weightKg: Number(e.target.value) })}
                className="w-full appearance-none rounded-lg bg-gray-900 border border-gray-700
                           px-3 py-2 pr-8 text-gray-100 text-sm min-h-[40px]
                           focus:outline-none focus:border-green-500"
              >
                {WEIGHTS.map(w => (
                  <option key={w} value={w}>{w} kg</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* BW toggle */}
            <button
              type="button"
              onClick={() => onUpdate({ weightType: 'bodyweight', weightKg: null })}
              className="rounded-lg bg-gray-900 border border-gray-700
                         px-2 py-2 text-[10px] text-gray-500 min-h-[40px]
                         active:bg-gray-700 transition-colors flex-shrink-0"
              title="Switch to bodyweight"
            >
              BW
            </button>
          </>
        )}

        {/* Goal sets */}
        <div className="flex-shrink-0">
          <input
            type="number"
            inputMode="numeric"
            value={exercise.goalSets ?? ''}
            onChange={e => onUpdate({ goalSets: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="Goal"
            className="w-16 rounded-lg bg-gray-900 border border-gray-700
                       px-2 py-2 text-gray-400 text-center text-sm min-h-[40px]
                       focus:outline-none focus:border-green-500"
          />
          <p className="text-[9px] text-gray-600 text-center mt-0.5">sets goal</p>
        </div>
      </div>

      {/* Sets list */}
      {exercise.sets.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex gap-2 px-5 mb-1">
            <span className="flex-1 text-center text-[10px] text-gray-600 uppercase tracking-wider">
              {exercise.weightType === 'single' ? 'Reps/side' : 'Reps'}
            </span>
            <span className="w-14 text-center text-[10px] text-gray-600 uppercase tracking-wider">Time</span>
            <span className="w-9" />
          </div>
          {exercise.sets.map((set, idx) => (
            <SetRow
              key={set.id || idx}
              set={set}
              setNumber={idx + 1}
              isSingleKB={exercise.weightType === 'single'}
              onUpdate={patch => onUpdateSet(set.id, patch)}
              onDelete={() => onDeleteSet(set.id)}
            />
          ))}
        </div>
      )}

      {/* Add set + sets summary */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="text-sm text-green-400 hover:text-green-300 active:text-green-200
                     py-2 transition-colors font-medium"
        >
          + Add set
        </button>

        {exercise.goalSets && exercise.goalSets > 0 && (
          <span className={`text-xs font-medium ${
            exercise.sets.length >= exercise.goalSets
              ? 'text-green-400'
              : 'text-gray-500'
          }`}>
            {exercise.sets.length}/{exercise.goalSets} sets
            {exercise.sets.length >= exercise.goalSets ? ' ✓' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
