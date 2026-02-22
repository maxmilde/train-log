import { Clock, Plus, Send, Trash2, CheckCircle } from 'lucide-react'
import ExerciseRow from './ExerciseRow'

const DAY_TYPES = [
  { value: 'workout',     label: 'Workout' },
  { value: 'active_rest', label: 'Active Rest' },
  { value: 'rest',        label: 'Rest' },
]

export default function DayLog({
  state,
  exerciseNames,
  onDayTypeChange,
  onDurationChange,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onSubmit,
  onDeleteDay,
}) {
  const { date, dayType, durationMinutes, exercises, submitted } = state

  const dateObj = new Date(date + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const canLogExercises = dayType === 'workout' || dayType === 'active_rest'
  const isWorkout = dayType === 'workout'
  const isActiveRest = dayType === 'active_rest'

  const accentBg = isWorkout ? 'bg-green-600' : 'bg-blue-600'
  const accentBorder = isWorkout
    ? 'hover:border-green-600 hover:text-green-400'
    : 'hover:border-blue-600 hover:text-blue-400'

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100">{dateLabel}</h2>
        {submitted && (
          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 rounded-full px-2.5 py-1">
            <CheckCircle size={12} />
            Submitted
          </span>
        )}
      </div>

      {/* Day type segmented control */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700">
        {DAY_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onDayTypeChange(value)}
            className={`flex-1 py-3 text-sm font-medium transition-colors
              ${dayType === value
                ? value === 'workout'
                  ? 'bg-green-600 text-white'
                  : value === 'active_rest'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                : 'bg-gray-800 text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Exercise list — for workout AND active rest */}
      {canLogExercises && (
        <div className="space-y-3">
          {exercises.map(ex => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              exerciseNames={exerciseNames}
              onUpdate={patch => onUpdateExercise(ex.id, patch)}
              onDelete={() => onDeleteExercise(ex.id)}
              onAddSet={() => onAddSet(ex.id)}
              onUpdateSet={(setId, patch) => onUpdateSet(ex.id, setId, patch)}
              onDeleteSet={setId => onDeleteSet(ex.id, setId)}
            />
          ))}

          <button
            type="button"
            onClick={onAddExercise}
            className={`w-full py-4 rounded-2xl border-2 border-dashed border-gray-700
                       text-gray-500 text-sm font-medium
                       ${accentBorder}
                       active:opacity-80
                       transition-colors flex items-center justify-center gap-2`}
          >
            <Plus size={16} />
            Add Exercise
          </button>
        </div>
      )}

      {/* Rest day message */}
      {dayType === 'rest' && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">😴</p>
          <p className="text-gray-500 text-sm">Rest day</p>
        </div>
      )}

      {/* Duration — at the bottom, only for workout/active rest */}
      {canLogExercises && (
        <div className="pt-2">
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
            <Clock size={10} className="inline mr-1" />
            Session duration
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={durationMinutes ?? ''}
              onChange={e => onDurationChange(e.target.value === '' ? null : Number(e.target.value))}
              placeholder="43"
              className="w-24 rounded-xl bg-gray-800 border border-gray-700
                         px-4 py-3 text-xl text-gray-100 text-center min-h-[52px]
                         focus:outline-none focus:border-green-500"
            />
            <span className="text-gray-500 text-sm">minutes</span>
          </div>
        </div>
      )}

      {/* Submit + Delete buttons */}
      <div className="pt-2 space-y-3">
        {!submitted && (
          <button
            type="button"
            onClick={onSubmit}
            className={`w-full py-4 rounded-2xl ${accentBg} text-white font-semibold text-base
                       flex items-center justify-center gap-2
                       active:opacity-80 transition-all`}
          >
            <Send size={16} />
            Submit {isWorkout ? 'Workout' : isActiveRest ? 'Active Rest' : 'Day'}
          </button>
        )}

        {submitted && (
          <button
            type="button"
            onClick={onSubmit}
            className="w-full py-3 rounded-2xl bg-gray-800 border border-gray-700
                       text-gray-300 font-medium text-sm
                       flex items-center justify-center gap-2
                       active:bg-gray-700 transition-colors"
          >
            <Send size={14} />
            Update Submission
          </button>
        )}

        {state.dayId && (
          <button
            type="button"
            onClick={onDeleteDay}
            className="w-full py-3 rounded-2xl border border-red-900/50
                       text-red-400 text-sm font-medium
                       flex items-center justify-center gap-2
                       active:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
            Delete This Day
          </button>
        )}
      </div>
    </div>
  )
}
