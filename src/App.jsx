import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { TimerProvider } from './context/TimerContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
import FloatingTimerBar from './components/layout/FloatingTimerBar'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import WorkoutDayPage from './pages/WorkoutDay'
import TimerPage from './pages/Timer'
import LibraryPage from './pages/Library'
import SetPasswordPage from './pages/SetPassword'

function AppShell() {
  return (
    <TimerProvider>
      <div className="flex flex-col bg-gray-900 overflow-hidden" style={{ height: '100dvh' }}>
        <main
          className="flex-1 overflow-hidden"
          style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet />
        </main>
        <FloatingTimerBar />
        <BottomNav />
      </div>
    </TimerProvider>
  )
}

export default function App() {
  const { user, isPasswordRecovery } = useAuth()

  // Show set-password screen when returning from password reset link
  if (isPasswordRecovery) {
    return <SetPasswordPage />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="workout" element={<WorkoutDayPage />} />
        <Route path="workout/:date" element={<WorkoutDayPage />} />
        <Route path="timer" element={<TimerPage />} />
        <Route path="library" element={<LibraryPage />} />
        {/* Legacy alias so old /progress links still work */}
        <Route path="progress" element={<Navigate to="/library" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
