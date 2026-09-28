import { MUSCLE_MAP } from 'body-muscles'
import { groupForRegion } from '../../lib/muscles'

// Front and back figures side by side. Outlines come from the body-muscles package
// (Apache-2.0, © Ivan Vulović); in its coordinates the front figure spans x 0–35 and
// the back figure x 37–72, so one viewBox shows both.
const REGIONS = MUSCLE_MAP.map(r => ({ id: r.id, path: r.path, group: groupForRegion(r.id) }))

const BODY_COLOR = '#374151'      // head, hands, knees… (not a muscle group)
const UNTRAINED_COLOR = '#4b5563' // a muscle with no sets
const OUTLINE = '#111827'

// Heat colour for a share of the busiest muscle (0–1]: yellow → orange → red
const STOPS = [[250, 204, 21], [249, 115, 22], [220, 38, 38]]
export function heatColor(share) {
  const t = Math.min(1, Math.max(0, share)) * (STOPS.length - 1)
  const i = Math.min(Math.floor(t), STOPS.length - 2)
  const f = t - i
  const [r, g, b] = STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f))
  return `rgb(${r}, ${g}, ${b})`
}

// sets: Map of muscle group id -> sets. The busiest muscle is red; the rest are
// shaded relative to it; untrained muscles stay grey.
export default function BodyMap({ sets, selected, onSelect, className = '' }) {
  const max = Math.max(0, ...sets.values())
  const fill = (group) => {
    if (!group) return BODY_COLOR
    const n = sets.get(group) ?? 0
    return n > 0 && max > 0 ? heatColor(n / max) : UNTRAINED_COLOR
  }

  return (
    <svg
      viewBox="-1 -1 74 95"
      className={`w-full ${className}`}
      role="img"
      aria-label="Muscle map, front and back"
    >
      {REGIONS.map(r => (
        <path
          key={r.id}
          d={r.path}
          fill={fill(r.group)}
          stroke={selected && r.group === selected ? '#f9fafb' : OUTLINE}
          strokeWidth={selected && r.group === selected ? 0.5 : 0.2}
          strokeLinejoin="round"
          onClick={r.group && onSelect ? () => onSelect(r.group) : undefined}
          style={r.group && onSelect ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </svg>
  )
}

// Grey "none" swatch plus the yellow → red scale
export function HeatLegend() {
  return (
    <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm" style={{ background: UNTRAINED_COLOR }} />
        none
      </span>
      <span className="flex items-center gap-1.5">
        fewer sets
        <span
          className="h-2 w-16 rounded-sm"
          style={{ background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }}
        />
        most
      </span>
    </div>
  )
}
