import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import WorkoutDayPage from './pages/WorkoutDay'
import TimerPage from './pages/Timer'
import ProgressPage from './pages/Progress'

function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      <main
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { user } = useAuth()

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
        <Route path="progress" element={<ProgressPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
