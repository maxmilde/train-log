import { useNavigate, useLocation } from 'react-router-dom'
import { useTimer } from '../../context/TimerContext'
import { formatTime } from '../../lib/utils'

export default function FloatingTimerBar() {
  const { phase, remaining, currentRound, config, running, pauseResume, PHASE } = useTimer()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = phase === PHASE.WORK || phase === PHASE.REST || phase === PHASE.PRE
  const onTimerPage = location.pathname === '/timer'

  if (!isActive || onTimerPage) return null

  const isWork = phase === PHASE.WORK
  const isPre  = phase === PHASE.PRE
  const barColor = isPre ? 'bg-yellow-600' : isWork ? 'bg-green-600' : 'bg-blue-600'
  const label = isPre ? 'GET READY' : isWork ? 'WORK' : 'REST'

  return (
    <div
      className="fixed left-0 right-0 z-50 px-3"
      style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 4px)' }}
    >
      <button
        type="button"
        onClick={() => navigate('/timer')}
        className={`w-full ${barColor} rounded-2xl px-4 py-2.5 flex items-center justify-between
                    active:opacity-80 transition-opacity shadow-lg`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</span>
          <span className="text-lg font-mono font-bold text-white tabular-nums">{formatTime(remaining)}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isPre && (
            <span className="text-xs text-white/70">R{currentRound}/{config.rounds}</span>
          )}
          <span
            onClick={e => { e.stopPropagation(); pauseResume() }}
            className="text-xs font-semibold text-white bg-white/20 rounded-lg px-3 py-1.5
                       active:bg-white/30"
          >
            {running ? 'Pause' : 'Resume'}
          </span>
        </div>
      </button>
    </div>
  )
}
