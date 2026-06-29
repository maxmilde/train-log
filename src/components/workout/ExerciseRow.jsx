import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import SetRow from './SetRow'
import { formatPB } from '../../lib/utils'
import { getPersonalBest } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'

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


      {/* Sets list */}
      {exercise.sets.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex gap-1.5 mb-1 items-center">
            <span className="w-5" />
            <span className="flex-1 text-center text-[10px] text-gray-600 uppercase tracking-wider">
              Reps
            </span>
            <span className="w-[46px] text-center text-[10px] text-gray-600 uppercase tracking-wider">Type</span>
            <span className="w-[52px] text-center text-[10px] text-gray-600 uppercase tracking-wider">Load</span>
            <span className="w-9" />
          </div>
          {exercise.sets.map((set, idx) => (
            <SetRow
              key={set.id || idx}
              set={set}
              setNumber={idx + 1}
              exerciseWeightType={exercise.weightType}
              exerciseWeightKg={exercise.weightKg}
              onUpdate={patch => onUpdateSet(set.id, patch)}
              onDelete={() => onDeleteSet(set.id)}
            />
          ))}
        </div>
      )}

      {/* Add set */}
      <button
        type="button"
        onClick={onAddSet}
        className="text-sm text-green-400 hover:text-green-300 active:text-green-200
                   py-2 transition-colors font-medium"
      >
        + Add set
      </button>
    </div>
  )
}
