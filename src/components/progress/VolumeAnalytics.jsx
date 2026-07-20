import { useState, useEffect, useCallback, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getVolumeAnalytics } from '../../lib/db'
import { shiftPeriod, formatPeriodShort } from '../../lib/utils'

const GRANULARITIES = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
]

// Load numbers can get very large — format 8420 → "8.4k"
function fmtLoad(n) {
  if (!n || n === 0) return '0'
  if (n < 1000) return String(Math.round(n))
  if (n < 10000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n / 1000) + 'k'
}
function fmtDate(d) {
  if (!d) return ''
  if (typeof d === 'string') return d
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function bucketLabel(b) {
  if (b.isBW) return 'BW'
  return b.type === 'double' ? `2×${b.weight}kg` : `${b.weight}kg`
}

export default function VolumeAnalytics() {
  const { user } = useAuth()
  const [granularity, setGranularity] = useState('week')
  const [refDate, setRefDate] = useState(() => new Date())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const d = await getVolumeAnalytics(user.id, granularity, refDate)
      setData(d)
    } catch (e) {
      console.error('Volume analytics:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, granularity, refDate])

  useEffect(() => { load() }, [load])

  const navigate = (delta) => setRefDate(shiftPeriod(granularity, refDate, delta))
  const goToNow  = () => setRefDate(new Date())

  const isNow = useMemo(() => {
    if (!data) return true
    const nowKey = data.chart[data.chart.length - 1]?.key
    const currentKey = data.chart.find(c => c.isCurrent)?.key
    return nowKey === currentKey
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }
  if (error) {
    return <div className="bg-red-950 border border-red-900 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
  }
  if (!data) return null

  const { totals, bestEver, chart, exercises } = data
  const bestMetric = bestEver.load > 0 ? bestEver.load : bestEver.reps
  const currentMetric = totals.load > 0 ? totals.load : totals.reps
  const pctOfBest = bestMetric > 0 ? Math.round((currentMetric / bestMetric) * 100) : 0
  const isBestEver = pctOfBest >= 100 && currentMetric > 0
  const useLoad = totals.load > 0 || (bestEver.load ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* Granularity toggle */}
      <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
        {GRANULARITIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setGranularity(id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${granularity === id ? 'bg-green-600 text-white' : 'text-gray-400 active:text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-gray-800 active:bg-gray-700 text-gray-300"
          aria-label="Previous period"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-gray-100">{data.currentLabel}</p>
          {!isNow && (
            <button
              type="button"
              onClick={goToNow}
              className="text-[11px] text-blue-400 active:text-blue-300 mt-0.5"
            >
              Jump to now
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(1)}
          disabled={isNow}
          className={`p-2 rounded-lg text-gray-300
            ${isNow ? 'bg-gray-800 opacity-40 cursor-default' : 'bg-gray-800 active:bg-gray-700'}`}
          aria-label="Next period"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Overall summary */}
      <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-gray-100 tabular-nums">{totals.reps}</p>
          <p className="text-sm text-gray-500">reps</p>
          {useLoad && (
            <>
              <span className="text-gray-700 mx-1">·</span>
              <p className="text-lg font-semibold text-gray-200 tabular-nums">{fmtLoad(totals.load)}</p>
              <p className="text-xs text-gray-500">load</p>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {totals.sessions} session{totals.sessions !== 1 ? 's' : ''}
        </p>
        {bestMetric > 0 && (
          <div className="flex items-center gap-1.5 pt-1">
            {isBestEver ? (
              <>
                <Trophy size={14} className="text-yellow-500" />
                <span className="text-xs text-yellow-500 font-semibold">
                  New best {granularity} {useLoad ? 'load' : 'reps'}!
                </span>
              </>
            ) : (
              <>
                {pctOfBest >= 90 ? (
                  <TrendingUp size={14} className="text-green-400" />
                ) : (
                  <TrendingDown size={14} className="text-gray-500" />
                )}
                <span className={`text-xs ${pctOfBest >= 90 ? 'text-green-400' : 'text-gray-400'}`}>
                  {pctOfBest}% of best (
                  {useLoad ? fmtLoad(bestEver.load) : bestEver.reps + ' reps'}
                  {bestEver.date ? `, ${fmtDate(bestEver.date)}` : ''}
                  )
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Big chart — last 12 periods */}
      <div className="bg-gray-800 rounded-2xl p-4">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          Last 12 {granularity === 'day' ? 'days' : granularity === 'week' ? 'weeks' : 'months'} · {useLoad ? 'load' : 'reps'}
        </p>
        <div style={{ height: 160 }}>
          <TopChart chart={chart} useLoad={useLoad} bestEver={useLoad ? bestEver.load : bestEver.reps} />
        </div>
      </div>

      {/* Per-exercise sections */}
      {exercises.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <BarChart2 size={24} className="text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Nothing logged this {granularity}.</p>
        </div>
      )}

      {exercises.map(ex => (
        <ExerciseSection key={ex.name} exercise={ex} granularity={granularity} />
      ))}
    </div>
  )
}

function ExerciseSection({ exercise, granularity }) {
  const { name, totalReps, totalLoad, allBW, heaviest, buckets } = exercise
  const useLoad = !allBW

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-100">{name}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xs text-gray-400">
            {totalReps} reps
          </span>
          {useLoad && (
            <>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-400">
                {fmtLoad(totalLoad)} load
              </span>
            </>
          )}
        </div>
        {heaviest && (
          <p className="text-[11px] text-purple-400 mt-1">
            Heaviest this {granularity}: {heaviest.weight_type === 'double' ? `2×${heaviest.weight_kg}kg` : `${heaviest.weight_kg}kg`}
          </p>
        )}
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-700">
        {buckets.map((b, i) => (
          <BucketRow key={i} bucket={b} granularity={granularity} />
        ))}
      </div>
    </div>
  )
}

function BucketRow({ bucket, granularity }) {
  const { isBW, currentReps, bestPeriodEver, bestDayInPeriod, isNewPB, sparkline } = bucket
  const useLoad = !isBW
  const currentMetric = useLoad ? bucket.currentLoad : currentReps
  const bestMetric = useLoad ? bestPeriodEver.load : bestPeriodEver.reps
  const pctOfBest = bestMetric > 0 ? Math.round((currentMetric / bestMetric) * 100) : 100
  const showNew = isNewPB && currentMetric > 0

  return (
    <div>
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-200 w-16 flex-shrink-0 font-medium">
          {bucketLabel(bucket)}
        </p>
        <Sparkline data={sparkline} useLoad={useLoad} className="flex-1" />
        <p className="text-sm text-gray-100 tabular-nums w-16 text-right">
          {currentReps}
        </p>
      </div>
      <div className="flex items-center gap-2 pl-16 mt-1">
        {showNew ? (
          <span className="text-[11px] text-yellow-500 font-semibold flex items-center gap-1">
            <Trophy size={11} /> New PB!
          </span>
        ) : bestMetric > 0 ? (
          <span className={`text-[11px] ${pctOfBest >= 90 ? 'text-green-400' : 'text-gray-500'}`}>
            {pctOfBest}% of best ({useLoad ? fmtLoad(bestPeriodEver.load) : bestPeriodEver.reps + ' reps'}
            {bestPeriodEver.date ? `, ${fmtDate(bestPeriodEver.date)}` : ''})
          </span>
        ) : (
          <span className="text-[11px] text-gray-600">(new)</span>
        )}
      </div>
      {/* Best day within period — only meaningful for week/month */}
      {granularity !== 'day' && bestDayInPeriod.date && bestDayInPeriod.reps > 0 && (
        <p className="text-[11px] text-gray-500 pl-16 mt-0.5">
          best single workout: {bestDayInPeriod.reps} ({bestDayInPeriod.date})
        </p>
      )}
    </div>
  )
}

function Sparkline({ data, useLoad, className = '' }) {
  const values = data.map(d => useLoad ? d.load : d.reps)
  const max = Math.max(1, ...values)
  return (
    <div className={`flex items-end gap-0.5 h-6 ${className}`}>
      {data.map((d, i) => {
        const v = useLoad ? d.load : d.reps
        const h = Math.max(2, Math.round((v / max) * 22))
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${d.isCurrent ? 'bg-green-500' : v > 0 ? 'bg-gray-600' : 'bg-gray-800'}`}
            style={{ height: `${h}px` }}
            title={`${d.label}: ${v}${useLoad ? ' load' : ' reps'}`}
          />
        )
      })}
    </div>
  )
}

function TopChart({ chart, useLoad, bestEver }) {
  const values = chart.map(c => useLoad ? c.load : c.reps)
  const labels = chart.map(c => c.label)
  const colors = chart.map(c => c.isCurrent ? '#22c55e' : '#166534')
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => useLoad ? `${fmtLoad(ctx.parsed.y)} load` : `${ctx.parsed.y} reps`,
        },
      },
      // Simple 'best-ever' reference line via annotation-style plugin skipped for simplicity;
      // best is already shown in the summary card above.
    },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#1f2937' } },
      y: {
        ticks: {
          color: '#6b7280',
          font: { size: 9 },
          callback: (v) => useLoad ? fmtLoad(v) : v,
        },
        grid: { color: '#1f2937' },
        beginAtZero: true,
        // Draw the best-ever level as a max reference (only visible if it exceeds current max)
        suggestedMax: bestEver ? bestEver * 1.05 : undefined,
      },
    },
  }
  return <Bar data={data} options={options} />
}
