import { useState } from 'react'
import { VEST_WEIGHT_KG } from '../../lib/utils'

const WEIGHT_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]

// The 1×/2× toggle + weight chip (with its BW / Vest / kg picker) shared by normal
// set rows and complex rows. `onChange` receives a { weightKg?, weightType } patch.
// `compact` is the slightly smaller complex-row size.
export default function WeightControls({ type, kg, isBW, isVest, onChange, compact = false }) {
  const [open, setOpen] = useState(false)
  const height = compact ? 'min-h-[40px]' : 'min-h-[44px]'
  const bg = compact ? 'bg-gray-800' : 'bg-gray-900'

  function pick(patch) {
    setOpen(false)
    onChange(patch)
  }
  // Coming from BW or vest, land on 'single'; otherwise keep the current 1×/2× choice.
  function selectWeight(w) {
    pick({ weightKg: w, weightType: type === 'bodyweight' || type === 'vest' ? 'single' : type })
  }

  let chipLabel
  if (isBW) chipLabel = 'BW'
  else if (isVest) chipLabel = 'Vest'
  else chipLabel = type === 'double' ? `2×${kg}` : `${kg}`

  const optionClass = (selected) => `block w-full text-left px-4 py-2 text-sm whitespace-nowrap
    ${selected ? 'bg-green-700 text-white' : 'text-gray-200 active:bg-gray-700'}`

  return (
    <>
      {/* 1×/2× toggle — hidden when BW or vest */}
      {!isBW && !isVest ? (
        <div className="flex rounded-md overflow-hidden border border-gray-700 flex-shrink-0">
          {['single', 'double'].map(wt => (
            <button
              key={wt}
              type="button"
              onClick={() => { if (wt !== type) onChange({ weightType: wt }) }}
              className={`${compact ? 'px-1.5' : 'px-2'} text-[10px] font-bold ${height} w-[22px] transition-colors
                ${type === wt
                  ? 'bg-green-600 text-white'
                  : `${bg} text-gray-500 active:text-gray-300`}`}
            >
              {wt === 'single' ? '1×' : '2×'}
            </button>
          ))}
        </div>
      ) : (
        // Reserve column space so rows stay aligned
        <div className="w-[46px] flex-shrink-0" />
      )}

      {/* Weight chip — the picker always includes BW and the vest */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`px-2 rounded-md ${bg} border border-gray-700
                     text-[11px] text-gray-300 ${height} w-[52px]
                     active:bg-gray-700 transition-colors`}
          aria-label="Set weight"
        >
          {chipLabel}
          {!isBW && !isVest && <span className="text-[9px] text-gray-600 ml-0.5">kg</span>}
        </button>
        {open && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 bg-transparent cursor-default"
              aria-label="Close weight picker"
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700
                            rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => pick({ weightKg: null, weightType: 'bodyweight' })}
                className={optionClass(isBW)}
              >
                BW
              </button>
              <button
                type="button"
                onClick={() => pick({ weightKg: VEST_WEIGHT_KG, weightType: 'vest' })}
                className={optionClass(isVest)}
              >
                Vest {VEST_WEIGHT_KG}kg
              </button>
              {WEIGHT_OPTIONS.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => selectWeight(w)}
                  className={optionClass(!isBW && !isVest && w === kg)}
                >
                  {w}kg
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
