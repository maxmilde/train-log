import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useInterval } from '../hooks/useInterval'
import { speak } from '../lib/speech'

const PHASE = { IDLE: 'idle', PRE: 'pre', WORK: 'work', REST: 'rest', DONE: 'done' }
const DEFAULTS = { workSecs: 40, restSecs: 20, rounds: 10 }
const PRE_SECS = 5

const TimerContext = createContext(null)

export function useTimer() {
  return useContext(TimerContext)
}

export function TimerProvider({ children }) {
  const [config, setConfig]             = useState(DEFAULTS)
  const [phase, setPhase]               = useState(PHASE.IDLE)
  const [remaining, setRemaining]       = useState(DEFAULTS.workSecs)
  const [currentRound, setCurrentRound] = useState(1)
  const [running, setRunning]           = useState(false)

  const phaseRef        = useRef(PHASE.IDLE)
  const remainingRef    = useRef(DEFAULTS.workSecs)
  const currentRoundRef = useRef(1)
  const configRef       = useRef(DEFAULTS)

  phaseRef.current        = phase
  remainingRef.current    = remaining
  currentRoundRef.current = currentRound
  configRef.current       = config

  useInterval(() => {
    const r     = remainingRef.current
    const ph    = phaseRef.current
    const cfg   = configRef.current
    const round = currentRoundRef.current

    if (r > 1) { setRemaining(r - 1); return }

    // Phase transitions when timer reaches 0
    if (ph === PHASE.PRE) {
      // 5-sec countdown done → start round 1 work
      speak('Work')
      setPhase(PHASE.WORK)
      setRemaining(cfg.workSecs)
    } else if (ph === PHASE.WORK) {
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

  const start = useCallback(() => {
    // 5-sec silent pre-countdown before the first round
    setPhase(PHASE.PRE)
    setRemaining(PRE_SECS)
    setCurrentRound(1)
    setRunning(true)
  }, [])

  const pauseResume = useCallback(() => setRunning(r => !r), [])

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setRunning(false)
    setPhase(PHASE.IDLE)
    setRemaining(config.workSecs)
    setCurrentRound(1)
  }, [config])

  // Update config; if user changes work/rest time mid-session,
  // also bump the CURRENT phase's remaining time by the delta so the change feels live.
  const updateConfig = useCallback((field, value) => {
    const v = Math.max(1, Number(value) || 1)
    setConfig(prev => {
      const old = prev[field]
      const delta = v - old
      const ph = phaseRef.current
      // Only adjust remaining if user changed the field for the current phase
      if (delta !== 0) {
        if (field === 'workSecs' && ph === PHASE.WORK) {
          setRemaining(r => Math.max(1, r + delta))
        } else if (field === 'restSecs' && ph === PHASE.REST) {
          setRemaining(r => Math.max(1, r + delta))
        } else if (field === 'workSecs' && ph === PHASE.IDLE) {
          setRemaining(v)
        }
      }
      return { ...prev, [field]: v }
    })
  }, [])

  const isActive = phase === PHASE.WORK || phase === PHASE.REST || phase === PHASE.PRE

  return (
    <TimerContext.Provider value={{
      config, phase, remaining, currentRound, running, isActive,
      start, pauseResume, reset, updateConfig,
      PHASE,
    }}>
      {children}
    </TimerContext.Provider>
  )
}
