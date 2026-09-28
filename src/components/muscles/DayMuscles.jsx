import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMuscles } from '../../context/MuscleContext'
import { muscleSets, exerciseSetsForDay } from '../../lib/muscles'
import MuscleCard from './MuscleCard'
import MuscleEditor from './MuscleEditor'

// Muscle map for one day. `planned` previews the routine while it's being built
// (empty sets count; a complex counts at least one round); otherwise only logged sets.
export default function DayMuscles({ exercises, complexes, planned = false, collapsible = false }) {
  const { saved } = useMuscles()
  const [open, setOpen] = useState(!collapsible)
  const [classifying, setClassifying] = useState(null)
  const { sets, unclassified } = useMemo(
    () => muscleSets(exerciseSetsForDay(exercises, complexes, { planned }), saved),
    [exercises, complexes, planned, saved]
  )

  const card = (
    <MuscleCard
      sets={sets}
      unclassified={unclassified}
      onClassify={setClassifying}
      emptyText={planned ? 'Name your exercises to see what they hit.' : 'No sets logged.'}
    />
  )

  return (
    <>
      {collapsible ? (
        <div className="bg-gray-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-xs text-gray-400 uppercase tracking-wider">What this workout hits</span>
            {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>
          {open && <div className="px-4 pb-4">{card}</div>}
        </div>
      ) : card}
      {classifying && <MuscleEditor name={classifying} onClose={() => setClassifying(null)} />}
    </>
  )
}
