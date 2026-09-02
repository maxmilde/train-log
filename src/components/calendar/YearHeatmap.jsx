import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildHeatmapGrid, buildMonthLabels, toDateStr } from '../../lib/utils'

const DAY_COLOR = {
  workout:     'bg-green-500',
  active_rest: 'bg-blue-500',
  rest:        'bg-gray-700',
  empty:       'bg-transparent',
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function YearHeatmap({ year, dayMap }) {
  const navigate = useNavigate()
  const weeks = buildHeatmapGrid(year)
  const monthLabels = buildMonthLabels(year)
  const today = toDateStr(new Date())

  const scrollRef = useRef(null)
  const todayColRef = useRef(null)

  // Centre the current week horizontally on mount. Set scrollLeft directly rather
  // than scrollIntoView so the page itself never jumps vertically.
  useEffect(() => {
    const container = scrollRef.current
    const col = todayColRef.current
    if (!container || !col) return
    const target = col.offsetLeft - (container.clientWidth / 2) + (col.offsetWidth / 2)
    container.scrollLeft = Math.max(0, target)
  }, [year])

  // Only submitted days show color; unsubmitted past days = rest (gray)
  function getDayType(dateStr, isCurrentYear) {
    if (!isCurrentYear) return 'empty'
    const day = dayMap.get(dateStr)
    if (!day || !day.submitted) return 'rest'
    return day.day_type
  }

  return (
    <section className="px-3 py-2">
      <div ref={scrollRef} className="overflow-x-auto scrollbar-none">
        <div className="inline-flex flex-col gap-0 min-w-max">

          {/* Month labels row */}
          <div className="flex mb-1 ml-5">
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find(m => m.weekIndex === wi)
              return (
                <div key={wi} className="w-[13px] mr-[2px] text-[8px] text-gray-500 leading-none">
                  {lbl ? lbl.label : ''}
                </div>
              )
            })}
          </div>

          {/* Grid: DOW labels + week columns */}
          <div className="flex gap-0">
            <div className="flex flex-col gap-[2px] mr-1">
              {DOW.map((l, i) => (
                <div key={i} className="h-[11px] w-4 flex items-center">
                  <span className="text-[8px] text-gray-600 leading-none">{i % 2 === 0 ? l : ''}</span>
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => {
              const hasToday = week.some(d => d.dateStr === today)
              return (
              <div
                key={wi}
                ref={hasToday ? todayColRef : undefined}
                className="flex flex-col gap-[2px] mr-[2px]"
              >
                {week.map(({ dateStr, isCurrentYear }) => {
                  const type = getDayType(dateStr, isCurrentYear)
                  const isToday = dateStr === today

                  return (
                    <button
                      key={dateStr}
                      disabled={!isCurrentYear}
                      onClick={() => isCurrentYear && navigate(`/workout/${dateStr}`)}
                      title={isCurrentYear ? dateStr : ''}
                      className={`
                        h-[11px] w-[11px] rounded-[2px] p-0 border-0
                        ${DAY_COLOR[type]}
                        ${isToday ? 'ring-1 ring-white ring-offset-[1px] ring-offset-gray-900' : ''}
                        ${isCurrentYear ? 'cursor-pointer hover:opacity-80 active:opacity-60' : 'cursor-default'}
                        transition-opacity
                      `}
                    />
                  )
                })}
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <LegendItem color="bg-green-500" label="Workout" />
        <LegendItem color="bg-blue-500"  label="Active rest" />
        <LegendItem color="bg-gray-700"  label="Rest" />
      </div>
    </section>
  )
}

function LegendItem({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[2px] flex-shrink-0 ${color}`} />
      {label}
    </span>
  )
}
