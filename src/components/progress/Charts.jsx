import { Bar } from 'react-chartjs-2'
import { buildMonthlyCount } from '../../lib/utils'

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: ctx => `${ctx.parsed.y} workouts` }
    }
  },
  scales: {
    x: {
      ticks: { color: '#6b7280', font: { size: 10 } },
      grid:  { color: '#1f2937' },
    },
    y: {
      ticks: { color: '#6b7280', font: { size: 10 }, stepSize: 1 },
      grid:  { color: '#1f2937' },
      beginAtZero: true,
    }
  }
}

export default function MonthlyChart({ days, year }) {
  const { labels, values } = buildMonthlyCount(days, year)
  const total = values.reduce((a, b) => a + b, 0)

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: values.map((v, i) => {
        const now = new Date()
        return i === now.getMonth() && year === now.getFullYear()
          ? '#22c55e'   // current month: bright green
          : '#166534'   // past months: dark green
      }),
      borderRadius: 4,
      borderSkipped: false,
    }]
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={total} unit="workouts" />
        <StatCard label="Average" value={(() => {
          const now = new Date()
          const months = year === now.getFullYear() ? now.getMonth() + 1 : 12
          return total > 0 ? Math.round(total / months) : 0
        })()} unit="/ month" />
        <StatCard
          label="Best month"
          value={Math.max(...values)}
          unit="workouts"
        />
      </div>

      {/* Chart */}
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Workouts per Month — {year}
        </p>
        {total === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No workout data yet</p>
        ) : (
          <div style={{ height: 160 }}>
            <Bar data={data} options={CHART_OPTIONS} />
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, unit }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-100">{value}</p>
      <p className="text-[10px] text-gray-600">{unit}</p>
    </div>
  )
}
