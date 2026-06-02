import { useEffect, useState } from 'react'
import { useTimer } from '../context/TimerContext'
import { formatTime } from '../lib/utils'

export default function TimerPage() {
  const {
    config, phase, remaining, currentRound, running, pulse,
    start, pauseResume, reset, updateConfig, PHASE, MODE,
  } = useTimer()

  const isIdle = phase === PHASE.IDLE
  const isPre  = phase === PHASE.PRE
  const isDone = phase === PHASE.DONE
  const isWork = phase === PHASE.WORK
  const isRest = phase === PHASE.REST
  const showConfig = !isDone
  const isEmom = config.mode === MODE.EMOM

  // Round-transition flash for EMOM
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (pulse === 0) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 300)
    return () => clearTimeout(t)
  }, [pulse])

  const total = isWork ? config.workSecs : isRest ? config.restSecs : isPre ? 5 : 1
  const progress = isIdle || isDone ? 0 : 1 - (remaining / total)
  const circumference = 2 * Math.PI * 100
  const strokeDashoffset = circumference * (1 - progress)

  const phaseColor = {
    [PHASE.IDLE]: '#4b5563',
    [PHASE.PRE]:  '#eab308',
    [PHASE.WORK]: '#22c55e',
    [PHASE.REST]: '#3b82f6',
    [PHASE.DONE]: '#eab308',
  }[phase]

  const phaseLabel = isDone ? 'Done!'
    : isIdle ? 'Ready'
    : isPre  ? 'Get ready'
    : phase

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      <div className="px-6 pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-100">Interval Timer</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between px-6 overflow-y-auto">

        {showConfig && (
          <div className="w-full space-y-3 pt-2">
            {/* Mode toggle */}
            <div className="flex rounded-2xl overflow-hidden border border-gray-700 bg-gray-800">
              <button
                type="button"
                onClick={() => updateConfig('mode', MODE.INTERVALS)}
                className={`flex-1 py-3 text-sm font-medium transition-colors
                  ${!isEmom ? 'bg-green-600 text-white' : 'text-gray-400 active:text-gray-200'}`}
              >
                Intervals
              </button>
              <button
                type="button"
                onClick={() => updateConfig('mode', MODE.EMOM)}
                className={`flex-1 py-3 text-sm font-medium transition-colors
                  ${isEmom ? 'bg-green-600 text-white' : 'text-gray-400 active:text-gray-200'}`}
              >
                EMOM
              </button>
            </div>

            <ConfigRow
              label="Work"
              unit="sec"
              value={config.workSecs}
              highlighted={isWork}
              onChange={v => updateConfig('workSecs', v)}
            />
            {!isEmom && (
              <ConfigRow
                label="Rest"
                unit="sec"
                value={config.restSecs}
                highlighted={isRest}
                onChange={v => updateConfig('restSecs', v)}
              />
            )}
            <ConfigRow
              label="Rounds"
              unit=""
              value={config.rounds}
              onChange={v => updateConfig('rounds', v)}
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative" style={{ width: 240, height: 240 }}>
            <svg width="240" height="240" className="absolute inset-0 -rotate-90">
              <circle cx="120" cy="120" r="100" fill="none" stroke="#1f2937" strokeWidth="8" />
              <circle
                cx="120" cy="120" r="100" fill="none"
                stroke={phaseColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                style={{ transition: running ? 'stroke-dashoffset 0.9s linear' : 'none' }}
              />
            </svg>

            {/* EMOM round-transition flash overlay */}
            {flash && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(closest-side, rgba(34,197,94,0.45), transparent 70%)',
                  animation: 'pulse 0.3s ease-out',
                }}
              />
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: phaseColor }}>
                {phaseLabel}
              </p>
              <p className="text-6xl font-mono font-bold text-gray-100 tabular-nums leading-tight">
                {isDone ? '0:00' : formatTime(remaining)}
              </p>
              {!isIdle && !isDone && !isPre && (
                <p className="text-xs text-gray-500 mt-1">
                  Round {currentRound} / {config.rounds}
                </p>
              )}
            </div>
          </div>

          {!isIdle && !isDone && !isPre && (
            <div className="flex gap-1.5 flex-wrap justify-center max-w-[240px]">
              {Array.from({ length: config.rounds }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i < currentRound - 1
                      ? 'bg-green-500'
                      : i === currentRound - 1
                        ? isWork ? 'bg-green-400' : 'bg-blue-400'
                        : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full flex gap-3 pb-6">
          {isIdle && (
            <BigButton onClick={start} color="green">Start</BigButton>
          )}
          {isDone && (
            <BigButton onClick={reset} color="gray">Reset</BigButton>
          )}
          {(isWork || isRest || isPre) && (
            <>
              <BigButton onClick={pauseResume} color={running ? 'yellow' : 'green'}>
                {running ? 'Pause' : 'Resume'}
              </BigButton>
              <BigButton onClick={reset} color="gray">Reset</BigButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, unit, value, onChange, highlighted = false }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl px-5 py-4 transition-colors
        ${highlighted ? 'bg-gray-800 ring-1 ring-green-500/30' : 'bg-gray-800'}`}
    >
      <span className="text-gray-300 text-base font-medium w-16 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          onClick={() => onChange(value - (label === 'Rounds' ? 1 : 5))}
          className="h-9 w-9 rounded-full bg-gray-700 text-gray-100 text-xl font-bold
                     flex items-center justify-center active:bg-gray-600 flex-shrink-0"
        >−</button>
        <div className="flex items-center gap-1 min-w-[60px] justify-center">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-14 bg-transparent text-2xl font-bold text-green-400 text-center focus:outline-none"
          />
          {unit && <span className="text-gray-500 text-sm">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + (label === 'Rounds' ? 1 : 5))}
          className="h-9 w-9 rounded-full bg-gray-700 text-gray-100 text-xl font-bold
                     flex items-center justify-center active:bg-gray-600 flex-shrink-0"
        >+</button>
      </div>
    </div>
  )
}

function BigButton({ onClick, color, children }) {
  const COLORS = {
    green:  'bg-green-600 active:bg-green-500',
    yellow: 'bg-yellow-600 active:bg-yellow-500',
    gray:   'bg-gray-700 active:bg-gray-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-5 rounded-2xl text-xl font-bold text-white
                  transition-colors ${COLORS[color] ?? COLORS.gray}`}
    >{children}</button>
  )
}
