import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function LoginForm() {
  const { signInWithMagicLink, signInWithPassword, signUp } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('magic') // 'magic' | 'password' | 'signup'
  const [status, setStatus]     = useState('idle')  // 'idle' | 'loading' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      if (mode === 'magic') {
        await signInWithMagicLink(email)
        setStatus('sent')
      } else if (mode === 'password') {
        await signInWithPassword(email, password)
      } else {
        await signUp(email, password)
        setStatus('sent')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-5xl mb-6">📬</div>
        <h2 className="text-xl font-bold text-gray-100 mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm">
          {mode === 'magic'
            ? 'We sent a magic link to ' + email + '. Tap it to sign in.'
            : 'Account created! Check your email to confirm, then sign in.'}
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-8 text-green-400 text-sm underline"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🏋️</div>
          <h1 className="text-3xl font-bold text-gray-100">Train Log</h1>
          <p className="text-gray-500 text-sm mt-1">Your workout companion</p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700 mb-6">
          {[
            { id: 'magic',    label: 'Magic Link' },
            { id: 'password', label: 'Password' },
            { id: 'signup',   label: 'Sign Up' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setStatus('idle'); setErrorMsg('') }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${mode === id ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-gray-800 border border-gray-700
                         px-4 py-4 text-gray-100 text-base min-h-[52px]
                         focus:outline-none focus:border-green-500"
            />
          </div>

          {(mode === 'password' || mode === 'signup') && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-gray-800 border border-gray-700
                           px-4 py-4 text-gray-100 text-base min-h-[52px]
                           focus:outline-none focus:border-green-500"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-red-400 text-sm">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500
                       text-white font-semibold text-base min-h-[52px]
                       disabled:opacity-50 transition-colors"
          >
            {status === 'loading' ? 'Loading…' : mode === 'magic' ? 'Send Magic Link' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {mode === 'magic' && (
          <p className="text-center text-xs text-gray-600 mt-6">
            No password needed — we'll email you a link.
          </p>
        )}
      </div>
    </div>
  )
}
