import { useState, useCallback, useRef } from 'react'
import { useInterval } from '../hooks/useInterval'
import { speak } from '../lib/speech'
import { formatTime } from '../lib/utils'

const DEFAULTS = { workSecs: 40, restSecs: 20, rounds: 10 }

const PHASE = {
  IDLE: 'idle',
  WORK: 'work',
  REST: 'rest',
  DONE: 'done',
}

export default function TimerPage() {
  const [config, setConfig] = useState(DEFAULTS)
  const [phase, setPhase]   = useState(PHASE.IDLE)
  const [remaining, setRemaining] = useState(DEFAULTS.workSecs)
  const [currentRound, setCurrentRound] = useState(1)
  const [running, setRunning] = useState(false)

  // Use refs for values needed inside the interval callback
  const phaseRef        = useRef(PHASE.IDLE)
  const remainingRef    = useRef(DEFAULTS.workSecs)
  const currentRoundRef = useRef(1)
  const configRef       = useRef(DEFAULTS)

  phaseRef.current     = phase
  remainingRef.current = remaining
  currentRoundRef.current = currentRound
  configRef.current    = config

  useInterval(() => {
    const r   = remainingRef.current
    const ph  = phaseRef.current
    const cfg = configRef.current
    const round = currentRoundRef.current

    if (r > 1) {
      setRemaining(r - 1)
      return
    }

    // Phase transition
    if (ph === PHASE.WORK) {
      speak('Rest')
      setPhase(PHASE.REST)
      setRemaining(cfg.restSecs)
    } else if (ph === PHASE.REST) {
      const next = round + 1
      if (next > cfg.rounds) {
        setPhase(PHASE.DONE)
        setRunning(false)
        setRemaining(0)
      } else {
        speak('Work')
        setCurrentRound(next)
        setPhase(PHASE.WORK)
        setRemaining(cfg.workSecs)
      }
    }
  }, running ? 1000 : null)

  const handleStart = useCallback(() => {
    speak('Work') // Must be inside user gesture for iOS
    setPhase(PHASE.WORK)
    setRemaining(config.workSecs)
    setCurrentRound(1)
    setRunning(true)
  }, [config])

  const handlePauseResume = useCallback(() => {
    setRunning(r => !r)
  }, [])

  const handleReset = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setRunning(false)
    setPhase(PHASE.IDLE)
    setRemaining(config.workSecs)
    setCurrentRound(1)
  }, [config])

  const isIdle = phase === PHASE.IDLE
  const isDone = phase === PHASE.DONE
  const isWork = phase === PHASE.WORK
  const isRest = phase === PHASE.REST

  // Progress ring for current phase
  const total = isWork ? config.workSecs : isRest ? config.restSecs : 1
  const progress = isIdle || isDone ? 0 : 1 - (remaining / total)
  const circumference = 2 * Math.PI * 100
  const strokeDashoffset = circumference * (1 - progress)

  const phaseColor = {
    [PHASE.IDLE]: '#4b5563',
    [PHASE.WORK]: '#22c55e',
    [PHASE.REST]: '#3b82f6',
    [PHASE.DONE]: '#eab308',
  }[phase]

  function handleConfigChange(field, value) {
    const v = Math.max(1, Number(value) || 1)
    setConfig(prev => ({ ...prev, [field]: v }))
    if (isIdle && field === 'workSecs') setRemaining(v)
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {/* Title */}
      <div className="px-6 pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-100">Interval Timer</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between px-6 overflow-y-auto">

        {/* Config — visible only in idle */}
        {isIdle && (
          <div className="w-full space-y-3 pt-2">
            <ConfigRow
              label="Work"
              unit="sec"
              value={config.workSecs}
              onChange={v => handleConfigChange('workSecs', v)}
            />
            <ConfigRow
              label="Rest"
              unit="sec"
              value={config.restSecs}
              onChange={v => handleConfigChange('restSecs', v)}
            />
            <ConfigRow
              label="Rounds"
              unit=""
              value={config.rounds}
              onChange={v => handleConfigChange('rounds', v)}
            />
          </div>
        )}

        {/* Countdown ring + display */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative" style={{ width: 240, height: 240 }}>
            {/* Background circle */}
            <svg width="240" height="240" className="absolute inset-0 -rotate-90">
              <circle
                cx="120" cy="120" r="100"
                fill="none"
                stroke="#1f2937"
                strokeWidth="8"
              />
              <circle
                cx="120" cy="120" r="100"
                fill="none"
                stroke={phaseColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: running ? 'stroke-dashoffset 0.9s linear' : 'none' }}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: phaseColor }}>
                {isDone ? 'Done!' : isIdle ? 'Ready' : phase}
              </p>
              <p className="text-6xl font-mono font-bold text-gray-100 tabular-nums leading-tight">
                {isDone ? '0:00' : formatTime(remaining)}
              </p>
              {!isIdle && !isDone && (
                <p className="text-xs text-gray-500 mt-1">
                  Round {currentRound} / {config.rounds}
                </p>
              )}
            </div>
          </div>

          {/* Rounds dots */}
          {!isIdle && !isDone && (
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

        {/* Controls */}
        <div className="w-full flex gap-3 pb-6">
          {isIdle && (
            <BigButton onClick={handleStart} color="green">
              Start
            </BigButton>
          )}
          {isDone && (
            <BigButton onClick={handleReset} color="gray">
              Reset
            </BigButton>
          )}
          {(isWork || isRest) && (
            <>
              <BigButton onClick={handlePauseResume} color={running ? 'yellow' : 'green'}>
                {running ? 'Pause' : 'Resume'}
              </BigButton>
              <BigButton onClick={handleReset} color="gray">
                Reset
              </BigButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, unit, value, onChange }) {
  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-2xl px-5 py-4">
      <span className="text-gray-300 text-base font-medium w-16 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          onClick={() => onChange(value - (label === 'Rounds' ? 1 : 5))}
          className="h-9 w-9 rounded-full bg-gray-700 text-gray-100 text-xl font-bold
                     flex items-center justify-center active:bg-gray-600 flex-shrink-0"
        >
          −
        </button>
        <div className="flex items-center gap-1 min-w-[60px] justify-center">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-14 bg-transparent text-2xl font-bold text-green-400 text-center
                       focus:outline-none"
          />
          {unit && <span className="text-gray-500 text-sm">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + (label === 'Rounds' ? 1 : 5))}
          className="h-9 w-9 rounded-full bg-gray-700 text-gray-100 text-xl font-bold
                     flex items-center justify-center active:bg-gray-600 flex-shrink-0"
        >
          +
        </button>
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
    >
      {children}
    </button>
  )
}
