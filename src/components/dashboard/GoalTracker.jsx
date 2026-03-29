import { pct } from '../../lib/utils'

const TRACK_STYLES = {
  ahead:      { color: 'text-green-400',  dot: 'bg-green-400',  label: 'Ahead' },
  'on-track': { color: 'text-blue-400',   dot: 'bg-blue-400',   label: 'On track' },
  behind:     { color: 'text-orange-400', dot: 'bg-orange-400', label: 'Behind' },
}

export default function GoalTracker({ stats, weeklyGoal, onGoalChange }) {
  const { week, month, year } = stats
  const track = TRACK_STYLES[year.track] ?? TRACK_STYLES['on-track']

  return (
    <div className="px-4 py-2 space-y-3">
      {/* This week */}
      <Card title="This Week">
        <div className="flex gap-1.5 mt-1">
          {week.labels.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[10px] text-gray-500">{d.label}</span>
              <span
                className={`
                  h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${d.done
                    ? 'bg-green-500 text-white'
                    : d.activeRest
                      ? 'bg-blue-500 text-white'
                      : d.isFuture
                        ? 'border border-gray-700 text-gray-700'
                        : 'border border-gray-600 text-gray-600'}
                `}
              >
                {d.done ? '✓' : d.activeRest ? '~' : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {week.done}/{weeklyGoal} workouts — {pct(week.done, weeklyGoal)}%
          {week.activeRest > 0 && (
            <span className="text-blue-400 ml-2">+ {week.activeRest} active rest</span>
          )}
        </p>
      </Card>

      {/* This month + This year side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Card title="This Month">
          <ProgressBar value={month.done} max={month.goal} />
          <p className="text-xs text-gray-400 mt-1.5">
            {month.done}/{month.goal} <span className="text-gray-600">({pct(month.done, month.goal)}%)</span>
          </p>
          {month.activeRest > 0 && (
            <p className="text-[10px] text-blue-400 mt-0.5">{month.activeRest} active rest</p>
          )}
        </Card>

        <Card title="This Year">
          <ProgressBar value={year.done} max={year.expected} />
          <p className="text-xs text-gray-400 mt-1.5">
            {year.done}/{year.expected} <span className="text-gray-600">expected</span>
          </p>
          <div className="flex items-center gap-1 mt-1">
            <span className={`h-1.5 w-1.5 rounded-full ${track.dot}`} />
            <span className={`text-xs ${track.color}`}>{track.label}</span>
          </div>
          {year.activeRest > 0 && (
            <p className="text-[10px] text-blue-400 mt-0.5">{year.activeRest} active rest</p>
          )}
        </Card>
      </div>

      {/* Goal setter */}
      <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
        <span className="text-sm text-gray-300">Weekly goal</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onGoalChange(Math.max(1, weeklyGoal - 1))}
            className="h-8 w-8 rounded-full bg-gray-700 text-gray-100 text-lg font-bold
                       flex items-center justify-center active:bg-gray-600"
          >
            −
          </button>
          <span className="text-lg font-bold text-green-400 w-6 text-center">{weeklyGoal}</span>
          <button
            onClick={() => onGoalChange(Math.min(7, weeklyGoal + 1))}
            className="h-8 w-8 rounded-full bg-gray-700 text-gray-100 text-lg font-bold
                       flex items-center justify-center active:bg-gray-600"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ value, max }) {
  const w = pct(value, max)
  return (
    <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
      <div
        className="h-full rounded-full bg-green-500 transition-all duration-500"
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}
