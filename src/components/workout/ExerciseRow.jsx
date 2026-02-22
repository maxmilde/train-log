import { useEffect } from 'react'
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
  const pb = exercise.personalBest
  const pbStr = formatPB(pb)

  // Load personal best lazily when exercise name is set
  useEffect(() => {
    if (!user || !exercise.exerciseName) return
    getPersonalBest(user.id, exercise.exerciseName).then(newPb => {
      // Only update if different to avoid infinite loops
      if (JSON.stringify(newPb) !== JSON.stringify(pb)) {
        onUpdate({ personalBest: newPb })
      }
    }).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.exerciseName, user?.id])

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
            <span className="flex-1 text-center text-[10px] text-gray-600 uppercase tracking-wider">Reps</span>
            <span className="w-14 text-center text-[10px] text-gray-600 uppercase tracking-wider">Time</span>
            <span className="w-9" />
          </div>
          {exercise.sets.map((set, idx) => (
            <SetRow
              key={set.id || idx}
              set={set}
              setNumber={idx + 1}
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
