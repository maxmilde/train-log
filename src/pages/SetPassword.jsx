import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SetPasswordPage() {
  const { user, loading, updatePassword, clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [status, setStatus]     = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      await updatePassword(password)
      // Clean up URL hash and recovery state
      window.location.hash = ''
      history.replaceState(null, '', window.location.pathname)
      clearPasswordRecovery()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center bg-gray-900 px-6" style={{ height: '100dvh' }}>
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center bg-gray-900 px-6" style={{ height: '100dvh' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h2 className="text-xl font-bold text-gray-100">Set Your Password</h2>
          <p className="text-gray-500 text-sm mt-2">
            Choose a password so you can sign in without a magic link.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl bg-gray-800 border border-gray-700
                         px-4 py-4 text-gray-100 text-base min-h-[52px]
                         focus:outline-none focus:border-green-500"
            />
          </div>
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500
                       text-white font-semibold text-base min-h-[52px]
                       disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
