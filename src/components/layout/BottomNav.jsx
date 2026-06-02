import { NavLink } from 'react-router-dom'
import { CalendarDays, Dumbbell, Timer, BookOpen } from 'lucide-react'

const TABS = [
  { to: '/',         label: 'Dashboard', Icon: CalendarDays, end: true },
  { to: '/workout',  label: 'Log',       Icon: Dumbbell,    end: false },
  { to: '/timer',    label: 'Timer',     Icon: Timer,       end: false },
  { to: '/library',  label: 'Library',   Icon: BookOpen,    end: false },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `
            flex flex-col items-center justify-center
            flex-1 py-2 gap-0.5
            text-[10px] font-medium leading-tight
            transition-colors
            ${isActive ? 'text-green-400' : 'text-gray-500'}
          `}
        >
          <Icon size={22} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
