import { useState } from 'react'
import BodyMap, { HeatLegend, heatColor } from './BodyMap'
import { AREAS, MUSCLE_GROUPS, untrainedMuscles, formatSets } from '../../lib/muscles'

// Body map + per-muscle set list. `sets` is a Map of muscle id -> weighted sets.
// `untrainedLabel` names the period for the "not trained" line (e.g. "this week");
// leave it out to skip that line. `onClassify(name)` makes unclassified names tappable.
export default function MuscleCard({ sets, unclassified = [], untrainedLabel, onClassify, emptyText }) {
  const [selected, setSelected] = useState(null)
  const max = Math.max(0, ...sets.values())
  const trained = MUSCLE_GROUPS.filter(g => sets.get(g.id) > 0)
  const untrained = untrainedMuscles(sets)
  const selectedGroup = MUSCLE_GROUPS.find(g => g.id === selected)

  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-[280px]">
        <BodyMap
          sets={sets}
          selected={selected}
          onSelect={id => setSelected(s => (s === id ? null : id))}
        />
      </div>
      <p className="text-center text-xs text-gray-400 h-4">
        {selectedGroup
          ? `${selectedGroup.label}: ${formatSets(sets.get(selected) ?? 0)} sets`
          : trained.length > 0 ? 'Tap a muscle for its sets' : ''}
      </p>
      <HeatLegend />

      {trained.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2">{emptyText ?? 'No sets yet.'}</p>
      ) : (
        AREAS.map(area => {
          const rows = trained
            .filter(g => g.area === area.id)
            .sort((a, b) => sets.get(b.id) - sets.get(a.id))
          if (rows.length === 0) return null
          return (
            <div key={area.id} className="space-y-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{area.label}</p>
              {rows.map(g => {
                const n = sets.get(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelected(s => (s === g.id ? null : g.id))}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <span className={`text-sm w-24 flex-shrink-0 ${selected === g.id ? 'text-gray-100 font-medium' : 'text-gray-300'}`}>
                      {g.label}
                    </span>
                    <span className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(4, (n / max) * 100)}%`, background: heatColor(n / max) }}
                      />
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums w-14 text-right">
                      {formatSets(n)} set{n === 1 ? '' : 's'}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })
      )}

      {untrainedLabel && trained.length > 0 && untrained.length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="text-gray-400">Not trained {untrainedLabel}:</span>{' '}
          {untrained.map(g => g.label).join(', ')}
        </p>
      )}

      {unclassified.length > 0 && (
        <p className="text-xs text-yellow-600">
          No muscles set for:{' '}
          {unclassified.map((name, i) => (
            <span key={name}>
              {i > 0 && ', '}
              {onClassify ? (
                <button type="button" onClick={() => onClassify(name)} className="underline active:text-yellow-400">
                  {name}
                </button>
              ) : name}
            </span>
          ))}
          {' '}(not shown on the map)
        </p>
      )}
    </div>
  )
}
