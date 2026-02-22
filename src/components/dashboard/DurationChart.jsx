import { Bar } from 'react-chartjs-2'
import { buildWeeklyDuration } from '../../lib/utils'

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.parsed.y} min`
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#6b7280', font: { size: 10 } },
      grid:  { color: '#1f2937' },
    },
    y: {
      ticks: { color: '#6b7280', font: { size: 10 } },
      grid:  { color: '#1f2937' },
    }
  }
}

export default function DurationChart({ days }) {
  const { labels, values } = buildWeeklyDuration(days)

  if (values.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Duration per Week</p>
        <p className="text-gray-600 text-sm text-center py-6">No workout data yet</p>
      </div>
    )
  }

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: '#22c55e',
      borderRadius: 4,
      borderSkipped: false,
    }]
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Duration per Week (min)</p>
      <div style={{ height: 160 }}>
        <Bar data={data} options={CHART_OPTIONS} />
      </div>
    </div>
  )
}
