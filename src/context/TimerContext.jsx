import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useInterval } from '../hooks/useInterval'
import { speak } from '../lib/speech'

const PHASE = { IDLE: 'idle', PRE: 'pre', WORK: 'work', REST: 'rest', DONE: 'done' }
const MODE  = { INTERVALS: 'intervals', EMOM: 'emom' }
const DEFAULTS = { workSecs: 40, restSecs: 20, rounds: 10, mode: MODE.INTERVALS }
const PRE_SECS = 5

const TimerContext = createContext(null)

export function useTimer() {
  return useContext(TimerContext)
}

// Brief synthesized "next round" cue for EMOM transitions
function emomCue() {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close().catch(() => {}), 400)
  } catch (e) {
    // ignore — audio context not available
  }
}

export function TimerProvider({ children }) {
  const [config, setConfig]             = useState(DEFAULTS)
  const [phase, setPhase]               = useState(PHASE.IDLE)
  const [remaining, setRemaining]       = useState(DEFAULTS.workSecs)
  const [currentRound, setCurrentRound] = useState(1)
  const [running, setRunning]           = useState(false)
  const [pulse, setPulse]               = useState(0)  // bumps to flash on EMOM transition

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
      if (cfg.mode === MODE.EMOM) {
        // EMOM: no rest — go straight to next round (or done)
        const next = round + 1
        if (next > cfg.rounds) {
          setPhase(PHASE.DONE)
          setRunning(false)
          setRemaining(0)
        } else {
          emomCue()
          setPulse(p => p + 1)
          setCurrentRound(next)
          setRemaining(cfg.workSecs)
          // phase stays WORK
        }
      } else {
        speak('Rest')
        setPhase(PHASE.REST)
        setRemaining(cfg.restSecs)
      }
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
    let v
    if (field === 'mode') {
      v = value === MODE.EMOM ? MODE.EMOM : MODE.INTERVALS
    } else {
      v = Math.max(1, Number(value) || 1)
    }
    setConfig(prev => {
      const old = prev[field]
      const next = { ...prev, [field]: v }
      const ph = phaseRef.current
      const delta = (typeof v === 'number' && typeof old === 'number') ? v - old : 0
      if (delta !== 0) {
        if (field === 'workSecs' && ph === PHASE.WORK) {
          setRemaining(r => Math.max(1, r + delta))
        } else if (field === 'restSecs' && ph === PHASE.REST) {
          setRemaining(r => Math.max(1, r + delta))
        } else if (field === 'workSecs' && ph === PHASE.IDLE) {
          setRemaining(v)
        }
      }
      return next
    })
  }, [])

  const isActive = phase === PHASE.WORK || phase === PHASE.REST || phase === PHASE.PRE

  return (
    <TimerContext.Provider value={{
      config, phase, remaining, currentRound, running, isActive, pulse,
      start, pauseResume, reset, updateConfig,
      PHASE, MODE,
    }}>
      {children}
    </TimerContext.Provider>
  )
}
